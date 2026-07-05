from decimal import Decimal

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
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
        permissions = [
            ('view_dashboard', "Peut accéder au tableau de bord garage"),
            ('view_vehicle', "Peut voir les véhicules dans le module garage"),
            ('manage_inspection', "Peut créer et gérer les fiches de contrôle intermédiaire"),
            ('override_maintenance_block', "Peut forcer le passage d'un véhicule en disponible malgré un blocage maintenance"),
        ]

    def __str__(self):
        return "Configuration de maintenance"

    def save(self, *args, **kwargs):
        self.pk = 1
        self.clean()
        super().save(*args, **kwargs)

    def clean(self):
        if self.wear_critical_threshold >= self.wear_alert_threshold:
            raise ValidationError({
                'wear_critical_threshold': (
                    f"Le seuil critique ({self.wear_critical_threshold}) doit être "
                    f"strictement inférieur au seuil d'alerte ({self.wear_alert_threshold})."
                )
            })


class MileageEntry(models.Model):
    SOURCE_CHOICES = [
        ('contract', 'Contrat (historique)'),
        ('contract_start', 'Contrat — régularisation à la création'),
        ('contract_end', 'Contrat — clôture/retour'),
        ('intervention', "Fiche d'intervention"),
        ('inspection', 'Fiche de contrôle'),
        ('correction', 'Correction'),
        ('migration', 'Migration initiale'),
        ('creation', 'Création du véhicule'),
        ('manual_edit', 'Modification manuelle'),
    ]

    vehicle = models.ForeignKey(
        'api.Vehicle',
        on_delete=models.CASCADE,
        related_name='mileage_entries'
    )
    value = models.PositiveIntegerField()
    date = models.DateField()
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    source_id = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Référence générique vers l'objet à l'origine de l'entrée (ex: id du contrat quand source est contract_start/contract_end)"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='mileage_entries'
    )
    corrects = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='corrections'
    )
    correction_reason = models.TextField(blank=True)
    is_corrected = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        ordering = ['-date', '-id']
        indexes = [
            models.Index(fields=['vehicle', '-date'])
        ]
        permissions = [
            ('correct_mileage', 'Peut corriger un kilométrage erroné'),
        ]

    def __str__(self):
        return f"{self.vehicle} — {self.value} km ({self.date})"


class InterventionSheet(models.Model):
    STATUS_CHOICES = [
        ('open', 'Ouverte'),
        ('validated', 'Validée'),
    ]

    vehicle = models.ForeignKey(
        'api.Vehicle',
        on_delete=models.CASCADE,
        related_name='intervention_sheets'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='intervention_sheets'
    )
    current_step = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    start_mileage = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        permissions = [
            ('manage_intervention', "Peut créer et gérer les fiches d'intervention"),
        ]

    def __str__(self):
        return f"Fiche d'intervention {self.vehicle} ({self.status})"


class InterventionTask(models.Model):
    TYPE_CHOICES = [
        ('done', 'Réalisée'),
        ('planned', 'À prévoir'),
    ]

    sheet = models.ForeignKey(
        InterventionSheet,
        on_delete=models.CASCADE,
        related_name='tasks'
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    catalog_task = models.ForeignKey(
        TaskCatalog,
        null=True, blank=True,
        on_delete=models.PROTECT
    )
    description = models.TextField(blank=True)
    wear_level = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)]
    )

    def __str__(self):
        return f"{self.get_type_display()} — {self.catalog_task or self.description}"


class InterventionTaskPart(models.Model):
    task = models.ForeignKey(
        InterventionTask,
        on_delete=models.CASCADE,
        related_name='parts'
    )
    name = models.CharField(max_length=100)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    def __str__(self):
        return f"{self.name} x{self.quantity}"


class GaragePhoto(models.Model):
    image = models.ImageField(upload_to='garage/')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey()

    def __str__(self):
        return f"Photo {self.content_type} #{self.object_id}"


class VehicleTaskRecord(models.Model):
    vehicle = models.ForeignKey(
        'api.Vehicle',
        on_delete=models.CASCADE,
        related_name='task_records'
    )
    catalog_task = models.ForeignKey(TaskCatalog, on_delete=models.CASCADE)
    date = models.DateField()
    kilometer = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['vehicle', 'catalog_task'], name='unique_vehicle_task_record')
        ]

    def __str__(self):
        return f"{self.vehicle} — {self.catalog_task} ({self.date})"


class AuditLog(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='garage_audit_logs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50)
    reason = models.TextField(blank=True)
    field_name = models.CharField(max_length=100, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    content_type = models.ForeignKey(ContentType, null=True, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField(null=True)
    content_object = GenericForeignKey()

    def __str__(self):
        return f"{self.action} — {self.content_type} #{self.object_id}"
