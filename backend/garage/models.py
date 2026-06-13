from django.core.exceptions import ValidationError
from django.db import models


class TaskCatalog(models.Model):
    name = models.CharField(max_length=100)
    vehicle_types = models.JSONField(default=list, help_text="Types de véhicules concernés (ex: [\"voiture\", \"scouter\"])")
    km_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité kilométrique (km)")
    month_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité temporelle (mois)")
    is_critical = models.BooleanField(default=False, help_text="Si vrai, le dépassement déclenche le passage automatique en maintenance")
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class MaintenanceConfig(models.Model):
    ct_alert_days = models.PositiveIntegerField(
        default=7,
        help_text="Nombre de jours avant expiration CT pour déclencher une alerte"
    )
    wear_alert_threshold = models.PositiveSmallIntegerField(
        default=4,
        help_text="Niveau d'usure (sur 10) en-dessous duquel une alerte est générée"
    )
    wear_critical_threshold = models.PositiveSmallIntegerField(
        default=3,
        help_text="Niveau d'usure (sur 10) en-dessous duquel le véhicule passe en maintenance"
    )
    open_intervention_alert_days = models.PositiveIntegerField(
        default=1,
        help_text="Délai (jours) après lequel une fiche d'intervention non finalisée génère une alerte"
    )
    km_max_without_intervention = models.PositiveIntegerField(
        default=8000,
        help_text="Km sans intervention validée après lesquels une alerte est générée"
    )

    class Meta:
        verbose_name = "Configuration de maintenance"
        verbose_name_plural = "Configuration de maintenance"

    def __str__(self):
        return "Configuration de maintenance"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def clean(self):
        if self.wear_critical_threshold >= self.wear_alert_threshold:
            raise ValidationError({
                'wear_critical_threshold': (
                    f"Le seuil critique ({self.wear_critical_threshold}) doit être "
                    f"strictement inférieur au seuil d'alerte ({self.wear_alert_threshold})."
                )
            })
