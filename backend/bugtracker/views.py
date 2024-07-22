from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Bug
from .serializers import BugSerializer


# Create your views here.

class BugViewSet(viewsets.ModelViewSet):
    serializer_class = BugSerializer
    permission_classes = (permissions.DjangoModelPermissions,)
    queryset = Bug.objects.all()

    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['description', 'reproduction_steps', 'targeted_version', 'severity', 'type', 'status', 'resolve_version', 'reporter__first_name', 'reporter__last_name', 'reporter__email']
    filterset_fields = {
        'id': ['in', 'exact'],
        'targeted_version': ['in', 'exact'],
        'severity': ['in', 'exact'],
        'type': ['in', 'exact'],
        'status': ['in', 'exact'],
        'resolve_version': ['in', 'exact'],
    }

