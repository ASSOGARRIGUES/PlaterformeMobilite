from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from drf_extra_fields.fields import Base64ImageField
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from api.models import Contract, Vehicle
from api.serializers import VehicleSerializer, UserSerializer
from .models import TaskCatalog, MileageEntry, InterventionSheet, InterventionTask, InterventionTaskPart, GaragePhoto, AuditLog
from .alerts import get_config, TASK_STATUS_CHOICES, PLANNING_SOURCE_CHOICES, AXIS_CHOICES


class TaskCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'is_critical', 'is_wear_task', 'icon']


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


class AuditLogSerializer(serializers.ModelSerializer):
    author_display = serializers.SerializerMethodField()

    def get_author_display(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip()

    class Meta:
        model = AuditLog
        fields = ['id', 'author_display', 'created_at', 'action', 'field_name', 'old_value', 'new_value']


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


class GaragePhotoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    url = serializers.URLField()


class InterventionTaskSerializer(serializers.ModelSerializer):
    parts = InterventionTaskPartSerializer(many=True, read_only=True)
    photos = serializers.SerializerMethodField()

    @extend_schema_field(GaragePhotoSerializer(many=True))
    def get_photos(self, obj):
        request = self.context.get('request')
        photos = GaragePhoto.objects.filter(
            content_type=ContentType.objects.get_for_model(InterventionTask),
            object_id=obj.pk,
        )
        result = []
        for photo in photos:
            url = photo.image.url
            if request is not None:
                url = request.build_absolute_uri(url)
            result.append({'id': photo.id, 'url': url})
        return result

    class Meta:
        model = InterventionTask
        fields = ['id', 'sheet', 'type', 'catalog_task', 'name', 'description', 'wear_level', 'parts', 'photos']
        read_only_fields = ['sheet']


def _validate_posed_wear(task_type, catalog_task, wear_level):
    """Une pièce posée (tâche d'usure réalisée) ne peut pas être sous le seuil d'alerte d'usure."""
    if task_type != 'done' or catalog_task is None or not catalog_task.is_wear_task or wear_level is None:
        return
    threshold = get_config().wear_alert_threshold
    if wear_level < threshold:
        raise serializers.ValidationError({
            'wear_level': f"Une pièce à {wear_level}/10 ne peut pas être posée : l'état minimum accepté "
                          f"est {threshold}/10 (seuil d'alerte d'usure)."
        })


class MutationInterventionTaskSerializer(serializers.ModelSerializer):
    parts = InterventionTaskPartSerializer(many=True, required=False)
    photos = serializers.ListField(child=Base64ImageField(), required=False, write_only=True)

    class Meta:
        model = InterventionTask
        fields = ['id', 'type', 'catalog_task', 'name', 'description', 'wear_level', 'parts', 'photos']

    def validate(self, attrs):
        if not attrs.get('catalog_task') and not (attrs.get('name') or '').strip():
            raise serializers.ValidationError({'name': "Le nom est requis pour une tâche libre."})
        _validate_posed_wear(attrs.get('type'), attrs.get('catalog_task'), attrs.get('wear_level'))
        return attrs

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


class UpdateInterventionTaskSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    wear_level = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=10)
    parts = InterventionTaskPartSerializer(many=True, required=False)
    add_photos = serializers.ListField(child=Base64ImageField(), required=False)
    remove_photo_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate(self, attrs):
        if 'name' in attrs and not attrs['name'].strip() and not self.instance.catalog_task:
            raise serializers.ValidationError({'name': "Le nom est requis pour une tâche libre."})
        if 'wear_level' in attrs:
            _validate_posed_wear(self.instance.type, self.instance.catalog_task, attrs['wear_level'])
        return attrs

    def update(self, instance, validated_data):
        with transaction.atomic():
            if 'parts' in validated_data:
                instance.parts.all().delete()
                for part_data in validated_data['parts']:
                    InterventionTaskPart.objects.create(task=instance, **part_data)
            content_type = ContentType.objects.get_for_model(InterventionTask)
            for photo in GaragePhoto.objects.filter(
                pk__in=validated_data.get('remove_photo_ids', []), content_type=content_type, object_id=instance.pk,
            ):
                photo.image.delete(save=False)
                photo.delete()
            for image in validated_data.get('add_photos', []):
                GaragePhoto.objects.create(image=image, content_type=content_type, object_id=instance.pk)
            for field in ('name', 'description', 'wear_level'):
                if field in validated_data:
                    setattr(instance, field, validated_data[field])
            instance.save()
        return instance


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
            if (
                self.instance.status == 'validated'
                and 'start_mileage' in attrs
                and attrs['start_mileage'] != self.instance.start_mileage
            ):
                raise serializers.ValidationError({
                    'start_mileage': "Le kilométrage d'une fiche validée ne peut être modifié que via la "
                                      "correction kilométrique (voir l'historique du véhicule)."
                })
            if (
                self.instance.status == 'validated'
                and 'current_step' in attrs
                and attrs['current_step'] != self.instance.current_step
            ):
                raise serializers.ValidationError({
                    'current_step': "L'étape d'une fiche validée ne peut pas être modifiée."
                })
            # `'start_date' in attrs` et non `effective_start_date` : ce dernier traite un None
            # explicite comme « non fourni » et ne détecterait pas l'effacement.
            if (
                self.instance.status == 'validated'
                and 'start_date' in attrs
                and attrs['start_date'] is None
            ):
                raise serializers.ValidationError({
                    'start_date': "La date de début d'une fiche validée ne peut pas être effacée : "
                                  "elle date les tâches réalisées."
                })
        else:
            vehicle = attrs.get('vehicle')
            if vehicle is not None and InterventionSheet.objects.filter(vehicle=vehicle, status='open').exists():
                raise serializers.ValidationError({
                    'vehicle': "Une fiche d'intervention est déjà ouverte pour ce véhicule."
                })

        start_date = attrs.get('start_date')
        effective_start_date = start_date if start_date is not None else (self.instance.start_date if self.instance else None)

        start_mileage = attrs.get('start_mileage')
        if start_mileage is not None:
            vehicle = attrs.get('vehicle') or (self.instance.vehicle if self.instance else None)
            if vehicle is not None:
                from garage.models import MileageEntry
                reference = None
                if effective_start_date is not None:
                    reference = (
                        MileageEntry.objects
                        .filter(vehicle=vehicle, date__lte=effective_start_date)
                        .order_by('-date', '-id')
                        .first()
                    )
                if reference is not None:
                    reference_km = reference.value
                    reference_label = f"au kilométrage relevé le {reference.date:%d/%m/%Y}"
                else:
                    reference_km = vehicle.kilometer
                    reference_label = "au kilométrage actuel du véhicule"
                if start_mileage < reference_km:
                    raise serializers.ValidationError({
                        'start_mileage': f"Le kilométrage ({start_mileage}) ne peut pas être inférieur "
                                          f"{reference_label} ({reference_km})."
                    })

        today = timezone.now().date()
        if start_date is not None and start_date > today:
            raise serializers.ValidationError({
                'start_date': "La date de début ne peut pas être postérieure à aujourd'hui."
            })
        end_date = attrs.get('end_date')
        if end_date is not None and end_date > today:
            raise serializers.ValidationError({
                'end_date': "La date de fin ne peut pas être postérieure à aujourd'hui."
            })
        effective_end_date = end_date if end_date is not None else (self.instance.end_date if self.instance else None)
        if (
            (start_date is not None or end_date is not None)
            and effective_start_date is not None
            and effective_end_date is not None
            and effective_end_date < effective_start_date
        ):
            raise serializers.ValidationError({
                'end_date': "La date de fin ne peut pas être antérieure à la date de début."
            })
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        validated_data['status'] = 'open'
        validated_data['current_step'] = 1
        return super().create(validated_data)


# ── Synthèse d'entretien (story 2.10) — sérialiseurs de réponse uniquement ────

class MaintenanceKmAxisSerializer(serializers.Serializer):
    lifespan = serializers.IntegerField()
    due = serializers.IntegerField()
    remaining = serializers.IntegerField()
    progress = serializers.FloatField()
    soon = serializers.IntegerField(allow_null=True)


class MaintenanceMonthsAxisSerializer(serializers.Serializer):
    lifespan = serializers.IntegerField()
    due = serializers.DateField()
    remaining_days = serializers.IntegerField()
    progress = serializers.FloatField()
    soon = serializers.IntegerField(allow_null=True)


class MaintenanceRealizationSerializer(serializers.Serializer):
    sheet_id = serializers.IntegerField()
    task_id = serializers.IntegerField()
    date = serializers.DateField()
    km = serializers.IntegerField(allow_null=True)
    wear_level = serializers.IntegerField(allow_null=True)


class MaintenanceSignalementSerializer(serializers.Serializer):
    task_id = serializers.IntegerField()
    sheet_id = serializers.IntegerField()
    sheet_date = serializers.DateField()
    catalog_task_id = serializers.IntegerField(allow_null=True)
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    source = serializers.ChoiceField(choices=PLANNING_SOURCE_CHOICES)
    photos = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ListField(child=serializers.URLField()))
    def get_photos(self, obj):
        request = self.context.get('request')
        return [request.build_absolute_uri(url) if request is not None else url for url in obj['photos']]


class MaintenancePeriodicitySerializer(serializers.Serializer):
    km = serializers.IntegerField(allow_null=True)
    months = serializers.IntegerField(allow_null=True)


class MaintenanceTaskSerializer(serializers.Serializer):
    catalog_task_id = serializers.IntegerField()
    name = serializers.CharField()
    icon = serializers.ChoiceField(choices=TaskCatalog.ICON_CHOICES)
    periodicity = MaintenancePeriodicitySerializer()
    is_critical = serializers.BooleanField()
    is_wear_task = serializers.BooleanField()
    status = serializers.ChoiceField(choices=TASK_STATUS_CHOICES)
    source = serializers.ChoiceField(choices=PLANNING_SOURCE_CHOICES, allow_null=True)
    last_realization = MaintenanceRealizationSerializer(allow_null=True)
    km = MaintenanceKmAxisSerializer(allow_null=True)
    months = MaintenanceMonthsAxisSerializer(allow_null=True)
    main_axis = serializers.ChoiceField(choices=AXIS_CHOICES, allow_null=True)
    signalements = MaintenanceSignalementSerializer(many=True)


class MaintenanceOtherWorkSerializer(serializers.Serializer):
    key = serializers.CharField()
    catalog_task_id = serializers.IntegerField(allow_null=True)
    name = serializers.CharField()
    icon = serializers.ChoiceField(choices=TaskCatalog.ICON_CHOICES, allow_null=True)
    sheet_id = serializers.IntegerField()
    task_id = serializers.IntegerField()
    date = serializers.DateField()
    km = serializers.IntegerField(allow_null=True)
    wear_level = serializers.IntegerField(allow_null=True)


class MaintenanceSheetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=InterventionSheet.STATUS_CHOICES)
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    start_mileage = serializers.IntegerField(allow_null=True)
    created_by_display = serializers.CharField()
    done_count = serializers.IntegerField()
    planned_count = serializers.IntegerField()


class MaintenanceCountsSerializer(serializers.Serializer):
    overdue = serializers.IntegerField()
    to_plan = serializers.IntegerField()
    up_to_date = serializers.IntegerField()
    not_recorded = serializers.IntegerField()
    other_work = serializers.IntegerField()
    sheets = serializers.IntegerField()


class MaintenanceSummarySerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    current_km = serializers.IntegerField()
    today = serializers.DateField()
    tasks = MaintenanceTaskSerializer(many=True)
    signalements = MaintenanceSignalementSerializer(many=True)
    other_work = MaintenanceOtherWorkSerializer(many=True)
    sheets = MaintenanceSheetSerializer(many=True)
    counts = MaintenanceCountsSerializer()
