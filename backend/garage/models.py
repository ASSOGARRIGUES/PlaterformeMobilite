from django.db import models


class TaskCatalog(models.Model):
    VEHICLE_TYPE_CHOICES = (
        ('voiture', 'Voiture'),
        ('2_roues', '2 roues'),
        ('les_deux', 'Les deux'),
    )

    name = models.CharField(max_length=100)
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES, default='les_deux')
    km_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité kilométrique (km)")
    month_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité temporelle (mois)")
    is_critical = models.BooleanField(default=False, help_text="Si vrai, le dépassement déclenche le passage automatique en maintenance")
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
