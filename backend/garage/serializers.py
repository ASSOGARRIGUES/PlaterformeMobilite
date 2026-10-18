from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from drf_extra_fields.fields import Base64ImageField
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from api.models import Contract, Vehicle
from api.serializers import VehicleSerializer, UserSerializer
from .models import (
    TaskCatalog, MileageEntry, InterventionSheet, InterventionTask, InterventionTaskPart, GaragePhoto, AuditLog,
    InspectionSheet, InspectionTask, InspectionDamage, InspectionWearMeasurement, MaintenanceConfig,
)
from .sheet_rules import check_start_mileage, check_start_date_not_future, sheet_mileage_chain
from .alerts import get_config, TASK_STATUS_CHOICES, PLANNING_SOURCE_CHOICES, AXIS_CHOICES, SHEET_KIND_CHOICES


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
                check_start_mileage(vehicle, start_mileage, effective_start_date)

        check_start_date_not_future(start_date)
        today = timezone.localdate()
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


# ── Fiche de contrôle (story 3.1) ────────────────────────────────────────────

def _photos_of(instance, request):
    photos = GaragePhoto.objects.filter(
        content_type=ContentType.objects.get_for_model(type(instance)), object_id=instance.pk,
    )
    return [
        {'id': photo.id, 'url': request.build_absolute_uri(photo.image.url) if request is not None else photo.image.url}
        for photo in photos
    ]


def _add_photos(instance, images):
    content_type = ContentType.objects.get_for_model(type(instance))
    for image in images:
        GaragePhoto.objects.create(image=image, content_type=content_type, object_id=instance.pk)


def _remove_photos(instance, photo_ids):
    content_type = ContentType.objects.get_for_model(type(instance))
    for photo in GaragePhoto.objects.filter(pk__in=photo_ids, content_type=content_type, object_id=instance.pk):
        photo.image.delete(save=False)
        photo.delete()


def get_measurable_tasks(vehicle):
    """Tâches du catalogue mesurées en contrôle, non archivées et applicables au type du véhicule.

    Filtre du type en Python (comme alerts.py) : le filtre JSON de SQLite est fragile.
    """
    tasks = TaskCatalog.objects.filter(measured_in_inspection=True, archived=False).order_by('name', 'id')
    return [task for task in tasks if vehicle.type in (task.vehicle_types or [])]


class MeasurableTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'icon']


class InspectionWearMeasurementSerializer(serializers.ModelSerializer):
    catalog_task_name = serializers.CharField(source='catalog_task.name', read_only=True)
    catalog_task_icon = serializers.ChoiceField(source='catalog_task.icon', choices=TaskCatalog.ICON_CHOICES, read_only=True)

    class Meta:
        model = InspectionWearMeasurement
        fields = ['id', 'catalog_task', 'catalog_task_name', 'catalog_task_icon', 'level']


class InspectionDamageSerializer(serializers.ModelSerializer):
    photos = serializers.SerializerMethodField()

    @extend_schema_field(GaragePhotoSerializer(many=True))
    def get_photos(self, obj):
        return _photos_of(obj, self.context.get('request'))

    class Meta:
        model = InspectionDamage
        fields = ['id', 'sheet', 'description', 'photos']
        read_only_fields = ['sheet']


class InspectionTaskSerializer(serializers.ModelSerializer):
    photos = serializers.SerializerMethodField()

    @extend_schema_field(GaragePhotoSerializer(many=True))
    def get_photos(self, obj):
        return _photos_of(obj, self.context.get('request'))

    class Meta:
        model = InspectionTask
        fields = ['id', 'sheet', 'catalog_task', 'name', 'description', 'dismissed_at', 'photos']
        read_only_fields = ['sheet', 'dismissed_at']


class MutationInspectionTaskSerializer(serializers.ModelSerializer):
    photos = serializers.ListField(child=Base64ImageField(), required=False, write_only=True)

    class Meta:
        model = InspectionTask
        fields = ['id', 'catalog_task', 'name', 'description', 'photos']

    def validate(self, attrs):
        catalog_task = attrs.get('catalog_task')
        if not catalog_task and not (attrs.get('name') or '').strip():
            raise serializers.ValidationError({'name': "Le nom est requis pour une tâche libre."})
        if catalog_task:
            vehicle = self.context['sheet'].vehicle
            if catalog_task.archived or vehicle.type not in (catalog_task.vehicle_types or []):
                raise serializers.ValidationError({
                    'catalog_task': f"« {catalog_task.name} » n'est pas disponible pour ce véhicule."
                })
            attrs['name'] = ''
        return attrs

    def create(self, validated_data):
        photos = validated_data.pop('photos', [])
        with transaction.atomic():
            task = InspectionTask.objects.create(sheet=self.context['sheet'], **validated_data)
            _add_photos(task, photos)
        return task


class UpdateInspectionTaskSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    add_photos = serializers.ListField(child=Base64ImageField(), required=False)
    remove_photo_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate(self, attrs):
        if 'name' in attrs and not attrs['name'].strip() and not self.instance.catalog_task:
            raise serializers.ValidationError({'name': "Le nom est requis pour une tâche libre."})
        return attrs

    def update(self, instance, validated_data):
        with transaction.atomic():
            _remove_photos(instance, validated_data.get('remove_photo_ids', []))
            _add_photos(instance, validated_data.get('add_photos', []))
            for field in ('name', 'description'):
                if field in validated_data:
                    setattr(instance, field, validated_data[field])
            instance.save()
        return instance


class MutationInspectionDamageSerializer(serializers.ModelSerializer):
    photos = serializers.ListField(child=Base64ImageField(), required=False, write_only=True)

    class Meta:
        model = InspectionDamage
        fields = ['id', 'description', 'photos']

    def create(self, validated_data):
        photos = validated_data.pop('photos', [])
        with transaction.atomic():
            damage = InspectionDamage.objects.create(sheet=self.context['sheet'], **validated_data)
            _add_photos(damage, photos)
        return damage


class UpdateInspectionDamageSerializer(serializers.Serializer):
    description = serializers.CharField(required=False)
    add_photos = serializers.ListField(child=Base64ImageField(), required=False)
    remove_photo_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def update(self, instance, validated_data):
        with transaction.atomic():
            _remove_photos(instance, validated_data.get('remove_photo_ids', []))
            _add_photos(instance, validated_data.get('add_photos', []))
            if 'description' in validated_data:
                instance.description = validated_data['description']
                instance.save()
        return instance


class InspectionMileageEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    value = serializers.IntegerField()


class InspectionSheetSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    wear_measurements = InspectionWearMeasurementSerializer(many=True, read_only=True)
    damages = InspectionDamageSerializer(many=True, read_only=True)
    tasks = InspectionTaskSerializer(many=True, read_only=True)
    is_expired = serializers.SerializerMethodField()
    expires_at = serializers.SerializerMethodField()
    mileage_entry = serializers.SerializerMethodField()

    def _config(self):
        # self.context est partagé avec le sérialiseur racine : une seule lecture de la config par requête
        return self.context.setdefault('maintenance_config', get_config())

    @extend_schema_field(InspectionMileageEntrySerializer(allow_null=True))
    def get_mileage_entry(self, obj):
        """Relevé km courant (non corrigé) de la fiche validée : celui que la correction kilométrique vise."""
        if obj.status != 'validated':
            return None
        chain = sheet_mileage_chain('inspection', obj.id)
        return {'id': chain[-1].id, 'value': chain[-1].value} if chain else None

    def get_is_expired(self, obj) -> bool:
        return obj.is_expired(self._config())

    def get_expires_at(self, obj) -> serializers.DateTimeField(allow_null=True):
        return obj.expires_at(self._config()) if obj.status == 'open' else None

    class Meta:
        model = InspectionSheet
        fields = ['id', 'vehicle', 'created_by', 'current_step', 'status', 'start_mileage', 'start_date',
                  'oil_ok', 'coolant_ok', 'washer_ok', 'lights_ok', 'lights_notes', 'road_test_done',
                  'road_test_notes', 'validated_at', 'created_at', 'updated_at', 'is_expired', 'expires_at',
                  'mileage_entry', 'wear_measurements', 'damages', 'tasks']
        read_only_fields = ['validated_at']


class MutationWearMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionWearMeasurement
        fields = ['catalog_task', 'level']
        validators = []  # l'unicité (fiche, tâche) est contrôlée dans la fiche


def check_measurements_complete(measurements):
    """En PATCH (partial), DRF dispense les champs imbriqués d'être renseignés : on les exige ici."""
    if any('catalog_task' not in m or 'level' not in m for m in measurements):
        raise serializers.ValidationError({
            'wear_measurements': "Chaque mesure doit indiquer la tâche et un niveau d'usure."
        })


def check_measurements(vehicle, measurements, unchanged_ids=frozenset()):
    """Chaque mesure doit viser une tâche mesurée en contrôle, applicable au véhicule, une seule fois.

    `unchanged_ids` : tâches dont la mesure est déjà enregistrée à l'identique, dispensées du contrôle
    d'éligibilité (une tâche archivée depuis ne doit pas bloquer l'édition de la fiche).
    """
    allowed_ids = {task.id for task in get_measurable_tasks(vehicle)}
    seen = set()
    for measurement in measurements:
        task = measurement['catalog_task']
        if task.id not in allowed_ids and task.id not in unchanged_ids:
            raise serializers.ValidationError({
                'wear_measurements': f"« {task.name} » ne peut pas être mesurée en contrôle pour ce véhicule."
            })
        if task.id in seen:
            raise serializers.ValidationError({
                'wear_measurements': f"« {task.name} » est mesurée plusieurs fois."
            })
        seen.add(task.id)


class MutationInspectionSheetSerializer(serializers.ModelSerializer):
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.none())
    current_step = serializers.IntegerField(min_value=1, max_value=7, required=False)
    wear_measurements = MutationWearMeasurementSerializer(many=True, required=False)

    class Meta:
        model = InspectionSheet
        fields = ['id', 'vehicle', 'current_step', 'status', 'start_mileage', 'start_date', 'oil_ok', 'coolant_ok',
                  'washer_ok', 'lights_ok', 'lights_notes', 'road_test_done', 'road_test_notes',
                  'wear_measurements']
        read_only_fields = ['status']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:  # anonyme : génération du schéma OpenAPI
            user = request.user
            if user.has_perm('garage.view_vehicle'):
                self.fields['vehicle'].queryset = Vehicle.objects.filter(action__in=user.get_actions())
            else:
                self.fields['vehicle'].queryset = Vehicle.objects.filter(action=user.current_action)

    def validate(self, attrs):
        validated = self.instance is not None and self.instance.status == 'validated'
        if self.instance:
            if 'vehicle' in attrs and attrs['vehicle'] != self.instance.vehicle:
                raise serializers.ValidationError({
                    'vehicle': "Le véhicule d'une fiche ne peut pas être modifié après sa création."
                })
            if validated and 'start_mileage' in attrs and attrs['start_mileage'] != self.instance.start_mileage:
                raise serializers.ValidationError({
                    'start_mileage': "Le kilométrage d'une fiche validée ne peut être modifié que via la "
                                      "correction kilométrique (voir l'historique du véhicule)."
                })
            if validated and 'current_step' in attrs and attrs['current_step'] != self.instance.current_step:
                raise serializers.ValidationError({
                    'current_step': "L'étape d'une fiche validée ne peut pas être modifiée."
                })
            if validated and 'start_date' in attrs and attrs['start_date'] is None:
                raise serializers.ValidationError({
                    'start_date': "La date de début d'une fiche validée ne peut pas être effacée."
                })
        else:
            self._check_no_open_sheet(attrs.get('vehicle'))

        vehicle = attrs.get('vehicle') or (self.instance.vehicle if self.instance else None)
        start_date = attrs.get('start_date')
        if start_date is not None:
            effective_start_date = start_date
        else:
            effective_start_date = self.instance.start_date if self.instance else timezone.localdate()
        start_mileage = attrs.get('start_mileage', self.instance.start_mileage if self.instance else None)
        if start_mileage is not None and vehicle is not None and ('start_mileage' in attrs or 'start_date' in attrs):
            check_start_mileage(vehicle, start_mileage, effective_start_date)
        check_start_date_not_future(start_date)
        if 'wear_measurements' in attrs and vehicle is not None:
            check_measurements_complete(attrs['wear_measurements'])
            unchanged_ids = set()
            if self.instance:
                existing = {(m.catalog_task_id, m.level) for m in self.instance.wear_measurements.all()}
                unchanged_ids = {
                    m['catalog_task'].id for m in attrs['wear_measurements']
                    if (m['catalog_task'].id, m['level']) in existing
                }
            if validated:
                kept = {m['catalog_task'].id for m in attrs['wear_measurements']}
                removed = [m.catalog_task.name for m in self.instance.wear_measurements.all()
                           if m.catalog_task_id not in kept]
                if removed:
                    raise serializers.ValidationError({
                        'wear_measurements': f"La mesure « {removed[0]} » ne peut pas être retirée d'une fiche validée."
                    })
            check_measurements(vehicle, attrs['wear_measurements'], unchanged_ids)
        return attrs

    @staticmethod
    def _check_no_open_sheet(vehicle):
        if vehicle is None:
            return
        config = get_config()
        open_sheets = InspectionSheet.objects.filter(vehicle=vehicle, status='open')
        if any(not sheet.is_expired(config) for sheet in open_sheets):
            raise serializers.ValidationError({'vehicle': "Une fiche de contrôle est déjà ouverte pour ce véhicule."})

    def create(self, validated_data):
        measurements = validated_data.pop('wear_measurements', [])
        validated_data['created_by'] = self.context['request'].user
        validated_data['status'] = 'open'
        validated_data.setdefault('current_step', 1)
        if validated_data.get('start_date') is None:
            validated_data['start_date'] = timezone.localdate()
        with transaction.atomic():
            # Verrou sur le véhicule : deux créations simultanées ne peuvent pas ouvrir deux fiches.
            vehicle = Vehicle.objects.select_for_update().get(pk=validated_data['vehicle'].pk)
            self._check_no_open_sheet(vehicle)
            sheet = super().create(validated_data)
            self._replace_measurements(sheet, measurements)
        return sheet

    def update(self, instance, validated_data):
        measurements = validated_data.pop('wear_measurements', None)
        with transaction.atomic():
            sheet = super().update(instance, validated_data)
            if measurements is not None:
                self._replace_measurements(sheet, measurements)
        return sheet

    @staticmethod
    def _replace_measurements(sheet, measurements):
        sheet.wear_measurements.all().delete()
        InspectionWearMeasurement.objects.bulk_create(
            InspectionWearMeasurement(sheet=sheet, catalog_task=m['catalog_task'], level=m['level'])
            for m in measurements
        )


class MaintenanceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceConfig
        fields = ['wear_alert_threshold', 'wear_critical_threshold', 'inspection_edit_days']


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
    sheet_kind = serializers.ChoiceField(choices=SHEET_KIND_CHOICES)
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


class MaintenanceMeasurementSerializer(serializers.Serializer):
    sheet_id = serializers.IntegerField()
    date = serializers.DateField()
    km = serializers.IntegerField(allow_null=True)
    level = serializers.IntegerField()


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
    last_measurement = MaintenanceMeasurementSerializer(allow_null=True)
    measure_prevails = serializers.BooleanField()
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
