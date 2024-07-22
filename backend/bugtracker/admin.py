from django.contrib import admin
from django.utils.html import format_html

# Register your models here.
from .models import Bug

class BugAdmin(admin.ModelAdmin):
    search_fields = ('description', 'reporter__username', 'severity', 'status', 'created_at')
    list_filter = ('severity', 'status', 'created_at')
    list_display = ('id', 'description', 'severity_disp', 'created_at', 'status', 'reporter')
    list_display_links = ('id', 'description')
    list_select_related = ('reporter',)
    readonly_fields = ('created_at',)

    def severity_disp(self, obj):
        severityColorMap = {
            'low': 'green',
            'medium': 'yellow',
            'high': 'orange',
            'critical': 'red'
        }

        return format_html('<div style="border-radius: 10px; width: 70px; text-align:center; padding: 5px 10px; background-color:{};">{}</div>', severityColorMap[obj.severity], obj.severity)


admin.site.register(Bug, BugAdmin)
