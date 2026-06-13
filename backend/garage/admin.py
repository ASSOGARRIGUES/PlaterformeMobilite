from django.contrib import admin
from .models import TaskCatalog


@admin.register(TaskCatalog)
class TaskCatalogAdmin(admin.ModelAdmin):
    list_display = ('name', 'vehicle_type', 'km_periodicity', 'month_periodicity', 'is_critical', 'archived')
    list_filter = ('vehicle_type', 'is_critical', 'archived')
    search_fields = ('name',)
    list_editable = ('archived',)
