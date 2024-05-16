from django.contrib.auth import get_user_model
from django.db import models

from utils import render_to_pdf
class Parking(models.Model):
    name = models.CharField(max_length=100)

    @classmethod
    def get_default_parking_pk(cls):
        #get first parking or create a default one if none exists
        parking = cls.objects.first()
        if not parking:
            parking = cls.objects.create(name='Défaut')
        return parking.pk

    def __str__(self):
        return self.name


class Vehicle(models.Model):
    FUEL_CHOICES = (
        ('essence', 'Essence'),
        ('diesel', 'Diesel'),
        ('electrique', 'Electrique'),
    )

    VEHICLE_TYPE_CHOICES = (
        ('voiture', 'Voiture'),
        ('scouter', 'Scooter'),
    )

    TRANSMISSION_CHOICES = (
        ('manuelle', 'Manuelle'),
        ('automatique', 'Automatique'),
    )

    STATUS_CHOICES = (
        ('available', 'Disponible'),
        ('rented', 'A dispo'),
        ('maintenance', 'En maintenance'),
    )

    photo = models.ImageField(upload_to='vehicles/', blank=True, default="")

    type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES, default='voiture')
    transmission = models.CharField(max_length=20, choices=TRANSMISSION_CHOICES, default='manuelle')
    fuel_type = models.CharField(max_length=20, choices=FUEL_CHOICES, default='essence')

    brand = models.CharField(max_length=50)
    modele = models.CharField(max_length=50)
    color = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField()
    imat = models.CharField(max_length=9)
    fleet_id = models.IntegerField(unique=True)

    kilometer = models.IntegerField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')

    parking = models.ForeignKey(Parking, on_delete=models.SET_DEFAULT, related_name='vehicles', default=Parking.get_default_parking_pk)

    created_at = models.DateTimeField(auto_now_add=True)

    archived = models.BooleanField(default=False)

    def __str__(self):
        return self.brand.capitalize()+' '+self.modele.capitalize()


class Beneficiary(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    address = models.CharField(max_length=100)
    address_complement = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField()
    license_number = models.CharField(max_length=100, blank=True, null=True)
    license_delivery_date = models.DateField(blank=True, null=True)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=100)

    archived = models.BooleanField(default=False)

    def __str__(self):
        return self.first_name.capitalize()+' '+self.last_name.capitalize()


class Contract(models.Model):
    # Contract status enum
    STATUS_CHOICES = (
        ('waiting', 'En attente d\'EDL'),
        ('pending', 'En cours'),
        ('over', 'Clôturé'),
        ('payed', 'Payé'),
    )

    REASON_CHOICES = (
        ('cdd', 'CDD'),
        ('cdi', 'CDI'),
        ('formation', 'Formation'),
        ('interim', 'Intérim'),
        ('aided_contract', 'Contrat aidé'),
        ('job_seeking', 'Recherche d’emploi'),
        ('part_time', 'Alternance'),
    )

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='contracts')
    beneficiary = models.ForeignKey(Beneficiary, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    #Status should be a choice field with values: 'en attente de paiement', 'en cours', 'terminé'
    status = models.CharField(max_length=100, choices=STATUS_CHOICES, default='pending')
    comment = models.TextField(blank=True, null=True)
    reason = models.TextField(choices=REASON_CHOICES, blank=True, null=True)

    max_kilometer = models.IntegerField(default=None, null=True)
    price = models.IntegerField()
    deposit = models.IntegerField()
    discount = models.IntegerField(default=0)

    start_kilometer = models.IntegerField()
    end_kilometer = models.IntegerField(default=None, null=True)
    ended_at = models.DateTimeField(default=None, null=True) # Date when the contract is ended
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='contracts_created_by', null=True, blank=True)


    referent = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='contracts_referent')

    archived = models.BooleanField(default=False)

    def __str__(self):
        return self.vehicle.brand.capitalize()+ ' '+self.vehicle.modele+ ' '+self.beneficiary.last_name.capitalize()

    def save(self, *args, **kwargs):
        if not self.pk:  # This is a new contract
            self.start_kilometer = self.vehicle.kilometer

            created_by_id = kwargs.pop('created_by_id', None)
            if created_by_id:
                self.created_by = get_user_model().objects.get(pk=created_by_id)
        super(Contract, self).save(*args, **kwargs)

    def render_contract_pdf(self):
        context = {
            "contract": self,
            "final_price": self.price - self.discount,
        }
        pdf = render_to_pdf('invoices/invoice.html', context)
        return pdf

    def render_bill_pdf(self):
        context = {
            "contract": self,
            "final_price": self.price - self.discount,
            "km_overpass":  self.end_kilometer > self.max_kilometer+self.start_kilometer
        }
        pdf = render_to_pdf('invoices/bill.html', context)
        return pdf
