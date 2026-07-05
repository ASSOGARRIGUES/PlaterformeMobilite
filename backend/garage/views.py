from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from api.views import MUTATION_ACTION
from api.models import Vehicle, Contract
from .models import TaskCatalog, MileageEntry, InterventionSheet, VehicleTaskRecord
from .serializers import (
    TaskCatalogSerializer, MileageEntrySerializer, MileageCorrectionSerializer,
    InterventionSheetSerializer, MutationInterventionSheetSerializer,
    InterventionTaskSerializer, MutationInterventionTaskSerializer,
)
from .filters import TaskCatalogFilter
from .mixins import GarageMultiActionMixin


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

            latest = MileageEntry.objects.filter(
                vehicle_id=vehicle_pk, is_corrected=False
            ).order_by('-date', '-id').first()
            if latest:
                Vehicle.objects.filter(pk=vehicle_pk).update(kilometer=latest.value)

        return Response(MileageEntrySerializer(correction).data, status=201)


class InterventionSheetViewSet(GarageMultiActionMixin, viewsets.ModelViewSet):
    queryset = InterventionSheet.objects.select_related('vehicle', 'created_by').prefetch_related('tasks__parts').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in MUTATION_ACTION:
            return MutationInterventionSheetSerializer
        return InterventionSheetSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'tasks', 'validate') \
                and not request.user.has_perm('garage.manage_intervention'):
            raise PermissionDenied()

    @action(detail=True, methods=['post'], url_path='tasks')
    def tasks(self, request, pk=None):
        sheet = self.get_object()
        serializer = MutationInterventionTaskSerializer(data=request.data, context={'sheet': sheet})
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(InterventionTaskSerializer(task, context=self.get_serializer_context()).data, status=201)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate(self, request, pk=None):
        sheet = self.get_object()

        with transaction.atomic():
            sheet = InterventionSheet.objects.select_for_update().get(pk=sheet.pk)
            if sheet.status == 'validated':
                raise serializers.ValidationError("Cette fiche est déjà validée.")
            if sheet.start_mileage is None:
                raise serializers.ValidationError("Le kilométrage de départ est requis avant de valider la fiche.")

            sheet.status = 'validated'
            sheet.save(update_fields=['status'])

            entry_date = sheet.end_date or timezone.now().date()
            MileageEntry.objects.create(
                vehicle=sheet.vehicle,
                value=sheet.start_mileage,
                date=entry_date,
                source='intervention',
                source_id=sheet.id,
                author=request.user,
            )

            done_tasks = sheet.tasks.filter(type='done', catalog_task__isnull=False).filter(
                Q(catalog_task__km_periodicity__isnull=False) | Q(catalog_task__month_periodicity__isnull=False)
            )
            for task in done_tasks:
                VehicleTaskRecord.objects.update_or_create(
                    vehicle=sheet.vehicle,
                    catalog_task=task.catalog_task,
                    defaults={'date': entry_date, 'kilometer': sheet.start_mileage},
                )

        return Response(InterventionSheetSerializer(sheet, context=self.get_serializer_context()).data)
