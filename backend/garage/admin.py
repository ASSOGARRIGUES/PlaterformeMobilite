from django import forms
from django.contrib import admin
from api.models import Vehicle
from .models import TaskCatalog, MaintenanceConfig


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
    list_display = ('name', 'vehicle_types', 'km_periodicity', 'month_periodicity', 'is_critical', 'archived')
    list_filter = ('is_critical', 'archived')
    search_fields = ('name',)
    list_editable = ('archived',)


@admin.register(MaintenanceConfig)
class MaintenanceConfigAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not MaintenanceConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = MaintenanceConfig.objects.first()
        if obj:
            return self.change_view(request, str(obj.pk), extra_context=extra_context)
        return super().changelist_view(request, extra_context)
