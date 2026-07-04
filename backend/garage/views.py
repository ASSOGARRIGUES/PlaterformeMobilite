from django.db import transaction
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from api.models import Vehicle, Contract
from .models import TaskCatalog, MileageEntry
from .serializers import TaskCatalogSerializer, MileageEntrySerializer, MileageCorrectionSerializer
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
