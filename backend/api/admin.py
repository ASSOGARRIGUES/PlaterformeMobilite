from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.urls import reverse
from django.utils.html import format_html

# Register your models here.
from .models import Vehicle, Beneficiary, Contract, Parking


class ContractAdmin(admin.ModelAdmin):
    # Show all fields in the list view
    list_display = ('id','vehicle', 'beneficiary', 'start_date', 'end_date', 'status', 'price', 'deposit', 'start_kilometer', 'end_kilometer', 'pdf')
    readonly_fields = ('created_by', 'created_at')

    def pdf(self, obj):
        contract_url = reverse('contract-get-contract-pdf', args=[obj.pk])
        bill_url = reverse('contract-get-bill-pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">Contrat</a> <a href="{}" target="_blank">Facture</a>', contract_url, bill_url)

    pdf.short_description = 'PDF'
    pdf.allow_tags = True


class VehicleAdmin(admin.ModelAdmin):
    list_display = ('fleet_id', 'brand', 'modele', 'color', 'status', 'kilometer', 'year')


class BeneficiaryAdmin(admin.ModelAdmin):
    list_display = ('id','first_name', 'last_name', 'email', 'phone', 'address', 'city', 'postal_code')


class ParkingAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'vehicles_count')
    readonly_fields = ('vehicles_count',)

    def vehicles_count(self, obj):
        return obj.vehicles.count()


admin.site.register(Vehicle, VehicleAdmin)
admin.site.register(Beneficiary, BeneficiaryAdmin)
admin.site.register(Contract, ContractAdmin)
admin.site.register(Parking, ParkingAdmin)



