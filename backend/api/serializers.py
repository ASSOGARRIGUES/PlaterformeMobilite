from datetime import date
from django.utils import timezone

from django.contrib.auth import get_user_model
from django.db.models import Q
from drf_extra_fields.fields import Base64ImageField
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Vehicle, Beneficiary, Contract, Parking, Payment
from core.models import Action
from core.serializers import ActionSerializer


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
    action = ActionSerializer(read_only=True)

    def create(self, validated_data):
        validated_data['action'] = self.context['request'].user.current_action
        return super().create(validated_data)

    class Meta:
        model = Vehicle
        fields = '__all__'


class MutationVehicleSerializer(VehicleSerializer):
    parking = serializers.PrimaryKeyRelatedField(queryset=Parking.objects.all(), required=False)

class VehicleActionTransferSerializer(serializers.ModelSerializer):
    action = serializers.PrimaryKeyRelatedField(queryset=Action.objects.all())
    parking = serializers.PrimaryKeyRelatedField(queryset=Parking.objects.all(), required=False)

    class Meta:
        model = Vehicle
        fields = ['parking', 'action']

    def validate(self, attrs):
        # Check if vehicle can be moved to the target action --> No ongoing contracts
        if self.instance.status == 'rented':
            contract = self.instance.contracts.filter(Q(status='waiting') | Q(status='pending')).first()
            contract_id = contract.id if contract is not None else 'inconnu'
            raise serializers.ValidationError(f"Le véhicule est actuellement en location (Contrat n°{contract_id}) et ne peut pas être déplacé.")

        return super().validate(attrs)

    def validate_action(self, value):
        if value is not None and value == self.instance.action:
            raise serializers.ValidationError("Le véhicule est déjà dans l'action cible.")
        return value
    def validate_parking(self, value):
        try:
            target_action = Action.objects.get(pk=self.initial_data['action'])
        except Action.DoesNotExist:
            raise serializers.ValidationError("Action cible inconnue")

        if value is not None and target_action not in value.actions.all():
            raise serializers.ValidationError("Le parking sélectionné n'est pas dans l'action cible.")
        return value

    def update(self, instance, validated_data):
        if 'action' in validated_data:
            instance.action = validated_data['action']
        if 'parking' in validated_data:
            instance.parking = validated_data['parking']
        instance.save()
        return instance

# Read only serializer for a short vehicle representation (id, fleet_id, action)
class ShortVehicleSerializer(serializers.ModelSerializer):
    action = ActionSerializer(read_only=True)

    class Meta:
        model = Vehicle
        fields = ['id', 'fleet_id', 'action']

class BeneficiarySerializer(serializers.ModelSerializer):
    action = ActionSerializer(read_only=True)
    class Meta:
        model = Beneficiary
        fields = '__all__'

    def create(self, validated_data):
        validated_data['action'] = self.context['request'].user.current_action
        return super().create(validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(read_only=True)
    created_by = UserSerializer(read_only=True)
    editable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Payment
        exclude = ['contract']

    def is_valid(self, *, raise_exception=False):
        # check the contract is not none
        contract = self.context['contract']
        if contract is None:
            raise serializers.ValidationError("Le paiement doit être associé à un contrat")

        if contract.archived:
            raise serializers.ValidationError("Le contrat est archivé, aucun paiement ne peut être effectué")

        # call the parent validate method
        return super().is_valid(raise_exception=raise_exception)

    def validate_amount(self, value):
        contract = self.context['contract']
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0")

        return value

    def update(self, instance, validated_data):
        # If a more recent payment has been made for the contract, the payment should be rejected
        if instance.contract.payments.filter(created_at__gt=instance.created_at).exists():
            raise serializers.ValidationError("Un paiement plus récent a déjà été effectué pour ce contrat")

        # Calculate the new total amount of payments for the contract (by removing the old amount and adding the new one) and check if it doesn't exceed the total price of the contract
        if instance.contract.getPaymentsSum() - instance.amount + validated_data['amount'] > instance.contract.price - instance.contract.discount:
            raise serializers.ValidationError("Le montant total des paiements ne peut pas dépasser le prix total du contrat")

        return super().update(instance, validated_data)

    def create(self, validated_data):
        contract = self.context['contract']

        if contract.status == "payed":
            raise serializers.ValidationError("Aucun nouveau paiement ne peut-être effectué pour un contrat déjà payé")

        # Check if the total amount of payments doesn't exceed the total price of the contract
        if contract.getPaymentsSum() + validated_data['amount'] > contract.price - contract.discount:
            raise serializers.ValidationError("Le montant total des paiements ne peut pas dépasser le prix total du contrat")

        validated_data['created_by'] = self.context['request'].user
        validated_data['contract'] = contract
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
        return obj.price - obj.discount

    def get_nb_payments(self, obj) -> int:
        return obj.payments.count()

    def get_is_payed(self, obj) -> bool:
        return obj.status == 'payed'


class ContractSerializer(serializers.ModelSerializer):
    start_kilometer = serializers.IntegerField(required=False)
    end_kilometer = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = UserSerializer(read_only=True)
    referent = UserSerializer()
    action = ActionSerializer(read_only=True)
    vehicle = VehicleSerializer()
    beneficiary = BeneficiarySerializer()
    renewed_from_id = serializers.IntegerField(read_only=True, allow_null=True)
    active_renewal_id = serializers.SerializerMethodField(read_only=True)
    root_contract_id = serializers.SerializerMethodField(read_only=True)
    root_contract_created_at = serializers.SerializerMethodField(read_only=True)
    root_contract_deposit = serializers.SerializerMethodField(read_only=True)
    root_contract_deposit_payment_mode = serializers.SerializerMethodField(read_only=True)
    root_contract_deposit_check_number = serializers.SerializerMethodField(read_only=True)

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_active_renewal_id(self, obj):
        renewal = obj.renewals.filter(status__in=['pending', 'waiting']).first()
        return renewal.id if renewal else None

    def _get_root(self, obj):
        if not hasattr(self, '_root_cache'):
            self._root_cache = {}
        if obj.pk not in self._root_cache:
            root = obj
            seen = set()
            while root.renewed_from_id and root.pk not in seen:
                seen.add(root.pk)
                root = root.renewed_from
            self._root_cache[obj.pk] = root
        return self._root_cache[obj.pk]

    @extend_schema_field(serializers.IntegerField())
    def get_root_contract_id(self, obj):
        return self._get_root(obj).id

    @extend_schema_field(serializers.DateTimeField())
    def get_root_contract_created_at(self, obj):
        return self._get_root(obj).created_at

    @extend_schema_field(serializers.FloatField())
    def get_root_contract_deposit(self, obj):
        return self._get_root(obj).deposit

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_root_contract_deposit_payment_mode(self, obj):
        return self._get_root(obj).depositPaymentMode

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_root_contract_deposit_check_number(self, obj):
        return self._get_root(obj).deposit_check_number

    class Meta:
        model = Contract
        fields = '__all__'

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        validated_data['action'] = self.context['request'].user.current_action
        if not 'start_kilometer' in validated_data:
            validated_data['start_kilometer'] = validated_data['vehicle'].kilometer
        contract = super().create(validated_data)
        contract.vehicle.status = 'rented'
        #if the start_kilometer is provided, we update the vehicle kilometer
        if 'start_kilometer' in validated_data:
            contract.vehicle.kilometer = validated_data['start_kilometer']
        contract.vehicle.save()
        return contract

    def validate_vehicle(self, value):
        if value.status != 'available':
            raise serializers.ValidationError("Le véhicule n'est pas disponible")
        return value

    def validate_referent(self, value):
        action = self.context['request'].user.current_action
        if value.current_action != action:
            raise serializers.ValidationError("Le référent selectionné n'a pas accès à l'action "+action.name)
        return value


class MutationContractSerializer(ContractSerializer):
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.all())
    beneficiary = serializers.PrimaryKeyRelatedField(queryset=Beneficiary.objects.all())
    referent = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.all())


class RenewContractSerializer(MutationContractSerializer):
    """Serializer pour le renouvellement d'un contrat existant.

    Le véhicule et le bénéficiaire sont imposés par le contrat source et ne peuvent pas être modifiés.
    L'ancien contrat est clôturé automatiquement lors de la création.
    """

    def validate_vehicle(self, value):
        source = self.context['source_contract']
        if value != source.vehicle:
            raise serializers.ValidationError("Le véhicule doit être identique à celui du contrat renouvelé.")
        # On bypass la validation 'available' car le véhicule est encore loué sur l'ancien contrat
        return value

    def validate_beneficiary(self, value):
        source = self.context['source_contract']
        if value != source.beneficiary:
            raise serializers.ValidationError("Le bénéficiaire doit être identique à celui du contrat renouvelé.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        source = self.context['source_contract']
        effective_close_date = max(source.end_date, date.today())
        start_date = attrs.get('start_date')
        if start_date and start_date < effective_close_date:
            raise serializers.ValidationError({
                'start_date': (
                    f"La date de début doit être au minimum le {effective_close_date.strftime('%d/%m/%Y')} "
                    f"(date de fin effective du contrat précédent)."
                )
            })
        return attrs

    def create(self, validated_data):
        source = self.context['source_contract']
        effective_close_date = max(source.end_date, date.today())

        # Clôturer l'ancien contrat
        vehicle = source.vehicle
        source.status = 'over'
        source.end_kilometer = vehicle.kilometer
        source.ended_at = timezone.make_aware(
            timezone.datetime.combine(effective_close_date, timezone.datetime.min.time())
        )
        source.save()

        # Créer le nouveau contrat (le véhicule reste rented, pas de changement de statut)
        validated_data['created_by'] = self.context['request'].user
        validated_data['action'] = self.context['request'].user.current_action
        validated_data['status'] = 'pending'
        validated_data['renewed_from'] = source
        if 'start_kilometer' not in validated_data:
            validated_data['start_kilometer'] = vehicle.kilometer

        contract = Contract.objects.create(**validated_data)
        return contract


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
    permissions = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ListField)
    def get_permissions(self, obj):
        return obj.get_all_permissions()

    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'permissions', 'actions', 'current_action']


#UserActionSerializer is used to get the actions of the current user in the frontend and the currenlty selected action
class UserActionSerializer(serializers.ModelSerializer):
    actions = serializers.SerializerMethodField()
    current_action = ActionSerializer()
    class Meta:
        model = get_user_model()
        fields = ['actions', 'current_action']

    @extend_schema_field(ActionSerializer(many=True))
    def get_actions(self, obj):
        if obj.is_superuser:
            return ActionSerializer(Action.objects.all(), many=True).data
        return ActionSerializer(obj.actions, many=True).data

class UserActionUpdateSerializer(serializers.ModelSerializer):
    current_action = serializers.PrimaryKeyRelatedField(queryset=Action.objects.all(), required=False)
    class Meta:
        model = get_user_model()
        fields = ['current_action']

    def update(self, instance, validated_data):
        instance.current_action = validated_data.get('current_action', instance.current_action)
        instance.save()
        return instance



#########################
### Stats serializers ###
#########################


class ReferentGroupSerializer(serializers.Serializer):
    referents = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.all(), many=True)
    id = serializers.IntegerField()

class ContractGroupByRefStatsSerializer(serializers.Serializer):
    """
       The ContractGroupByRefStatsSerializer is used to serialize the referent group to produce the stats for grouped contracts.
       This serialiser will be used as an input for the ongoing_grouped action in the ContractStatsViewSet.

       It is a list of list of referent. Each referent represented by its id.
    """
    groups = ReferentGroupSerializer(many=True)

