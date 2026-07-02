from rest_framework import serializers
from .models import TaskCatalog, MileageEntry


class TaskCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'is_critical']


class MileageEntrySerializer(serializers.ModelSerializer):
    author_display = serializers.SerializerMethodField()

    def get_author_display(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip()

    class Meta:
        model = MileageEntry
        fields = ['id', 'value', 'date', 'source', 'author_display',
                  'is_corrected', 'corrects', 'correction_reason']
