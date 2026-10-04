from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter
from api.views import MUTATION_ACTION
from api.models import Vehicle, Contract
from .models import TaskCatalog, MileageEntry, InterventionSheet, InterventionTask, GaragePhoto
from .serializers import (
    TaskCatalogSerializer, MileageEntrySerializer, MileageCorrectionSerializer,
    InterventionSheetSerializer, MutationInterventionSheetSerializer,
    InterventionTaskSerializer, MutationInterventionTaskSerializer,
    UpdateInterventionTaskSerializer, AuditLogSerializer, MaintenanceSummarySerializer,
)
from .filters import TaskCatalogFilter, InterventionSheetFilter
from .mixins import GarageMultiActionMixin
from .alerts import get_config, load_maintenance_data, compute_maintenance_summary
from .audit import (
    log_field_change, log_task_added, log_task_deleted, get_audit_logs_for_sheet,
    format_parts, format_photo_ids,
)


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
            if not user.actions.filter(pk=vehicle.action_id).exists():
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
            root = original
            while root.corrects_id:
                root = root.corrects
            if root.source == 'intervention' and root.source_id:
                InterventionSheet.objects.filter(pk=root.source_id).update(start_mileage=correction.value)

            latest = MileageEntry.objects.filter(
                vehicle_id=vehicle_pk, is_corrected=False
            ).order_by('-date', '-id').first()
            if latest:
                Vehicle.objects.filter(pk=vehicle_pk).update(kilometer=latest.value)

        return Response(MileageEntrySerializer(correction).data, status=201)


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
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'tasks', 'task_detail', 'validate') \
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

            # Le kilométrage saisi est celui à l'entrée du véhicule : le relevé est daté à la date
            # de début (et non de fin), sans quoi une fiche antidatée sans date de fin serait datée
            # d'aujourd'hui et ferait reculer Vehicle.kilometer.
            mileage_date = sheet.start_date
            mileage_entry = MileageEntry.objects.create(
                vehicle=sheet.vehicle,
                value=sheet.start_mileage,
                date=mileage_date,
                source='intervention',
                source_id=sheet.id,
                author=request.user,
            )

            more_recent_entry = (
                MileageEntry.objects
                .filter(vehicle=sheet.vehicle)
                .exclude(pk=mileage_entry.pk)
                .order_by('-date', '-id')
                .first()
            )
            warnings = []
            if more_recent_entry and (more_recent_entry.date, more_recent_entry.id) > (mileage_date, mileage_entry.id):
                warnings.append({
                    'code': 'mileage_not_applied',
                    'message': f"Le kilométrage du véhicule n'a pas été mis à jour : une saisie plus récente "
                               f"({more_recent_entry.value} km au {more_recent_entry.date:%d/%m/%Y}) existe déjà. "
                               f"Si l'une des deux valeurs est erronée, corrigez-la depuis l'historique kilométrique "
                               f"du véhicule.",
                    'more_recent_entry': {
                        'value': more_recent_entry.value,
                        'date': more_recent_entry.date.isoformat(),
                    },
                })

        data = InterventionSheetSerializer(sheet, context=self.get_serializer_context()).data
        data['warnings'] = warnings
        return Response(data)


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
        if not user.actions.filter(pk=vehicle.action_id).exists():
            raise PermissionDenied()
        data = load_maintenance_data([vehicle])
        summary = compute_maintenance_summary(data, vehicle, timezone.localdate(), get_config())
        return Response(MaintenanceSummarySerializer(summary, context={'request': request}).data)
