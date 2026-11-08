from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class TaskCatalog(models.Model):
    # Clés traduites en icônes Tabler côté front (components/garage/maintenance/taskIcons.ts)
    ICON_CHOICES = [
        ('tool', 'Outil (par défaut)'),
        ('oil', 'Huile'),
        ('filter', 'Filtre'),
        ('air', 'Air'),
        ('belt', 'Courroie / distribution'),
        ('brake', 'Freins'),
        ('tire', 'Pneus'),
        ('spark', 'Allumage'),
        ('bearing', 'Roulements'),
        ('steering', 'Direction / train'),
        ('battery', 'Batterie'),
        ('light', 'Éclairage'),
        ('engine', 'Moteur'),
        ('body', 'Carrosserie'),
    ]

    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default='tool', help_text="Icône affichée dans l'onglet Entretien")
    vehicle_types = models.JSONField(default=list, help_text="Types de véhicules concernés (ex: [\"voiture\", \"scouter\"])")
    km_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité kilométrique (km)")
    month_periodicity = models.PositiveIntegerField(null=True, blank=True, help_text="Périodicité temporelle (mois)")
    is_critical = models.BooleanField(default=False, help_text="Si vrai, le dépassement déclenche le passage automatique en maintenance")
    is_wear_task = models.BooleanField(default=False, help_text="Si vrai, la tâche est saisie avec un niveau d'usure /10 plutôt que simplement cochée comme faite")
    soon_km = models.PositiveIntegerField(null=True, blank=True, help_text="Seuil « bientôt » (km) : la tâche passe « À prévoir » quand il reste N km ou moins")
    soon_months = models.PositiveIntegerField(null=True, blank=True, help_text="Seuil « bientôt » (mois) : la tâche passe « À prévoir » quand il reste N mois ou moins")
    measured_in_inspection = models.BooleanField(
        default=False,
        help_text="Si vrai, le niveau d'usure est mesuré à chaque fiche de contrôle (tâche d'usure uniquement ; "
                  "4 tâches au maximum recommandées pour garder la saisie mobile rapide)"
    )
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def clean(self):
        errors = {}
        for soon_field, periodicity_field, unit in (
            ('soon_km', 'km_periodicity', 'km'),
            ('soon_months', 'month_periodicity', 'mois'),
        ):
            soon, periodicity = getattr(self, soon_field), getattr(self, periodicity_field)
            if soon and periodicity and soon >= periodicity:
                errors[soon_field] = (
                    f"Le seuil « bientôt » ({soon} {unit}) doit être strictement inférieur "
                    f"à la périodicité ({periodicity} {unit})."
                )
        if self.measured_in_inspection and not self.is_wear_task:
            errors['measured_in_inspection'] = "Seule une tâche d'usure peut être mesurée en contrôle."
        if errors:
            raise ValidationError(errors)


class MaintenanceConfig(models.Model):
    ct_alert_days = models.PositiveIntegerField(
        default=7,
        help_text="Nombre de jours avant expiration CT pour déclencher une alerte"
    )
    wear_alert_threshold = models.PositiveSmallIntegerField(
        default=5,
        validators=[MaxValueValidator(10)],
        help_text="Niveau d'usure (sur 10) à partir duquel (et en dessous) l'élément est signalé « À prévoir »"
    )
    wear_critical_threshold = models.PositiveSmallIntegerField(
        default=2,
        validators=[MaxValueValidator(10)],
        help_text="Niveau d'usure (sur 10) à partir duquel (et en dessous) l'élément est signalé « En retard »"
    )
    open_intervention_alert_days = models.PositiveIntegerField(
        default=1,
        help_text="Délai (jours) après lequel une fiche d'intervention non finalisée génère une alerte"
    )
    km_max_without_intervention = models.PositiveIntegerField(
        default=8000,
        help_text="Km sans intervention validée après lesquels une alerte est générée"
    )

    inspection_open_max_hours = models.PositiveSmallIntegerField(
        default=24,
        validators=[MinValueValidator(1)],
        help_text="Durée (heures) pendant laquelle une fiche de contrôle ouverte reste reprenable"
    )

    class Meta:
        verbose_name = "Configuration de maintenance"
        verbose_name_plural = "Configuration de maintenance"
        permissions = [
            ('view_dashboard', "Peut accéder au tableau de bord garage"),
            ('view_vehicle', "Peut voir les véhicules dans le module garage"),
            ('override_maintenance_block', "Peut forcer le passage d'un véhicule en disponible malgré un blocage maintenance"),
        ]

    def __str__(self):
        return "Configuration de maintenance"

    def save(self, *args, **kwargs):
        self.pk = 1
        self.clean()
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.wear_critical_threshold > 10:
            errors['wear_critical_threshold'] = "Le seuil d'usure ne peut pas dépasser 10."
        if self.wear_alert_threshold > 10:
            errors['wear_alert_threshold'] = "Le seuil d'usure ne peut pas dépasser 10."
        elif self.wear_alert_threshold == 10:
            errors['wear_alert_threshold'] = (
                "Le seuil d'alerte doit rester inférieur à 10, sinon la zone « Bon état » serait vide."
            )
        if self.wear_critical_threshold >= self.wear_alert_threshold:
            errors['wear_critical_threshold'] = (
                f"Le seuil critique ({self.wear_critical_threshold}) doit être "
                f"strictement inférieur au seuil d'alerte ({self.wear_alert_threshold})."
            )
        if errors:
            raise ValidationError(errors)


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
        constraints = [
            models.CheckConstraint(
                check=~models.Q(status='validated')
                | models.Q(start_mileage__isnull=False, start_date__isnull=False),
                name='validated_sheet_has_start_mileage_and_date',
            ),
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
    name = models.CharField(
        max_length=200, blank=True,
        help_text="Nom de la tâche libre (hors catalogue) — laisser vide si catalog_task est renseigné, le nom vient alors du catalogue"
    )
    description = models.TextField(blank=True)
    wear_level = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)]
    )
    dismissed_at = models.DateTimeField(null=True, blank=True)
    dismissed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name='dismissed_intervention_tasks',
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


class InspectionSheet(models.Model):
    STATUS_CHOICES = InterventionSheet.STATUS_CHOICES

    vehicle = models.ForeignKey(
        'api.Vehicle',
        on_delete=models.CASCADE,
        related_name='inspection_sheets'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='inspection_sheets'
    )
    current_step = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(7)]
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    start_mileage = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    # None = non renseigné, True = ok, False = défaut
    oil_ok = models.BooleanField(null=True, blank=True)
    coolant_ok = models.BooleanField(null=True, blank=True)
    washer_ok = models.BooleanField(null=True, blank=True)
    lights_ok = models.BooleanField(null=True, blank=True)
    lights_notes = models.TextField(blank=True)
    road_test_done = models.BooleanField(null=True, blank=True)
    road_test_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        permissions = [
            ('manage_inspection', "Peut créer et gérer les fiches de contrôle intermédiaire"),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(status='validated')
                | models.Q(start_mileage__isnull=False, start_date__isnull=False),
                name='validated_inspection_has_start_mileage_and_date',
            ),
        ]

    def __str__(self):
        return f"Fiche de contrôle {self.vehicle} ({self.status})"

    def is_expired(self, config, now=None):
        """Une fiche ouverte non validée dans le délai de MaintenanceConfig est expirée (calcul à la lecture)."""
        if self.status != 'open':
            return False
        return self.expires_at(config) <= (now or timezone.now())

    def expires_at(self, config):
        return self.created_at + timedelta(hours=config.inspection_open_max_hours)


class InspectionWearMeasurement(models.Model):
    sheet = models.ForeignKey(InspectionSheet, on_delete=models.CASCADE, related_name='wear_measurements')
    catalog_task = models.ForeignKey(TaskCatalog, on_delete=models.PROTECT)
    level = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(10)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['sheet', 'catalog_task'], name='unique_measurement_per_sheet_task'),
        ]

    def __str__(self):
        return f"{self.catalog_task} : {self.level}/10"


class InspectionDamage(models.Model):
    sheet = models.ForeignKey(InspectionSheet, on_delete=models.CASCADE, related_name='damages')
    description = models.TextField()

    def __str__(self):
        return f"Dégât — {self.description[:50]}"


class InspectionTask(models.Model):
    """Travail « à prévoir » relevé pendant un contrôle : se comporte comme un signalement d'intervention."""
    sheet = models.ForeignKey(InspectionSheet, on_delete=models.CASCADE, related_name='tasks')
    catalog_task = models.ForeignKey(TaskCatalog, null=True, blank=True, on_delete=models.PROTECT)
    name = models.CharField(
        max_length=200, blank=True,
        help_text="Nom de la tâche libre (hors catalogue) — laisser vide si catalog_task est renseigné"
    )
    description = models.TextField(blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    dismissed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name='dismissed_inspection_tasks',
    )

    def __str__(self):
        return f"À prévoir — {self.catalog_task or self.name}"


class GaragePhoto(models.Model):
    image = models.ImageField(upload_to='garage/')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey()

    def __str__(self):
        return f"Photo {self.content_type} #{self.object_id}"


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
