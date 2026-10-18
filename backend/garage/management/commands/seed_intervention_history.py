import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from api.models import Action, Vehicle
from garage.alerts import get_config
from garage.models import InterventionSheet, InterventionTask, InterventionTaskPart, MileageEntry, TaskCatalog

MECHANICS = [
    ('mecano1@example.com', 'Karim', 'Benali'),
    ('mecano2@example.com', 'Julie', 'Marchand'),
    ('mecano3@example.com', 'Mohamed', 'Amrani'),
    ('mecano4@example.com', 'Sophie', 'Lefebvre'),
    ('mecano5@example.com', 'Yanis', 'Girard'),
]

# Prix approximatifs (euros) pour les pièces des tâches concrètes
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

# Rythme annuel approximatif selon le type de véhicule
ANNUAL_KM = {'voiture': (9000, 16000), 'scouter': (4000, 9000)}

HISTORY_YEARS = 5
MIN_SHEETS_EXISTING = 3


class Command(BaseCommand):
    help = "Génère un historique crédible de fiches d'intervention et de kilométrage pour les véhicules actifs"

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Commande réservée au développement (DEBUG=True).")
        User = get_user_model()
        random.seed(42)

        action = Action.objects.get(name='Default')
        mechanic_group, _ = Group.objects.get_or_create(name='Garagiste')
        authors = self._get_or_create_mechanics(User, action, mechanic_group)

        vehicles = Vehicle.objects.filter(action=action, archived=False)
        today = timezone.now().date()

        created_sheets = 0
        created_entries = 0

        for vehicle in vehicles:
            if vehicle.intervention_sheets.count() >= MIN_SHEETS_EXISTING:
                continue

            with transaction.atomic():
                sheets, entries = self._seed_vehicle(vehicle, authors, today)
                created_sheets += sheets
                created_entries += entries

        self.stdout.write(self.style.SUCCESS(
            f"Historique généré : {created_sheets} fiches d'intervention, {created_entries} entrées de kilométrage."
        ))

    def _get_or_create_mechanics(self, User, action, group):
        authors = [User.objects.get(email='admin@example.com')]
        for email, first_name, last_name in MECHANICS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_active': True,
                    'current_action': action,
                },
            )
            if created:
                user.set_unusable_password()
                user.actions.add(action)
                user.groups.add(group)
                user.save()
            authors.append(user)
        return authors

    def _seed_vehicle(self, vehicle, authors, today):
        vehicle_type = vehicle.type
        catalog = list(TaskCatalog.objects.filter(archived=False))
        applicable_catalog = [t for t in catalog if vehicle_type in t.vehicle_types]

        start_date = today - timedelta(days=365 * HISTORY_YEARS)
        end_km = vehicle.kilometer
        annual_min, annual_max = ANNUAL_KM.get(vehicle_type, (6000, 12000))
        annual_avg = (annual_min + annual_max) / 2
        start_km = max(0, end_km - int(annual_avg * HISTORY_YEARS))

        n_sheets = random.randint(4, 7)
        sheet_dates = sorted(
            start_date + timedelta(days=random.randint(0, (today - start_date).days))
            for _ in range(n_sheets)
        )

        entries_created = 0

        # Kilométrage de départ tracé à la création du véhicule
        creation_entry = MileageEntry.objects.create(
            vehicle=vehicle, value=start_km, date=start_date,
            source='creation', author=random.choice(authors),
        )
        entries_created += 1

        # Répartition linéaire (bruitée) du kilométrage entre le début et la valeur actuelle
        span_days = max((today - start_date).days, 1)

        def km_at(d):
            ratio = (d - start_date).days / span_days
            noise = random.uniform(0.95, 1.05)
            return max(start_km, min(end_km, int(start_km + (end_km - start_km) * ratio * noise)))

        sheets_created = 0
        last_km = start_km
        distribution_done = False
        wear_threshold = get_config().wear_alert_threshold

        for i, sheet_date in enumerate(sheet_dates):
            km = max(km_at(sheet_date), last_km + 200)
            km = min(km, end_km)
            last_km = km

            is_last = i == len(sheet_dates) - 1
            status = 'open' if (is_last and random.random() < 0.15) else 'validated'
            author = random.choice(authors)

            sheet = InterventionSheet.objects.create(
                vehicle=vehicle,
                created_by=author,
                current_step=3 if status == 'validated' else random.randint(1, 2),
                status=status,
                start_mileage=km,
                start_date=sheet_date,
                end_date=sheet_date + timedelta(days=random.randint(0, 2)) if status == 'validated' else None,
            )
            # created_at est auto_now_add : la date d'historique ne passe que par un update
            InterventionSheet.objects.filter(pk=sheet.pk).update(
                created_at=timezone.make_aware(datetime.combine(sheet_date, datetime.min.time()))
            )
            sheets_created += 1

            n_tasks = random.randint(1, 3)
            candidates = list(applicable_catalog)
            random.shuffle(candidates)

            # Force une Distribution si le véhicule a du kilométrage/ancienneté et qu'elle n'a jamais été faite
            distribution_task = next((t for t in candidates if t.name == 'Distribution'), None)
            if distribution_task and not distribution_done and (km > 100000 or i == len(sheet_dates) - 2):
                task_defs = [distribution_task] + [t for t in candidates if t != distribution_task][:n_tasks - 1]
                distribution_done = True
            else:
                task_defs = candidates[:n_tasks]

            for task_catalog in task_defs:
                # Même sur une fiche validée, certaines tâches sont notées "à prévoir" (constatées
                # mais pas traitées lors de cette intervention) ; une fiche ouverte n'a pas encore
                # de travail réalisé donc tout y est à prévoir.
                if status == 'validated':
                    task_type = 'planned' if random.random() < 0.2 else 'done'
                else:
                    task_type = 'planned'
                # L'usure d'une intervention est l'état de la pièce posée (D4) : seules les tâches
                # d'usure réalisées en portent une, jamais sous le seuil d'alerte (règle du sérialiseur,
                # contournée ici par l'ORM). L'interface n'en saisit pas sur une tâche « à prévoir ».
                if task_catalog.is_wear_task and task_type == 'done':
                    wear_level = random.randint(wear_threshold + 1, max(wear_threshold + 1, 7))
                else:
                    wear_level = None

                task = InterventionTask.objects.create(
                    sheet=sheet,
                    type=task_type,
                    catalog_task=task_catalog,
                    description='',
                    wear_level=wear_level,
                )

                if task_type == 'done':
                    for name, price, qty in PART_PRICES.get(task_catalog.name, []):
                        InterventionTaskPart.objects.create(
                            task=task, name=name, unit_price=price, quantity=qty,
                        )

            if status == 'validated':
                MileageEntry.objects.create(
                    vehicle=vehicle, value=km, date=sheet.start_date,
                    source='intervention', source_id=sheet.id, author=author,
                )
                entries_created += 1

        # Entrée finale au kilométrage actuel réel du véhicule (cohérence avec Vehicle.kilometer)
        if last_km < end_km:
            MileageEntry.objects.create(
                vehicle=vehicle, value=end_km, date=today,
                source='manual_edit', author=random.choice(authors),
            )
            entries_created += 1

        return sheets_created, entries_created
