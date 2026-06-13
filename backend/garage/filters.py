import django_filters
from django_filters.rest_framework import FilterSet
from api.models import Vehicle
from .models import TaskCatalog


class TaskCatalogFilter(FilterSet):
    vehicle_type = django_filters.ChoiceFilter(choices=Vehicle.VEHICLE_TYPE_CHOICES, method='filter_vehicle_type')

    def filter_vehicle_type(self, queryset, name, value):
        if value == 'voiture':
            return queryset.filter(vehicle_type__in=['voiture', 'les_deux'])
        elif value == 'scouter':
            return queryset.filter(vehicle_type__in=['2_roues', 'les_deux'])
        return queryset

    class Meta:
        model = TaskCatalog
        fields = ['vehicle_type']
