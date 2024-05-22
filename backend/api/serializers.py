from django.contrib.auth import get_user_model
from drf_extra_fields.fields import Base64ImageField
from rest_framework import serializers

from .models import Vehicle, Beneficiary, Contract, Parking

class DynamicDepthSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.Meta.depth = self.context.get('depth', 0)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class VehicleSerializer(DynamicDepthSerializer):
    photo = Base64ImageField(required=False)

    class Meta:
        model = Vehicle
        fields = '__all__'


class BeneficiarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficiary
        fields = '__all__'


class ContractSerializer(DynamicDepthSerializer):
    start_kilometer = serializers.IntegerField(read_only=True)
    end_kilometer = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = UserSerializer(read_only=True)
    referent = UserSerializer()

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

class ParkingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parking
        fields = '__all__'