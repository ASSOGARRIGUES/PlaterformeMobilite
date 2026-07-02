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
                  'is_corrected', 'corrects', 'correction_reason', 'created_at']


class MileageCorrectionSerializer(serializers.Serializer):
    entry = serializers.PrimaryKeyRelatedField(queryset=MileageEntry.objects.all())
    value = serializers.IntegerField(min_value=0)
    reason = serializers.CharField()

    def validate(self, attrs):
        entry = attrs['entry']
        vehicle_pk = self.context['vehicle_pk']
        if entry.vehicle_id != int(vehicle_pk):
            raise serializers.ValidationError({'entry': "Cette entrée n'appartient pas à ce véhicule."})
        return attrs
