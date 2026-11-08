import json
import django_filters
from django.db import connection
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import FilterSet
from api.models import Vehicle
from api.models import Contract
from .models import TaskCatalog, InterventionSheet, InspectionSheet


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
                q |= Q(vehicle_types__icontains=json.dumps(v))
        return queryset.filter(q)

    class Meta:
        model = TaskCatalog
        fields = ['vehicle_types']


class InterventionSheetFilter(FilterSet):
    class Meta:
        model = InterventionSheet
        fields = {
            'vehicle': ['exact'],
            'status': ['exact', 'in'],
            'created_by': ['exact'],
            'created_at': ['gte', 'lte'],
        }


class InspectionSheetFilter(FilterSet):
    contract = django_filters.NumberFilter(method='filter_contract')

    def filter_contract(self, queryset, name, value):
        """Fiches validées du véhicule du contrat, datées pendant le contrat (lecture seule, sans FK vers api)."""
        user = self.request.user
        if not user.has_perm('api.view_contract'):
            return queryset.none()
        contract = Contract.objects.filter(pk=value, action=user.current_action).first()
        if contract is None:
            return queryset.none()
        queryset = queryset.filter(vehicle_id=contract.vehicle_id, status='validated', start_date__gte=contract.start_date)
        if contract.status in ('waiting', 'pending') and contract.ended_at is None:
            return queryset  # contrat en cours : pas de borne haute
        end = timezone.localtime(contract.ended_at).date() if contract.ended_at else contract.end_date
        return queryset.filter(start_date__lte=end)

    class Meta:
        model = InspectionSheet
        fields = {
            'vehicle': ['exact'],
            'status': ['exact', 'in'],
            'created_by': ['exact'],
            'created_at': ['gte', 'lte'],
        }
