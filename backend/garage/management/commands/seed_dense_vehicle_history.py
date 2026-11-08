import random
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from api.models import Vehicle
from garage.alerts import get_config
from garage.models import InterventionSheet, InterventionTask, InterventionTaskPart, MileageEntry, TaskCatalog

PART_PRICES = {
    'Vidange': [('Huile moteur 5L', Decimal('35.00'), 1), ('Filtre à huile', Decimal('8.00'), 1)],
    'Filtre à huile': [('Filtre à huile', Decimal('8.00'), 1)],
    'Filtre à air': [('Filtre à air', Decimal('15.00'), 1)],
    'Plaquettes de frein': [('Jeu de plaquettes avant', Decimal('45.00'), 1)],
    'Freins arrière': [('Jeu de plaquettes arrière', Decimal('40.00'), 1)],
    'Disques de frein': [('Disque de frein', Decimal('55.00'), 2)],
    'Pneus': [('Pneu', Decimal('80.00'), 2)],
    'Distribution': [('Kit distribution', Decimal('180.00'), 1), ('Pompe à eau', Decimal('45.00'), 1)],
    'Bougies': [('Bougie', Decimal('9.00'), 4)],
    'Bobines': [('Bobine d\'allumage', Decimal('35.00'), 1)],
    'Biellettes': [('Biellette de direction', Decimal('25.00'), 2)],
    'Roulements': [('Roulement de roue', Decimal('40.00'), 1)],
}

# Programme d'entretien type sur la vie du véhicule : (km, tâches réalisées à ce passage)
SCHEDULE = [
    (15000, ['Vidange', 'Filtre à huile']),
    (30000, ['Vidange', 'Filtre à huile', 'Filtre à air', 'Plaquettes de frein']),
    (45000, ['Vidange', 'Filtre à huile']),
    (60000, ['Vidange', 'Filtre à huile', 'Freins arrière', 'Disques de frein']),
    (75000, ['Vidange', 'Filtre à huile', 'Pneus']),
    (90000, ['Vidange', 'Filtre à huile', 'Filtre à air', 'Plaquettes de frein', 'Biellettes']),
    (105000, ['Vidange', 'Filtre à huile', 'Bougies', 'Bobines']),
    (120000, ['Vidange', 'Filtre à huile', 'Distribution', 'Pneus', 'Roulements']),
    (135000, ['Vidange', 'Filtre à huile', 'Filtre à air', 'Plaquettes de frein']),
]

TARGET_KM = 140000


class Command(BaseCommand):
    help = "Génère un historique dense et réaliste (tâches récurrentes) pour un véhicule précis"

    def add_arguments(self, parser):
        parser.add_argument('--imat', type=str, required=True, help="Immatriculation du véhicule")
        parser.add_argument('--target-km', type=int, default=TARGET_KM)

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Commande réservée au développement (DEBUG=True).")
        User = get_user_model()
        random.seed(6)

        vehicles = list(Vehicle.objects.filter(imat=options['imat']))
        if not vehicles:
            raise CommandError(f"Aucun véhicule avec l'immatriculation {options['imat']!r}")
        if len(vehicles) > 1:
            raise CommandError(f"{len(vehicles)} véhicules ont l'immatriculation {options['imat']!r} (actions différentes) : supprimer les doublons de dev avant de relancer.")
        vehicle = vehicles[0]

        target_km = options['target_km']
        authors = list(User.objects.filter(is_active=True))
        if not authors:
            raise CommandError("Aucun utilisateur actif trouvé pour être auteur des fiches.")

        today = timezone.now().date()
        start_date = date(vehicle.year, 6, 1)
        total_days = max((today - start_date).days, 1)
        catalog_by_name = {t.name: t for t in TaskCatalog.objects.filter(archived=False)}
        # Pièces posées au-dessus du seuil d'alerte : refusées en dessous, « À prévoir » au seuil (D4)
        min_posed_wear = min(get_config().wear_alert_threshold + 1, 10)

        with transaction.atomic():
            # On ne touche pas à la fiche manuelle sans start_date (créée à la main, pas par un
            # script de seed) ; tout le reste (généré précédemment ou incohérent avec le nouvel
            # historique dense) est reconstruit pour rester cohérent sur toute la période.
            sheets_to_wipe = vehicle.intervention_sheets.exclude(start_date__isnull=True)
            entries_to_wipe = vehicle.mileage_entries.all()
            deleted_sheets = sheets_to_wipe.count()
            deleted_entries = entries_to_wipe.count()
            sheets_to_wipe.delete()
            entries_to_wipe.delete()

            sheets_created = 0
            entries_created = 0

            MileageEntry.objects.create(
                vehicle=vehicle, value=0, date=start_date,
                source='creation', author=random.choice(authors),
            )
            entries_created += 1

            for km, task_names in SCHEDULE:
                if km > target_km:
                    break
                ratio = km / target_km
                sheet_date = start_date + timedelta(days=int(total_days * ratio))
                author = random.choice(authors)

                sheet = InterventionSheet.objects.create(
                    vehicle=vehicle,
                    created_by=author,
                    current_step=3,
                    status='validated',
                    start_mileage=km,
                    start_date=sheet_date,
                    end_date=sheet_date + timedelta(days=random.randint(0, 2)),
                )
                sheets_created += 1

                for name in task_names:
                    catalog_task = catalog_by_name.get(name)
                    if catalog_task is None:
                        continue
                    task = InterventionTask.objects.create(
                        sheet=sheet, type='done', catalog_task=catalog_task, description='',
                        wear_level=random.randint(min_posed_wear, max(min_posed_wear, 8)) if catalog_task.is_wear_task else None,
                    )
                    for part_name, price, qty in PART_PRICES.get(name, []):
                        InterventionTaskPart.objects.create(task=task, name=part_name, unit_price=price, quantity=qty)

                MileageEntry.objects.create(
                    vehicle=vehicle, value=km, date=sheet.start_date,
                    source='intervention', source_id=sheet.id, author=author,
                )
                entries_created += 1

            # Kilométrage actuel réel + fiche ouverte "à prévoir" représentant l'entretien à venir
            MileageEntry.objects.create(
                vehicle=vehicle, value=target_km, date=today,
                source='manual_edit', author=random.choice(authors),
            )
            entries_created += 1

            pending_sheet = InterventionSheet.objects.create(
                vehicle=vehicle,
                created_by=random.choice(authors),
                current_step=2,
                status='open',
                start_mileage=target_km,
                start_date=today,
            )
            for name in ['Pneus', 'Plaquettes de frein']:
                catalog_task = catalog_by_name.get(name)
                if catalog_task:
                    InterventionTask.objects.create(
                        sheet=pending_sheet, type='planned', catalog_task=catalog_task, description='',
                        wear_level=random.randint(1, 3) if catalog_task.is_wear_task else None,
                    )
            sheets_created += 1

            vehicle.kilometer = target_km
            vehicle.save(update_fields=['kilometer'])

        self.stdout.write(self.style.SUCCESS(
            f"Historique dense généré pour {vehicle} ({vehicle.imat}) : "
            f"{sheets_created} fiches créées ({deleted_sheets} supprimées), "
            f"{entries_created} entrées créées ({deleted_entries} supprimées)."
        ))
