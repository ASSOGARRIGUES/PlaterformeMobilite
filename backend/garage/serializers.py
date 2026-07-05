from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from drf_extra_fields.fields import Base64ImageField
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from api.models import Contract, Vehicle
from api.serializers import VehicleSerializer, UserSerializer
from .models import TaskCatalog, MileageEntry, InterventionSheet, InterventionTask, InterventionTaskPart, GaragePhoto


class TaskCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'is_critical', 'is_wear_task']


class MileageEntrySerializer(serializers.ModelSerializer):
    CONTRACT_SOURCES = {'contract', 'contract_start', 'contract_end'}

    author_display = serializers.SerializerMethodField()
    beneficiary_display = serializers.SerializerMethodField()

    def get_author_display(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_beneficiary_display(self, obj):
        if obj.source not in self.CONTRACT_SOURCES or not obj.source_id:
            return None
        contracts_by_id = self.context.get('contracts_by_id')
        if contracts_by_id is not None:
            contract = contracts_by_id.get(obj.source_id)
        else:
            contract = Contract.objects.select_related('beneficiary').filter(pk=obj.source_id).first()
        if contract is None:
            return None
        beneficiary = contract.beneficiary
        return f"{beneficiary.first_name} {beneficiary.last_name}".strip()

    class Meta:
        model = MileageEntry
        fields = ['id', 'value', 'date', 'source', 'source_id', 'author_display',
                  'beneficiary_display', 'is_corrected', 'corrects', 'correction_reason', 'created_at']
        read_only_fields = ['value', 'date', 'source', 'source_id', 'is_corrected', 'corrects', 'correction_reason']


class MileageCorrectionSerializer(serializers.Serializer):
    entry = serializers.PrimaryKeyRelatedField(queryset=MileageEntry.objects.all())
    value = serializers.IntegerField(min_value=0)
    reason = serializers.CharField()

    def validate(self, attrs):
        entry = attrs['entry']
        vehicle_pk = self.context['vehicle_pk']
        if entry.vehicle_id != int(vehicle_pk):
            raise serializers.ValidationError({'entry': "Cette entrée n'appartient pas à ce véhicule."})
        return attrs


class InterventionTaskPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterventionTaskPart
        fields = ['id', 'name', 'unit_price', 'quantity']


class InterventionTaskSerializer(serializers.ModelSerializer):
    parts = InterventionTaskPartSerializer(many=True, read_only=True)
    photos = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ListField(child=serializers.URLField()))
    def get_photos(self, obj):
        request = self.context.get('request')
        photos = GaragePhoto.objects.filter(
            content_type=ContentType.objects.get_for_model(InterventionTask),
            object_id=obj.pk,
        )
        urls = [photo.image.url for photo in photos]
        if request is not None:
            urls = [request.build_absolute_uri(url) for url in urls]
        return urls

    class Meta:
        model = InterventionTask
        fields = ['id', 'sheet', 'type', 'catalog_task', 'description', 'wear_level', 'parts', 'photos']
        read_only_fields = ['sheet']


class MutationInterventionTaskSerializer(serializers.ModelSerializer):
    parts = InterventionTaskPartSerializer(many=True, required=False)
    photos = serializers.ListField(child=Base64ImageField(), required=False, write_only=True)

    class Meta:
        model = InterventionTask
        fields = ['id', 'type', 'catalog_task', 'description', 'wear_level', 'parts', 'photos']

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        photos_data = validated_data.pop('photos', [])
        sheet = self.context['sheet']
        with transaction.atomic():
            task = InterventionTask.objects.create(sheet=sheet, **validated_data)
            for part_data in parts_data:
                InterventionTaskPart.objects.create(task=task, **part_data)
            content_type = ContentType.objects.get_for_model(InterventionTask)
            for image in photos_data:
                GaragePhoto.objects.create(image=image, content_type=content_type, object_id=task.pk)
        return task


class InterventionSheetSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    tasks = InterventionTaskSerializer(many=True, read_only=True)

    class Meta:
        model = InterventionSheet
        fields = ['id', 'vehicle', 'created_by', 'current_step', 'status', 'start_mileage',
                  'start_date', 'end_date', 'created_at', 'updated_at', 'tasks']


class MutationInterventionSheetSerializer(serializers.ModelSerializer):
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.none())

    class Meta:
        model = InterventionSheet
        fields = ['id', 'vehicle', 'current_step', 'status', 'start_mileage', 'start_date', 'end_date']
        read_only_fields = ['status']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None:
            user = request.user
            if user.has_perm('garage.view_vehicle'):
                self.fields['vehicle'].queryset = Vehicle.objects.filter(action__in=user.actions.all())
            else:
                self.fields['vehicle'].queryset = Vehicle.objects.filter(action=user.current_action)

    def validate(self, attrs):
        if self.instance:
            if 'vehicle' in attrs and attrs['vehicle'] != self.instance.vehicle:
                raise serializers.ValidationError({
                    'vehicle': "Le véhicule d'une fiche ne peut pas être modifié après sa création."
                })
        else:
            vehicle = attrs.get('vehicle')
            if vehicle is not None and InterventionSheet.objects.filter(vehicle=vehicle, status='open').exists():
                raise serializers.ValidationError({
                    'vehicle': "Une fiche d'intervention est déjà ouverte pour ce véhicule."
                })

        start_mileage = attrs.get('start_mileage')
        if start_mileage is not None:
            vehicle = attrs.get('vehicle') or (self.instance.vehicle if self.instance else None)
            if vehicle is not None and start_mileage < vehicle.kilometer:
                raise serializers.ValidationError({
                    'start_mileage': f"Le kilométrage ({start_mileage}) ne peut pas être inférieur "
                                      f"au kilométrage actuel du véhicule ({vehicle.kilometer})."
                })
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        validated_data['status'] = 'open'
        validated_data['current_step'] = 1
        return super().create(validated_data)
