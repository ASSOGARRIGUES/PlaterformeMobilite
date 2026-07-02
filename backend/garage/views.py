from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound
from django_filters.rest_framework import DjangoFilterBackend
from api.models import Vehicle
from .models import TaskCatalog, MileageEntry
from .serializers import TaskCatalogSerializer, MileageEntrySerializer
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
