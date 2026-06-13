import django_filters
from django.db import connection
from django.db.models import Q
from django_filters.rest_framework import FilterSet
from api.models import Vehicle
from .models import TaskCatalog


class TaskCatalogFilter(FilterSet):
    vehicle_types = django_filters.MultipleChoiceFilter(
        choices=Vehicle.VEHICLE_TYPE_CHOICES,
        method='filter_vehicle_types'
    )

    def filter_vehicle_types(self, queryset, name, value):
        if not value:
            return queryset
        q = Q()
        for v in value:
            if connection.vendor == 'postgresql':
                q |= Q(vehicle_types__contains=[v])
            else:
                q |= Q(vehicle_types__icontains=f'"{v}"')
        return queryset.filter(q)

    class Meta:
        model = TaskCatalog
        fields = ['vehicle_types']
