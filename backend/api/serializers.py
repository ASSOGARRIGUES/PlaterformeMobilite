from django.contrib.auth import get_user_model
from drf_extra_fields.fields import Base64ImageField
from rest_framework import serializers

from .models import Vehicle, Beneficiary, Contract, Parking, Payment


class DynamicDepthSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.Meta.depth = self.context.get('depth', 0)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class ParkingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parking
        fields = '__all__'


class VehicleSerializer(DynamicDepthSerializer):
    photo = Base64ImageField(required=False)
    parking = ParkingSerializer(read_only=True)

    class Meta:
        model = Vehicle
        fields = '__all__'


class MutationVehicleSerializer(VehicleSerializer):
    parking = serializers.PrimaryKeyRelatedField(queryset=Parking.objects.all(), required=False)


class BeneficiarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficiary
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(read_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Payment
        exclude = ['contract']

    def is_valid(self, *, raise_exception=False):
        # check the contract is not none
        contract = self.context['contract']
        if contract is None:
            raise serializers.ValidationError("Le paiement doit être associé à un contrat")

        # the contract should be ended before creating a payment
        if contract.status == "payed":
            raise serializers.ValidationError("Aucun paiement ne peut-être effectué pour un contrat déjà payé")

        # call the parent validate method
        return super().is_valid(raise_exception=raise_exception)

    def validate_amount(self, value):
        contract = self.context['contract']
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0")
        if contract.getPaymentsSum() + value > contract.price - contract.discount:
            raise serializers.ValidationError("Le montant total des paiements ne peut pas dépasser le prix total du contrat")
        return value

    def update(self, instance, validated_data):
        # If a more recent payment has been made for the contract, the payment should be rejected
        if instance.contract.payments.filter(created_at__gt=instance.created_at).exists():
            raise serializers.ValidationError("Un paiement plus récent a déjà été effectué pour ce contrat")
        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        validated_data['contract'] = self.context['contract']
        return super().create(validated_data)

class ContractPaymentSummarySerializer(serializers.ModelSerializer):
    payments_sum = serializers.SerializerMethodField(read_only=True)
    total_due = serializers.SerializerMethodField(read_only=True)
    price = serializers.IntegerField(read_only=True)
    discount = serializers.IntegerField(read_only=True)
    nb_payments = serializers.SerializerMethodField(read_only=True)
    is_payed = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Contract
        fields = ['payments_sum', 'total_due', 'price', 'discount', "nb_payments", "is_payed"]

    def get_payments_sum(self, obj) -> int:
        return obj.getPaymentsSum()

    def get_total_due(self, obj) -> int:
        print("price ", obj.price, "discount ", obj.discount, "payments ", obj.getPaymentsSum())
        return obj.price - obj.discount

    def get_nb_payments(self, obj) -> int:
        return obj.payments.count()

    def get_is_payed(self, obj) -> bool:
        return obj.status == 'payed'


class ContractSerializer(serializers.ModelSerializer):
    start_kilometer = serializers.IntegerField(read_only=True)
    end_kilometer = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = UserSerializer(read_only=True)
    referent = UserSerializer()
    vehicle = VehicleSerializer()
    beneficiary = BeneficiarySerializer()

    class Meta:
        model = Contract
        fields = '__all__'

    def create(self, validated_data):
        print("create contract serializer")
        validated_data['created_by'] = self.context['request'].user
        contract = super().create(validated_data)
        contract.vehicle.status = 'rented'
        contract.vehicle.save()
        return contract

    def validate_vehicle(self, value):
        if value.status != 'available':
            raise serializers.ValidationError("Le véhicule n'est pas disponible")
        return value


class MutationContractSerializer(ContractSerializer):
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.all())
    beneficiary = serializers.PrimaryKeyRelatedField(queryset=Beneficiary.objects.all())
    referent = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.all())


class EndContractSerializer(serializers.ModelSerializer):
    end_kilometer = serializers.IntegerField()
    price = serializers.IntegerField()
    deposit = serializers.IntegerField()
    discount = serializers.IntegerField()
    max_kilometer = serializers.IntegerField(read_only=True)
    start_kilometer = serializers.IntegerField(read_only=True)
    vehicle_kilometer = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Contract
        fields = ['price', 'deposit', 'discount',  'end_kilometer', 'start_kilometer', 'max_kilometer', 'vehicle_kilometer']

    def get_vehicle_kilometer(self, obj) -> int:
        return obj.vehicle.kilometer

    def validate_end_kilometer(self, value):
        if value < self.instance.start_kilometer:
            raise serializers.ValidationError("Le kilométrage de fin doit être supérieur au kilométrage de début")
        if self.instance.vehicle.kilometer > value:
            raise serializers.ValidationError("Le kilométrage de fin est inférieur au kilométrage actuel du véhicule")

        return value



# WhoAmISerializer is used to get the current user information in the frontend --> it should return {'id', 'username', 'email', 'first_name', 'last_name'}
class WhoAmISerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
