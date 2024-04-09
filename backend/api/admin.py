from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

# Register your models here.
from .models import Vehicle, Beneficiary, Contract

class ContractAdmin(admin.ModelAdmin):
    exclude = ('start_kilometer', 'end_kilometer', 'created_by', 'created_at')  # Exclude start_kilometer from the admin form
    # Show all fields in the list view
    list_display = ('vehicle', 'beneficiary', 'start_date', 'end_date', 'status', 'price', 'deposit', 'start_kilometer', 'end_kilometer', 'pdf')

    def pdf(self, obj):
        url = reverse('contract-get-pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">Contrat</a>', url)

    pdf.short_description = 'PDF'
    pdf.allow_tags = True

admin.site.register(Vehicle)
admin.site.register(Beneficiary)
admin.site.register(Contract, ContractAdmin)

