from django import forms
from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.urls import reverse
from django.utils.html import format_html
from api.models import Vehicle
from .audit import AUDIT_ACTION_LABELS, describe_audit_entry
from .models import (
    MileageEntry, TaskCatalog, MaintenanceConfig, InterventionSheet, InterventionTask, InspectionSheet,
    InspectionTask, InspectionDamage, AuditLog,
)


class TaskCatalogForm(forms.ModelForm):
    vehicle_types = forms.MultipleChoiceField(
        choices=Vehicle.VEHICLE_TYPE_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="Types de véhicules",
    )

    class Meta:
        model = TaskCatalog
        fields = '__all__'


@admin.register(TaskCatalog)
class TaskCatalogAdmin(admin.ModelAdmin):
    form = TaskCatalogForm
    list_display = ('name', 'icon', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'soon_km', 'soon_months', 'is_critical', 'is_wear_task', 'measured_in_inspection', 'archived')
    list_filter = ('is_critical', 'is_wear_task', 'measured_in_inspection', 'archived')
    search_fields = ('name',)
    list_editable = ('archived',)


@admin.register(MileageEntry)
class MileageEntryAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'value', 'date', 'source', 'author')


@admin.register(MaintenanceConfig)
class MaintenanceConfigAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not MaintenanceConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = MaintenanceConfig.objects.first()
        if obj and (self.has_change_permission(request, obj) or self.has_view_permission(request, obj)):
            return self.change_view(request, str(obj.pk), extra_context=extra_context)
        return super().changelist_view(request, extra_context)


@admin.register(InterventionSheet)
class InterventionSheetAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'status', 'current_step', 'created_by', 'created_at')


@admin.register(InspectionSheet)
class InspectionSheetAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'status', 'current_step', 'created_by', 'start_date')


INSPECTION_MODELS = (InspectionSheet, InspectionTask, InspectionDamage)
INTERVENTION_MODELS = (InterventionSheet, InterventionTask)


def _content_type_ids(models):
    return [ContentType.objects.get_for_model(model).id for model in models]


class AuditSheetKindFilter(admin.SimpleListFilter):
    title = 'type de fiche'
    parameter_name = 'sheet_kind'

    def lookups(self, request, model_admin):
        return [('inspection', 'Contrôle'), ('intervention', 'Intervention')]

    def queryset(self, request, queryset):
        if self.value() == 'inspection':
            return queryset.filter(content_type__in=_content_type_ids(INSPECTION_MODELS))
        if self.value() == 'intervention':
            return queryset.filter(content_type__in=_content_type_ids(INTERVENTION_MODELS))
        return queryset


class AuditActionFilter(admin.SimpleListFilter):
    title = 'action'
    parameter_name = 'audit_action'

    def lookups(self, request, model_admin):
        return list(AUDIT_ACTION_LABELS.items())

    def queryset(self, request, queryset):
        return queryset.filter(action=self.value()) if self.value() else queryset


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Journal d'audit en lecture seule, lisible par un responsable (traduction : garage.audit)."""
    list_display = ('date', 'author_name', 'action_label', 'field_label', 'sheet_link', 'change')
    list_filter = (AuditSheetKindFilter, AuditActionFilter, 'author')
    date_hierarchy = 'created_at'
    search_fields = ('author__first_name', 'author__last_name', 'author__email')
    search_help_text = "Immatriculation du véhicule ou nom de l'auteur"
    ordering = ('-created_at', '-id')
    list_select_related = ('author', 'content_type')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_search_results(self, request, queryset, search_term):
        found, may_have_duplicates = super().get_search_results(request, queryset, search_term)
        if not search_term:
            return found, may_have_duplicates
        # Immatriculation : le journal ne pointe vers le véhicule que par la fiche (générique) -> on remonte.
        plate_q = Q()
        for sheet_model, children in ((InspectionSheet, (InspectionTask, InspectionDamage)),
                                      (InterventionSheet, (InterventionTask,))):
            sheet_ids = list(sheet_model.objects.filter(vehicle__imat__icontains=search_term).values_list('id', flat=True))
            if not sheet_ids:
                continue
            plate_q |= Q(content_type=ContentType.objects.get_for_model(sheet_model), object_id__in=sheet_ids)
            for child in children:
                child_ids = list(child.objects.filter(sheet_id__in=sheet_ids).values_list('id', flat=True))
                plate_q |= Q(content_type=ContentType.objects.get_for_model(child), object_id__in=child_ids)
        if plate_q:
            found = queryset.filter(Q(pk__in=found.values('pk')) | plate_q)
        return found, may_have_duplicates

    @admin.display(description='Date', ordering='created_at')
    def date(self, entry):
        return describe_audit_entry(entry)['date'].strftime('%d/%m/%Y %H:%M')

    @admin.display(description='Auteur')
    def author_name(self, entry):
        return describe_audit_entry(entry)['author']

    @admin.display(description='Action')
    def action_label(self, entry):
        return describe_audit_entry(entry)['action']

    @admin.display(description='Champ')
    def field_label(self, entry):
        return describe_audit_entry(entry)['field']

    @admin.display(description='Fiche concernée')
    def sheet_link(self, entry):
        info = describe_audit_entry(entry)
        sheet = info['sheet']
        if sheet is None:
            return info['sheet_label']
        url = reverse(f'admin:garage_{sheet._meta.model_name}_change', args=[sheet.pk])
        return format_html('<a href="{}">{} {}</a>', url, info['sheet_kind'], info['sheet_label'])

    @admin.display(description='Avant → Après')
    def change(self, entry):
        return describe_audit_entry(entry)['change']
