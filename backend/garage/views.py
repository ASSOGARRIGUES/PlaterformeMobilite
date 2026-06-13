from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import TaskCatalog
from .serializers import TaskCatalogSerializer
from .filters import TaskCatalogFilter


class TaskCatalogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TaskCatalogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = TaskCatalogFilter

    def get_queryset(self):
        return TaskCatalog.objects.filter(archived=False)
