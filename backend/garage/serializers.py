from rest_framework import serializers
from .models import TaskCatalog


class TaskCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'vehicle_type', 'km_periodicity', 'month_periodicity', 'is_critical']
