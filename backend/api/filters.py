import django_filters
from django.db.models import Q
from django_filters.rest_framework import FilterSet

from .models import Vehicle


class OrFilterSet(FilterSet):
    def OR(self, queryset, field_name, value):
        if not hasattr(self, "groups"):
            setattr(self, "groups", {})

        self.groups[field_name] = value
        return queryset

    @property
    def qs(self):
        base_queryset = super().qs

        if not hasattr(self, "groups"):
            return base_queryset

        query = Q()
        for key, value in self.groups.items():
            query |= Q(**{key: value})

        filtered = base_queryset.filter(query).distinct()
        return filtered


class VehicleFilter(OrFilterSet):
    status__or = django_filters.ChoiceFilter("status", choices=Vehicle.STATUS_CHOICES, method="OR", label="Status or")
    contracts__or = django_filters.NumberFilter("contracts", method="OR")

    class Meta:
        model = Vehicle
        fields = {
            'id': ["in", "exact"],
            'fleet_id': ["in", "exact"],
            'status': ["in", "exact"],
            'contracts': ["in", "exact"],
            'fuel_type': ["in", "exact"],
            'transmission': ["in", "exact"],
            'type': ["in", "exact"],
        }




