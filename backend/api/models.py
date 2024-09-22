from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from utils import render_to_pdf

from core.models import Action


class Parking(models.Model):
    name = models.CharField(max_length=100)
    actions = models.ManyToManyField(Action, related_name='parkings', blank=True)

    @classmethod
    def get_default_parking_pk(cls):
        #get first parking or create a default one if none exists
        parking = cls.objects.first()
        if not parking:
            #Create default parking with all actions
            parking = cls.objects.create(name='Défaut')
            parking.actions.set(Action.objects.all())
            parking.save()
        return parking.pk

    def __str__(self):
        return self.name


# Signal handler to handle changes to the ManyToMany field
@receiver(m2m_changed, sender=Parking.actions.through)
def handle_actions_changed(sender, instance, action, **kwargs):
    # Only handle 'post_remove' and 'post_clear' actions (after changes are made)
    if action == 'post_remove' or action == 'post_clear':
        for vehicle in instance.vehicles.all():
            # Check if vehicle's action is no longer in the parking's actions
            if vehicle.action not in instance.actions.all():
                print('Vehicle action:', vehicle.action)
                print('Parking actions:', instance.actions.all())
                print('Vehicle moved to default parking')

                # Get or create the default parking for the vehicle's action
                default_parking = Parking.objects.filter(actions=vehicle.action).first()
                if not default_parking:
                    default_parking = Parking.objects.get_default_parking_pk()

                # Move vehicle to default parking
                vehicle.parking = default_parking
                vehicle.save()



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

    action = models.ForeignKey(Action, on_delete=models.SET_DEFAULT, related_name='vehicles', default=Action.get_default_action_pk)

    created_at = models.DateTimeField(auto_now_add=True)

    archived = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ('can_transfer_vehicle', 'Can transfer vehicle'),
            ('review_vehicle', 'Can access to the vehicle review'),
        ]

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

    action = models.ForeignKey(Action, on_delete=models.SET_DEFAULT, related_name='beneficiaries',
                               default=Action.get_default_action_pk)

    archived = models.BooleanField(default=False)

    def __str__(self):
        return self.first_name.capitalize()+' '+self.last_name.capitalize()


class PaymentMode(models.TextChoices):
    CASH = 'cash'
    CHECK = 'check'
    CARD = 'card'

    def toSTR(value):
        display_dict = {
            PaymentMode.CARD: 'Carte bancaire',
            PaymentMode.CASH: 'Espèces',
            PaymentMode.CHECK: 'Chèque',
        }
        return display_dict[value]


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
    beneficiary = models.ForeignKey(Beneficiary, on_delete=models.CASCADE, related_name='contracts')
    start_date = models.DateField()
    end_date = models.DateField()
    #Status should be a choice field with values: 'en attente de paiement', 'en cours', 'terminé'
    status = models.CharField(max_length=100, choices=STATUS_CHOICES, default='pending')
    comment = models.TextField(blank=True, null=True)
    reason = models.TextField(choices=REASON_CHOICES, blank=True, null=True)

    max_kilometer = models.IntegerField(default=None, null=True)
    price = models.IntegerField()
    discount = models.IntegerField(default=0)


    deposit = models.IntegerField()
    depositPaymentMode = models.CharField(max_length=20, choices=PaymentMode.choices, default=PaymentMode.CASH)
    deposit_check_number = models.CharField(max_length=100, blank=True, null=True)

    start_kilometer = models.IntegerField()
    end_kilometer = models.IntegerField(default=None, null=True)
    ended_at = models.DateTimeField(default=None, null=True) # Date when the contract is ended
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='contracts_created_by', null=True, blank=True)


    referent = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='contracts_referent')
    action = models.ForeignKey(Action, on_delete=models.SET_DEFAULT, related_name='contracts',
                               default=Action.get_default_action_pk)

    archived = models.BooleanField(default=False)

    def __str__(self):
        return self.vehicle.brand.capitalize()+ ' '+self.vehicle.modele+ ' '+self.beneficiary.last_name.capitalize()

    def save(self, *args, **kwargs):
        if not self.pk:  # This is a new contract
            created_by_id = kwargs.pop('created_by_id', None)
            if created_by_id:
                self.created_by = get_user_model().objects.get(pk=created_by_id)
        super(Contract, self).save(*args, **kwargs)

    def render_contract_pdf(self):
        context = {
            "contract": self,
            "final_price": self.price - self.discount,
            "deposit_mode_display": PaymentMode.toSTR(self.depositPaymentMode),
        }
        pdf = render_to_pdf('invoices/invoice.html', context)
        return pdf

    def render_bill_pdf(self):
        km_overpass = self.end_kilometer > self.max_kilometer+self.start_kilometer if self.end_kilometer else False
        context = {
            "contract": self,
            "final_price": self.price - self.discount,
            "km_overpass":  km_overpass,
            "remaining_due": self.price - self.discount - self.getPaymentsSum(),
            "payment_sum": self.getPaymentsSum(),
        }
        pdf = render_to_pdf('invoices/bill.html', context)
        return pdf

    def getPaymentsSum(self):
        return self.payments.aggregate(models.Sum('amount'))['amount__sum'] or 0

    def updateIfPaid(self):
        if (self.getPaymentsSum() >= self.price - self.discount) and self.status == 'over':
            self.status = 'payed'
            self.save()
        elif self.status == 'payed' and self.getPaymentsSum() < self.price - self.discount:
            self.status = 'over'
            self.save()

class Payment(models.Model):

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='payments')
    amount = models.IntegerField()
    mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    check_number = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='payments_created_by', null=True, blank=True)
    edited_at = models.DateTimeField(auto_now=True)

    @property
    def editable(self) -> bool:
        # Check if their is no more recent payment
        return (not self.contract.payments.filter(created_at__gt=self.created_at).exists()) and (not self.contract.archived)

    @property
    def mode_display(self):
        return PaymentMode.toSTR(self.mode)

    def render_participation_pdf(self):
        km_overpass = self.contract.end_kilometer > self.contract.max_kilometer + self.contract.start_kilometer if self.contract.end_kilometer else False
        context = {
            "payment": self,
            "contract": self.contract,
            "final_price": self.contract.price - self.contract.discount,
            "km_overpass": km_overpass,
            "remaining_due": self.contract.price - self.contract.discount - self.contract.getPaymentsSum(),
            "payment_sum": self.contract.getPaymentsSum(),
        }
        pdf = render_to_pdf('invoices/participation.html', context)
        return pdf

