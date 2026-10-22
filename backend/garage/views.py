from django.contrib.contenttypes.models import ContentType
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter
from api.views import MUTATION_ACTION
from api.models import Vehicle, Contract
from .models import (
    TaskCatalog, MileageEntry, InterventionSheet, InterventionTask, GaragePhoto,
    InspectionSheet, InspectionTask, InspectionDamage,
)
from .serializers import (
    TaskCatalogSerializer, MileageEntrySerializer, MileageCorrectionSerializer,
    InterventionSheetSerializer, MutationInterventionSheetSerializer,
    InterventionTaskSerializer, MutationInterventionTaskSerializer,
    UpdateInterventionTaskSerializer, AuditLogSerializer, MaintenanceSummarySerializer,
    InspectionSheetSerializer, MutationInspectionSheetSerializer, InspectionTaskSerializer,
    MutationInspectionTaskSerializer, UpdateInspectionTaskSerializer, InspectionDamageSerializer,
    MutationInspectionDamageSerializer, UpdateInspectionDamageSerializer, MeasurableTaskSerializer,
    MaintenanceConfigSerializer, get_measurable_tasks, check_measurements,
)
from .filters import TaskCatalogFilter, InterventionSheetFilter, InspectionSheetFilter
from .mixins import GarageMultiActionMixin
from .sheet_rules import create_sheet_mileage_entry, sync_sheet_mileage_date, chain_root
from .alerts import get_config, load_maintenance_data, compute_maintenance_summary, is_signalement_open
from .audit import (
    log_field_change, log_task_added, log_task_deleted, log_task_dismissed, get_audit_logs_for_sheet,
    format_parts, format_photo_ids, log_damage_added, log_damage_deleted, format_measurements,
    get_audit_logs_for_inspection,
)


SHEET_MODEL_BY_MILEAGE_SOURCE = {'intervention': InterventionSheet, 'inspection': InspectionSheet}


class TaskCatalogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TaskCatalogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = TaskCatalogFilter

    def get_queryset(self):
        return TaskCatalog.objects.filter(archived=False)


class MileageHistoryViewSet(GarageMultiActionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MileageEntry.objects.select_related('author').all()
    serializer_class = MileageEntrySerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        vehicle_pk = self.kwargs.get('vehicle_pk')
        try:
            vehicle = Vehicle.objects.get(pk=vehicle_pk)
        except (Vehicle.DoesNotExist, ValueError):
            raise NotFound()
        user = request.user
        if user.has_perm('garage.view_vehicle'):
            if not user.get_actions().filter(pk=vehicle.action_id).exists():
                raise PermissionDenied()
        else:
            if vehicle.action_id != user.current_action_id:
                raise PermissionDenied()

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(vehicle_id=self.kwargs['vehicle_pk'])

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        entries = page if page is not None else queryset
        contract_ids = [
            entry.source_id for entry in entries
            if entry.source in MileageEntrySerializer.CONTRACT_SOURCES and entry.source_id
        ]
        contracts_by_id = {
            contract.id: contract
            for contract in Contract.objects.filter(pk__in=contract_ids).select_related('beneficiary')
        }
        serializer = self.get_serializer(entries, many=True, context={**self.get_serializer_context(), 'contracts_by_id': contracts_by_id})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @extend_schema(request=MileageCorrectionSerializer, responses=MileageEntrySerializer)
    @action(detail=False, methods=['post'], url_path='correct')
    def correct(self, request, vehicle_pk=None):
        if not request.user.has_perm('garage.correct_mileage'):
            raise PermissionDenied()

        serializer = MileageCorrectionSerializer(
            data=request.data, context={'vehicle_pk': vehicle_pk}
        )
        serializer.is_valid(raise_exception=True)
        original = serializer.validated_data['entry']

        if original.is_corrected:
            raise serializers.ValidationError({'entry': "Cette entrée est déjà corrigée."})

        with transaction.atomic():
            correction = MileageEntry.objects.create(
                vehicle_id=vehicle_pk,
                value=serializer.validated_data['value'],
                date=original.date,
                source='correction',
                author=request.user,
                corrects=original,
                correction_reason=serializer.validated_data['reason'],
            )
            original.is_corrected = True
            original.save(update_fields=['is_corrected'])

            # Le km d'une fiche validée ne se corrige que par ici : la fiche suit la correction,
            # sinon l'échéance km de ses tâches reste calculée sur la valeur erronée.
            root = chain_root(original)
            sheet_model = SHEET_MODEL_BY_MILEAGE_SOURCE.get(root.source)
            if sheet_model is not None and root.source_id:
                sheet_model.objects.filter(pk=root.source_id).update(start_mileage=correction.value)

            latest = MileageEntry.objects.filter(
                vehicle_id=vehicle_pk, is_corrected=False
            ).order_by('-date', '-id').first()
            if latest:
                Vehicle.objects.filter(pk=vehicle_pk).update(kilometer=latest.value)

        return Response(MileageEntrySerializer(correction).data, status=201)


def dismiss_signalement(request, sheet, task, kind):
    """Écarte un signalement (tâche « à prévoir » d'une fiche d'intervention ou de contrôle validée)."""
    if sheet.status != 'validated':
        raise serializers.ValidationError("Seuls les signalements d'une fiche validée peuvent être écartés.")
    if task.dismissed_at is not None:
        raise serializers.ValidationError("Ce signalement est déjà écarté.")
    if not is_signalement_open(sheet.vehicle, kind, task.id):
        raise serializers.ValidationError("Ce signalement est déjà clos par une réalisation ultérieure.")
    task.dismissed_at = timezone.now()
    task.dismissed_by = request.user
    task.save(update_fields=['dismissed_at', 'dismissed_by'])
    log_task_dismissed(task, request.user)


class InterventionSheetViewSet(GarageMultiActionMixin, viewsets.ModelViewSet):
    queryset = InterventionSheet.objects.select_related('vehicle', 'created_by').prefetch_related('tasks__parts').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, DjangoFilterBackend]
    search_fields = ['vehicle__imat', 'vehicle__brand', 'vehicle__modele', 'created_by__first_name', 'created_by__last_name']
    filterset_class = InterventionSheetFilter

    def get_serializer_class(self):
        if self.action in MUTATION_ACTION:
            return MutationInterventionSheetSerializer
        return InterventionSheetSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'tasks', 'task_detail', 'validate',
                           'dismiss_task') \
                and not request.user.has_perm('garage.manage_intervention'):
            raise PermissionDenied()

    def perform_update(self, serializer):
        instance = serializer.instance
        was_validated = instance.status == 'validated'
        snapshot = {f: getattr(instance, f) for f in ('start_date', 'end_date')} if was_validated else {}
        updated = serializer.save()
        if was_validated:
            for field, old in snapshot.items():
                log_field_change(updated, field, old, getattr(updated, field), self.request.user)

    @action(detail=True, methods=['post'], url_path='tasks')
    @transaction.atomic
    def tasks(self, request, pk=None):
        sheet = self.get_object()
        serializer = MutationInterventionTaskSerializer(data=request.data, context={'sheet': sheet})
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        if sheet.status == 'validated':
            log_task_added(task, request.user)
        return Response(InterventionTaskSerializer(task, context=self.get_serializer_context()).data, status=201)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'tasks/(?P<task_pk>[^/.]+)')
    @transaction.atomic
    def task_detail(self, request, pk=None, task_pk=None):
        sheet = self.get_object()
        task = get_object_or_404(InterventionTask, pk=task_pk, sheet=sheet)
        was_validated = sheet.status == 'validated'
        if request.method == 'DELETE':
            content_type = ContentType.objects.get_for_model(InterventionTask)
            for photo in GaragePhoto.objects.filter(content_type=content_type, object_id=task.pk):
                photo.image.delete(save=False)
                photo.delete()
            if was_validated:
                log_task_deleted(task, request.user)
            task.delete()
            return Response(status=204)
        snapshot = {
            'name': task.name, 'description': task.description, 'wear_level': task.wear_level,
            'parts': list(task.parts.values('name', 'unit_price', 'quantity')),
        } if was_validated else None
        photo_ids_before = set(
            GaragePhoto.objects.filter(content_type=ContentType.objects.get_for_model(InterventionTask), object_id=task.pk)
            .values_list('id', flat=True)
        ) if was_validated else set()
        serializer = UpdateInterventionTaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if was_validated:
            for field in ('name', 'description', 'wear_level'):
                if field in serializer.validated_data:
                    log_field_change(task, field, snapshot[field], getattr(task, field), request.user)
            if 'parts' in serializer.validated_data:
                new_parts = list(task.parts.values('name', 'unit_price', 'quantity'))
                log_field_change(task, 'parts', format_parts(snapshot['parts']), format_parts(new_parts), request.user)
            photo_ids_after = set(
                GaragePhoto.objects.filter(content_type=ContentType.objects.get_for_model(InterventionTask), object_id=task.pk)
                .values_list('id', flat=True)
            )
            if photo_ids_before != photo_ids_after:
                log_field_change(
                    task, 'photos', format_photo_ids(photo_ids_before), format_photo_ids(photo_ids_after),
                    request.user,
                )
        return Response(InterventionTaskSerializer(task, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        sheet = self.get_object()
        logs = get_audit_logs_for_sheet(sheet)
        return Response(AuditLogSerializer(logs, many=True).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=['post'], url_path=r'tasks/(?P<task_pk>\d+)/dismiss')
    @transaction.atomic
    def dismiss_task(self, request, pk=None, task_pk=None):
        sheet = self.get_object()
        task = get_object_or_404(InterventionTask.objects.select_for_update(), pk=task_pk, sheet=sheet)
        if task.type != 'planned':
            raise serializers.ValidationError("Seule une tâche à prévoir peut être écartée.")
        dismiss_signalement(request, sheet, task, 'intervention')
        return Response(status=204)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate(self, request, pk=None):
        sheet = self.get_object()

        with transaction.atomic():
            sheet = InterventionSheet.objects.select_for_update().get(pk=sheet.pk)
            if sheet.status == 'validated':
                raise serializers.ValidationError("Cette fiche est déjà validée.")
            if sheet.start_mileage is None:
                raise serializers.ValidationError("Le kilométrage de départ est requis avant de valider la fiche.")
            if sheet.start_date is None:
                raise serializers.ValidationError("La date de début est requise avant de valider la fiche.")

            sheet.status = 'validated'
            sheet.save(update_fields=['status'])

            warnings = create_sheet_mileage_entry(sheet, 'intervention', request.user)

        data = InterventionSheetSerializer(sheet, context=self.get_serializer_context()).data
        data['warnings'] = warnings
        return Response(data)


def _delete_photo(photo):
    """Supprime la photo en base ; le fichier part seulement si la transaction est validée."""
    storage, name = photo.image.storage, photo.image.name
    photo.delete()
    transaction.on_commit(lambda: storage.delete(name))


def _vehicle_in_scope(user, vehicle):
    if user.has_perm('garage.view_vehicle'):
        return user.get_actions().filter(pk=vehicle.action_id).exists()
    return vehicle.action_id == user.current_action_id


class InspectionSheetViewSet(GarageMultiActionMixin, viewsets.ModelViewSet):
    queryset = InspectionSheet.objects.select_related('vehicle', 'created_by').prefetch_related(
        'wear_measurements__catalog_task', 'damages', 'tasks',
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, DjangoFilterBackend]
    search_fields = ['vehicle__imat', 'vehicle__brand', 'vehicle__modele', 'created_by__first_name', 'created_by__last_name']
    filterset_class = InspectionSheetFilter

    MANAGE_ACTIONS = ('create', 'update', 'partial_update', 'destroy', 'tasks', 'task_detail', 'damages',
                      'damage_detail', 'validate', 'measurable_tasks')

    def get_serializer_class(self):
        if self.action in MUTATION_ACTION:
            return MutationInspectionSheetSerializer
        return InspectionSheetSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            cutoff = timezone.now() - timedelta(hours=get_config().inspection_open_max_hours)
            queryset = queryset.filter(Q(status='validated') | Q(created_at__gt=cutoff))
        return queryset

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in self.MANAGE_ACTIONS and not request.user.has_perm('garage.manage_inspection'):
            raise PermissionDenied()
        if self.action == 'dismiss_task' and not request.user.has_perm('garage.manage_intervention'):
            raise PermissionDenied()

    @staticmethod
    def _ensure_not_expired(sheet):
        if sheet.is_expired(get_config()):
            raise serializers.ValidationError("Cette fiche de contrôle a expiré : elle ne peut plus être modifiée.")

    def _ensure_editable(self, sheet):
        """Fiche expirée refusée ; fiche validée modifiable dans le délai, puis par les seuls responsables."""
        self._ensure_not_expired(sheet)
        config = get_config()
        deadline = sheet.edit_deadline(config)
        if (deadline is not None and timezone.now() > deadline
                and not self.request.user.has_perm('garage.edit_validated_inspection')):
            days = config.inspection_edit_days
            raise PermissionDenied(
                f"Cette fiche a été validée il y a plus de {days} {'jour' if days == 1 else 'jours'} : "
                f"seule une personne responsable peut la modifier."
            )

    def update(self, request, *args, **kwargs):
        self._ensure_editable(self.get_object())
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        sheet = self.get_object()
        if sheet.status != 'open':
            raise serializers.ValidationError("Une fiche de contrôle validée ne peut pas être supprimée.")
        with transaction.atomic():
            for model in (InspectionTask, InspectionDamage):
                ids = list(model.objects.filter(sheet=sheet).values_list('id', flat=True))
                for photo in GaragePhoto.objects.filter(
                    content_type=ContentType.objects.get_for_model(model), object_id__in=ids,
                ):
                    _delete_photo(photo)
            return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        was_validated = instance.status == 'validated'
        fields = ('start_date', 'oil_ok', 'coolant_ok', 'washer_ok', 'lights_ok', 'lights_notes',
                  'road_test_done', 'road_test_notes')

        def measurements():
            return [(m.catalog_task.name, m.level) for m in instance.wear_measurements.select_related('catalog_task')]

        snapshot = {f: getattr(instance, f) for f in fields} if was_validated else {}
        measurements_before = measurements() if was_validated else []
        updated = serializer.save()
        if was_validated:
            for field, old in snapshot.items():
                log_field_change(updated, field, old, getattr(updated, field), self.request.user)
            if updated.start_date != snapshot['start_date']:
                sync_sheet_mileage_date(updated, 'inspection')
            if 'wear_measurements' in serializer.validated_data:
                log_field_change(
                    updated, 'wear_measurements', format_measurements(measurements_before),
                    format_measurements(measurements()), self.request.user,
                )

    @extend_schema(
        parameters=[OpenApiParameter('vehicle', int, OpenApiParameter.QUERY, required=True)],
        responses=MeasurableTaskSerializer(many=True),
    )
    @action(detail=False, methods=['get'], url_path='measurable-tasks')
    def measurable_tasks(self, request):
        try:
            vehicle_id = int(request.query_params.get('vehicle', ''))
        except ValueError:
            raise serializers.ValidationError({'vehicle': "Le paramètre vehicle est requis (identifiant numérique)."})
        vehicle = Vehicle.objects.filter(pk=vehicle_id).first()
        if vehicle is None or not _vehicle_in_scope(request.user, vehicle):
            raise NotFound()
        return Response(MeasurableTaskSerializer(get_measurable_tasks(vehicle), many=True).data)

    @extend_schema(request=MutationInspectionTaskSerializer, responses={201: InspectionTaskSerializer})
    @action(detail=True, methods=['post'], url_path='tasks')
    @transaction.atomic
    def tasks(self, request, pk=None):
        sheet = self.get_object()
        self._ensure_editable(sheet)
        serializer = MutationInspectionTaskSerializer(data=request.data, context={'sheet': sheet})
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        if sheet.status == 'validated':
            log_task_added(task, request.user)
        return Response(InspectionTaskSerializer(task, context=self.get_serializer_context()).data, status=201)

    @extend_schema(request=UpdateInspectionTaskSerializer, responses={200: InspectionTaskSerializer, 204: None})
    @action(detail=True, methods=['patch', 'delete'], url_path=r'tasks/(?P<task_pk>\d+)')
    @transaction.atomic
    def task_detail(self, request, pk=None, task_pk=None):
        sheet = self.get_object()
        self._ensure_editable(sheet)
        task = get_object_or_404(InspectionTask, pk=task_pk, sheet=sheet)
        return self._item_detail(
            request, sheet, task, UpdateInspectionTaskSerializer, InspectionTaskSerializer,
            ('name', 'description'), log_task_deleted,
        )

    @extend_schema(request=MutationInspectionDamageSerializer, responses={201: InspectionDamageSerializer})
    @action(detail=True, methods=['post'], url_path='damages')
    @transaction.atomic
    def damages(self, request, pk=None):
        sheet = self.get_object()
        self._ensure_editable(sheet)
        serializer = MutationInspectionDamageSerializer(data=request.data, context={'sheet': sheet})
        serializer.is_valid(raise_exception=True)
        damage = serializer.save()
        if sheet.status == 'validated':
            log_damage_added(damage, request.user)
        return Response(InspectionDamageSerializer(damage, context=self.get_serializer_context()).data, status=201)

    @extend_schema(request=UpdateInspectionDamageSerializer, responses={200: InspectionDamageSerializer, 204: None})
    @action(detail=True, methods=['patch', 'delete'], url_path=r'damages/(?P<damage_pk>\d+)')
    @transaction.atomic
    def damage_detail(self, request, pk=None, damage_pk=None):
        sheet = self.get_object()
        self._ensure_editable(sheet)
        damage = get_object_or_404(InspectionDamage, pk=damage_pk, sheet=sheet)
        return self._item_detail(
            request, sheet, damage, UpdateInspectionDamageSerializer, InspectionDamageSerializer,
            ('description',), log_damage_deleted,
        )

    def _item_detail(self, request, sheet, item, update_serializer, read_serializer, fields, log_deleted):
        """PATCH / DELETE d'une tâche ou d'un dégât, tracé si la fiche est validée."""
        model = type(item)
        content_type = ContentType.objects.get_for_model(model)
        was_validated = sheet.status == 'validated'
        if request.method == 'DELETE':
            for photo in GaragePhoto.objects.filter(content_type=content_type, object_id=item.pk):
                _delete_photo(photo)
            if was_validated:
                log_deleted(item, request.user)
            item.delete()
            return Response(status=204)

        def photo_ids():
            return set(
                GaragePhoto.objects.filter(content_type=content_type, object_id=item.pk).values_list('id', flat=True)
            )

        snapshot = {f: getattr(item, f) for f in fields}
        photos_before = photo_ids() if was_validated else set()
        serializer = update_serializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if was_validated:
            for field in fields:
                if field in serializer.validated_data:
                    log_field_change(item, field, snapshot[field], getattr(item, field), request.user)
            photos_after = photo_ids()
            if photos_before != photos_after:
                log_field_change(
                    item, 'photos', format_photo_ids(photos_before), format_photo_ids(photos_after), request.user,
                )
        return Response(read_serializer(item, context=self.get_serializer_context()).data)

    @extend_schema(responses=AuditLogSerializer(many=True))
    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        sheet = self.get_object()
        return Response(AuditLogSerializer(get_audit_logs_for_inspection(sheet), many=True).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=['post'], url_path=r'tasks/(?P<task_pk>\d+)/dismiss')
    @transaction.atomic
    def dismiss_task(self, request, pk=None, task_pk=None):
        sheet = self.get_object()
        task = get_object_or_404(InspectionTask.objects.select_for_update(), pk=task_pk, sheet=sheet)
        dismiss_signalement(request, sheet, task, 'inspection')
        return Response(status=204)

    @extend_schema(request=None, responses=InspectionSheetSerializer)
    @action(detail=True, methods=['post'], url_path='validate')
    def validate(self, request, pk=None):
        sheet = self.get_object()

        with transaction.atomic():
            sheet = InspectionSheet.objects.select_for_update().select_related('vehicle').get(pk=sheet.pk)
            if sheet.status == 'validated':
                raise serializers.ValidationError("Cette fiche est déjà validée.")
            self._ensure_not_expired(sheet)
            if sheet.start_mileage is None:
                raise serializers.ValidationError("Le kilométrage est requis avant de valider la fiche.")
            if sheet.start_date is None:
                raise serializers.ValidationError("La date est requise avant de valider la fiche.")
            measurements = list(sheet.wear_measurements.select_related('catalog_task'))
            check_measurements(sheet.vehicle, [{'catalog_task': m.catalog_task, 'level': m.level} for m in measurements])
            measured_ids = {m.catalog_task_id for m in measurements}
            missing = [task.name for task in get_measurable_tasks(sheet.vehicle) if task.id not in measured_ids]
            if missing:
                raise serializers.ValidationError({
                    'wear_measurements': "Toutes les usures doivent être mesurées avant de valider la fiche. "
                                         f"Manquantes : {', '.join(missing)}."
                })

            sheet.status = 'validated'
            sheet.validated_at = timezone.now()
            sheet.save(update_fields=['status', 'validated_at'])
            warnings = create_sheet_mileage_entry(sheet, 'inspection', request.user)

        data = InspectionSheetSerializer(sheet, context=self.get_serializer_context()).data
        data['warnings'] = warnings
        return Response(data)


class GarageConfigView(APIView):
    """Seuils d'usure exposés au front (plus de valeurs codées en dur)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=MaintenanceConfigSerializer)
    def get(self, request):
        return Response(MaintenanceConfigSerializer(get_config()).data)


class MaintenanceViewSet(viewsets.ViewSet):
    """Synthèse d'entretien par tâche d'un véhicule (story 2.10). Calcul : garage/alerts.py."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter('id', int, OpenApiParameter.PATH, description="Identifiant du véhicule")],
        responses=MaintenanceSummarySerializer,
    )
    def retrieve(self, request, pk=None):
        user = request.user
        if not user.has_perm('garage.view_vehicle'):
            raise PermissionDenied()
        try:
            vehicle = Vehicle.objects.get(pk=pk)
        except (Vehicle.DoesNotExist, ValueError):
            raise NotFound()
        if not user.get_actions().filter(pk=vehicle.action_id).exists():
            raise PermissionDenied()
        data = load_maintenance_data([vehicle])
        summary = compute_maintenance_summary(data, vehicle, timezone.localdate(), get_config())
        return Response(MaintenanceSummarySerializer(summary, context={'request': request}).data)
