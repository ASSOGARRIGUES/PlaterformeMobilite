from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from api.models import Contract
from .models import TaskCatalog, MileageEntry


class TaskCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCatalog
        fields = ['id', 'name', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'is_critical']


class MileageEntrySerializer(serializers.ModelSerializer):
    CONTRACT_SOURCES = {'contract', 'contract_start', 'contract_end'}

    author_display = serializers.SerializerMethodField()
    beneficiary_display = serializers.SerializerMethodField()

    def get_author_display(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_beneficiary_display(self, obj):
        if obj.source not in self.CONTRACT_SOURCES or not obj.source_id:
            return None
        contracts_by_id = self.context.get('contracts_by_id')
        if contracts_by_id is not None:
            contract = contracts_by_id.get(obj.source_id)
        else:
            contract = Contract.objects.select_related('beneficiary').filter(pk=obj.source_id).first()
        if contract is None:
            return None
        beneficiary = contract.beneficiary
        return f"{beneficiary.first_name} {beneficiary.last_name}".strip()

    class Meta:
        model = MileageEntry
        fields = ['id', 'value', 'date', 'source', 'source_id', 'author_display',
                  'beneficiary_display', 'is_corrected', 'corrects', 'correction_reason', 'created_at']
        read_only_fields = ['value', 'date', 'source', 'source_id', 'is_corrected', 'corrects', 'correction_reason']


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
