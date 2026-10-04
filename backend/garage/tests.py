import datetime
from django.utils import timezone

from types import SimpleNamespace

from django.db import IntegrityError, connection, transaction
from django.test import TestCase, SimpleTestCase, RequestFactory
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from core.models import Action
from api.models import Parking, Vehicle, Beneficiary, Contract
from .models import (
    MileageEntry, TaskCatalog, MaintenanceConfig, InterventionSheet, InterventionTask, InterventionTaskPart,
    GaragePhoto, AuditLog,
)
from .alerts import (
    get_config, add_months, load_maintenance_data, compute_task_statuses, compute_open_signalements,
    compute_other_work, CatalogTask, TaskOccurrence,
)
from .admin import MaintenanceConfigAdmin, TaskCatalogAdmin, TaskCatalogForm

User = get_user_model()


class TaskCatalogAPITestCase(APITestCase):
    def setUp(self):
        TaskCatalog.objects.all().delete()
        self.action = Action.objects.create(name='Test Action')
        self.user = User.objects.create_user(username='test@test.com', email='test@test.com', password='pass')
        self.user.current_action = self.action
        self.user.save()
        self.client.force_authenticate(user=self.user)

    def test_list_excludes_archived(self):
        TaskCatalog.objects.create(name='Active', vehicle_types=['voiture'])
        TaskCatalog.objects.create(name='Archived', vehicle_types=['voiture'], archived=True)
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 200)
        names = [t['name'] for t in response.data['results']]
        self.assertIn('Active', names)
        self.assertNotIn('Archived', names)

    def test_filter_by_vehicle_types_voiture(self):
        TaskCatalog.objects.create(name='Voiture only', vehicle_types=['voiture'])
        TaskCatalog.objects.create(name='Both', vehicle_types=['voiture', 'scouter'])
        TaskCatalog.objects.create(name='Scouter only', vehicle_types=['scouter'])
        response = self.client.get('/api/garage/task-catalog/?vehicle_types=voiture')
        names = [t['name'] for t in response.data['results']]
        self.assertIn('Voiture only', names)
        self.assertIn('Both', names)
        self.assertNotIn('Scouter only', names)

    def test_filter_by_vehicle_types_scouter(self):
        TaskCatalog.objects.create(name='Voiture only', vehicle_types=['voiture'])
        TaskCatalog.objects.create(name='Both', vehicle_types=['voiture', 'scouter'])
        TaskCatalog.objects.create(name='Scouter only', vehicle_types=['scouter'])
        response = self.client.get('/api/garage/task-catalog/?vehicle_types=scouter')
        names = [t['name'] for t in response.data['results']]
        self.assertNotIn('Voiture only', names)
        self.assertIn('Both', names)
        self.assertIn('Scouter only', names)

    def test_filter_by_vehicle_types_multiselect(self):
        TaskCatalog.objects.create(name='Voiture only', vehicle_types=['voiture'])
        TaskCatalog.objects.create(name='Scouter only', vehicle_types=['scouter'])
        response = self.client.get('/api/garage/task-catalog/?vehicle_types=voiture&vehicle_types=scouter')
        names = [t['name'] for t in response.data['results']]
        self.assertIn('Voiture only', names)
        self.assertIn('Scouter only', names)

    def test_archived_field_not_in_response(self):
        TaskCatalog.objects.create(name='Task', vehicle_types=['voiture'])
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('archived', response.data['results'][0])

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 401)

    def test_detail_endpoint(self):
        task = TaskCatalog.objects.create(name='Vidange', vehicle_types=['voiture', 'scouter'], km_periodicity=15000, is_critical=False)
        response = self.client.get(f'/api/garage/task-catalog/{task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Vidange')
        self.assertEqual(response.data['km_periodicity'], 15000)

    def test_is_wear_task_field_exposed(self):
        task = TaskCatalog.objects.create(name='Plaquettes de frein', vehicle_types=['voiture'], is_wear_task=True)
        response = self.client.get(f'/api/garage/task-catalog/{task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_wear_task'])


class MaintenanceConfigTestCase(TestCase):
    def setUp(self):
        MaintenanceConfig.objects.all().delete()

    def test_default_values(self):
        config = MaintenanceConfig.objects.create()
        self.assertEqual(config.ct_alert_days, 7)
        self.assertEqual(config.wear_alert_threshold, 4)
        self.assertEqual(config.wear_critical_threshold, 3)
        self.assertEqual(config.open_intervention_alert_days, 1)
        self.assertEqual(config.km_max_without_intervention, 8000)

    def test_get_config_returns_singleton(self):
        MaintenanceConfig.objects.create(ct_alert_days=21)
        config = get_config()
        self.assertEqual(config.ct_alert_days, 21)

    def test_get_config_creates_if_missing(self):
        config = get_config()
        self.assertIsNotNone(config.pk)
        self.assertEqual(config.ct_alert_days, 7)

    def test_singleton_constraint_via_admin(self):
        site = AdminSite()
        admin_instance = MaintenanceConfigAdmin(MaintenanceConfig, site)
        factory = RequestFactory()
        request = factory.get('/')

        self.assertTrue(admin_instance.has_add_permission(request))

        MaintenanceConfig.objects.create()
        self.assertFalse(admin_instance.has_add_permission(request))

    def test_has_delete_permission_always_false(self):
        site = AdminSite()
        admin_instance = MaintenanceConfigAdmin(MaintenanceConfig, site)
        factory = RequestFactory()
        request = factory.get('/')
        self.assertFalse(admin_instance.has_delete_permission(request))

    def test_clean_rejects_inverted_wear_thresholds(self):
        from django.core.exceptions import ValidationError
        config = MaintenanceConfig(wear_alert_threshold=2, wear_critical_threshold=5)
        with self.assertRaises(ValidationError):
            config.clean()

    def test_clean_accepts_valid_wear_thresholds(self):
        config = MaintenanceConfig(wear_alert_threshold=4, wear_critical_threshold=3)
        config.clean()  # ne doit pas lever d'exception

    def test_save_forces_pk_1(self):
        a = MaintenanceConfig.objects.create(ct_alert_days=7)
        b = MaintenanceConfig(ct_alert_days=21)
        b.save()
        self.assertEqual(MaintenanceConfig.objects.count(), 1)
        self.assertEqual(MaintenanceConfig.objects.get().ct_alert_days, 21)


class GaragePermissionsTestCase(TestCase):
    def setUp(self):
        from garage.apps import _setup_garage_groups
        _setup_garage_groups(sender=None)

    def _perm_qs(self, group_name):
        from django.contrib.auth.models import Group
        group = Group.objects.get(name=group_name)
        return set(group.permissions.filter(content_type__app_label='garage').values_list('codename', flat=True))

    def test_six_permissions_exist(self):
        from django.contrib.auth.models import Permission
        codenames = [
            'view_dashboard', 'view_vehicle', 'manage_intervention',
            'manage_inspection', 'correct_mileage', 'override_maintenance_block',
        ]
        for codename in codenames:
            self.assertTrue(
                Permission.objects.filter(content_type__app_label='garage', codename=codename).exists(),
                f"Permission garage.{codename} manquante"
            )

    def test_garagiste_has_four_permissions_not_sensitive(self):
        perms = self._perm_qs('Garagiste')
        self.assertIn('view_dashboard', perms)
        self.assertIn('view_vehicle', perms)
        self.assertIn('manage_intervention', perms)
        self.assertIn('manage_inspection', perms)
        self.assertNotIn('correct_mileage', perms)
        self.assertNotIn('override_maintenance_block', perms)

    def test_referent_lacks_manage_intervention(self):
        perms = self._perm_qs('Référents')
        self.assertNotIn('manage_intervention', perms)

    def test_responsable_referents_has_sensitive_permissions(self):
        perms = self._perm_qs('Responsable référents')
        self.assertIn('correct_mileage', perms)
        self.assertIn('override_maintenance_block', perms)

    def test_responsable_garagiste_has_sensitive_permissions(self):
        perms = self._perm_qs('Responsable garagiste')
        self.assertIn('correct_mileage', perms)
        self.assertIn('override_maintenance_block', perms)

    def test_correct_mileage_on_mileageentry_not_maintenanceconfig(self):
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        mc_ct = ContentType.objects.get_for_model(MaintenanceConfig)
        me_ct = ContentType.objects.get_for_model(MileageEntry)
        self.assertFalse(
            Permission.objects.filter(codename='correct_mileage', content_type=mc_ct).exists()
        )
        self.assertTrue(
            Permission.objects.filter(codename='correct_mileage', content_type=me_ct).exists()
        )


class MileageEntrySignalTestCase(TestCase):
    def setUp(self):
        self.action = Action.objects.create(name='Test Garage')
        self.user = User.objects.create_superuser(
            username='admin@test.com', email='admin@test.com', password='pass',
            phone='0600000000', first_name='Admin', last_name='Test',
        )
        self.parking = Parking.objects.create(name='Dépôt')
        self.vehicle = Vehicle.objects.create(
            brand='Renault', modele='Clio', year=2020, imat='BB-001-BB',
            fleet_id=99, kilometer=10000, status='available',
            parking=self.parking, action=self.action,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )

    def _make_entry(self, value, date_offset=0):
        return MileageEntry.objects.create(
            vehicle=self.vehicle,
            value=value,
            date=datetime.date(2024, 1, 1) + datetime.timedelta(days=date_offset),
            source='contract',
            author=self.user,
        )

    def test_post_save_updates_vehicle_kilometer_if_most_recent(self):
        self._make_entry(value=12000, date_offset=0)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.kilometer, 12000)

    def test_post_save_does_not_update_if_older_entry(self):
        # Créer d'abord une entrée récente
        self._make_entry(value=15000, date_offset=10)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.kilometer, 15000)

        # Puis une entrée plus ancienne — ne doit pas écraser
        self._make_entry(value=11000, date_offset=0)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.kilometer, 15000)


class MileageDataMigrationTestCase(TestCase):
    """
    Teste la logique de la data migration en appelant directement la fonction RunPython.
    Avec le registre réel (django.apps.apps), les signaux se déclenchent — on n'asserte
    donc que les entrées créées, pas vehicle.kilometer.
    """

    def setUp(self):
        self.action = Action.objects.create(name='Migration Test')
        self.system_user = User.objects.create_superuser(
            username='sys@test.com', email='sys@test.com', password='pass',
            phone='0600000000', first_name='Sys', last_name='User',
        )
        self.parking = Parking.objects.create(name='Test Parking')

    def _make_vehicle(self, imat, kilometer=5000):
        return Vehicle.objects.create(
            brand='Peugeot', modele='208', year=2019, imat=imat,
            fleet_id=hash(imat) % 1000, kilometer=kilometer, status='available',
            parking=self.parking, action=self.action,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )

    def _get_migrate_fn(self):
        import importlib
        mod = importlib.import_module('garage.migrations.0009_data_mileage_migration')
        return mod.migrate_mileage_from_contracts

    def test_migration_creates_entries_from_contracts(self):
        migrate_mileage_from_contracts = self._get_migrate_fn()
        vehicle = self._make_vehicle('CC-002-CC', kilometer=20000)
        from api.models import Beneficiary, Contract
        beneficiary = Beneficiary.objects.create(
            first_name='Jean', last_name='Dupont', phone='0600000000',
            address='1 rue Test', email='jean@test.com',
            city='Paris', postal_code='75001', action=self.action,
        )
        Contract.objects.create(
            vehicle=vehicle, beneficiary=beneficiary,
            start_date=datetime.date(2023, 1, 1),
            end_date=datetime.date(2023, 2, 1),
            price=300, discount=0, deposit=50,
            start_kilometer=18000, end_kilometer=19500,
            referent=self.system_user, action=self.action, status='payed',
        )

        import django.apps
        migrate_mileage_from_contracts(django.apps.apps, None)

        entries = MileageEntry.objects.filter(vehicle=vehicle).order_by('date')
        self.assertEqual(entries.count(), 2)
        self.assertEqual(entries[0].value, 18000)
        self.assertEqual(entries[0].source, 'contract')
        self.assertEqual(entries[1].value, 19500)
        self.assertEqual(entries[1].source, 'contract')

    def test_migration_fallback_for_vehicle_without_km_contracts(self):
        migrate_mileage_from_contracts = self._get_migrate_fn()
        vehicle = self._make_vehicle('DD-003-DD', kilometer=7777)

        import django.apps
        migrate_mileage_from_contracts(django.apps.apps, None)

        entries = MileageEntry.objects.filter(vehicle=vehicle)
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().value, 7777)
        self.assertEqual(entries.first().source, 'migration')


class MileageDataMigrationHistoricalModelTestCase(TestCase):
    """
    Reproduit le contexte réel d'une exécution `manage.py migrate` : la fonction
    RunPython reçoit des classes de modèles historiques (via ProjectState),
    distinctes de garage.models.MileageEntry. Le signal post_save — connecté à
    la classe live via sender='garage.MileageEntry' — ne doit donc PAS se
    déclencher ici, contrairement à MileageDataMigrationTestCase ci-dessus qui
    utilise le registre live (django.apps.apps) et déclenche le signal par
    accident. Valide la Tâche 3.5 sur le vrai mécanisme d'exécution.
    """

    def setUp(self):
        self.action = Action.objects.create(name='Migration Historical')
        self.system_user = User.objects.create_superuser(
            username='syshist@test.com', email='syshist@test.com', password='pass',
            phone='0600000000', first_name='Sys', last_name='Historical',
        )
        self.parking = Parking.objects.create(name='Historical Parking')
        self.vehicle = Vehicle.objects.create(
            brand='Dacia', modele='Sandero', year=2018, imat='EE-004-EE',
            fleet_id=444, kilometer=3000, status='available',
            parking=self.parking, action=self.action,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )
        from api.models import Beneficiary, Contract
        beneficiary = Beneficiary.objects.create(
            first_name='Alice', last_name='Martin', phone='0600000001',
            address='2 rue Test', email='alice@test.com',
            city='Lyon', postal_code='69001', action=self.action,
        )
        Contract.objects.create(
            vehicle=self.vehicle, beneficiary=beneficiary,
            start_date=datetime.date(2023, 3, 1),
            end_date=datetime.date(2023, 4, 1),
            price=300, discount=0, deposit=50,
            start_kilometer=50000, end_kilometer=51000,
            referent=self.system_user, action=self.action, status='payed',
        )

    def test_migration_via_historical_models_does_not_trigger_kilometer_update(self):
        import importlib
        from django.db import connection
        from django.db.migrations.loader import MigrationLoader

        loader = MigrationLoader(connection)
        state = loader.project_state(('garage', '0009_data_mileage_migration'))
        historical_apps = state.apps

        mod = importlib.import_module('garage.migrations.0009_data_mileage_migration')
        mod.migrate_mileage_from_contracts(historical_apps, None)

        self.vehicle.refresh_from_db()
        self.assertEqual(
            self.vehicle.kilometer, 3000,
            "Vehicle.kilometer ne doit pas être modifié par la migration (Tâche 3.5) : "
            "avec les modèles historiques, le signal post_save (connecté à la classe live) "
            "ne se déclenche pas."
        )

        entries = MileageEntry.objects.filter(vehicle=self.vehicle)
        self.assertEqual(entries.count(), 2)


class MileageHistoryAPITestCase(APITestCase):
    def setUp(self):
        from garage.apps import _setup_garage_groups
        _setup_garage_groups(sender=None)

        self.action_a = Action.objects.create(name='Action A')
        self.action_b = Action.objects.create(name='Action B')
        self.action_c = Action.objects.create(name='Action C')

        self.parking = Parking.objects.create(name='Dépôt')

        self.garagiste = User.objects.create_user(
            username='garagiste@test.com', email='garagiste@test.com', password='pass',
            phone='0600000001', first_name='Jean', last_name='Garagiste',
        )
        self.garagiste.actions.set([self.action_a, self.action_b])
        self.garagiste.current_action = self.action_a
        self.garagiste.save()
        garagiste_group = Group.objects.get(name='Garagiste')
        self.garagiste.groups.add(garagiste_group)

        self.referent = User.objects.create_user(
            username='referent@test.com', email='referent@test.com', password='pass',
            phone='0600000002', first_name='Marie', last_name='Référent',
        )
        self.referent.actions.set([self.action_a, self.action_b])
        self.referent.current_action = self.action_a
        self.referent.save()

        self.vehicle_a = Vehicle.objects.create(
            brand='Renault', modele='Clio', year=2020, imat='AA-001-AA',
            fleet_id=1, kilometer=10000, status='available',
            parking=self.parking, action=self.action_a,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )
        self.vehicle_b = Vehicle.objects.create(
            brand='Peugeot', modele='208', year=2021, imat='BB-002-BB',
            fleet_id=2, kilometer=5000, status='available',
            parking=self.parking, action=self.action_b,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )
        self.vehicle_c = Vehicle.objects.create(
            brand='Citroën', modele='C3', year=2019, imat='CC-003-CC',
            fleet_id=3, kilometer=8000, status='available',
            parking=self.parking, action=self.action_c,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )

        self.entry_a1 = MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=9000,
            date=datetime.date(2024, 1, 1), source='contract', author=self.garagiste,
        )
        self.entry_a2 = MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10000,
            date=datetime.date(2024, 6, 1), source='contract', author=self.garagiste,
        )

        self.responsable = User.objects.create_user(
            username='responsable@test.com', email='responsable@test.com', password='pass',
            phone='0600000003', first_name='Paul', last_name='Responsable',
        )
        self.responsable.actions.set([self.action_a])
        self.responsable.current_action = self.action_a
        self.responsable.save()
        self.responsable.groups.add(Group.objects.get(name='Responsable garagiste'))

        self.beneficiary = Beneficiary.objects.create(
            first_name='Alice', last_name='Dupont', phone='0600000004',
            address='1 rue de Test', email='alice@test.com',
            city='Paris', postal_code='75000', action=self.action_a,
        )
        self.contract = Contract.objects.create(
            vehicle=self.vehicle_a, beneficiary=self.beneficiary, referent=self.garagiste,
            start_date=datetime.date(2024, 1, 1), end_date=datetime.date(2024, 2, 1),
            price=100, deposit=50, start_kilometer=9000,
        )
        self.entry_contract_start = MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=9000, date=datetime.date(2024, 1, 1),
            source='contract_start', source_id=self.contract.id, author=self.garagiste,
        )

    def _url(self, vehicle):
        return f'/api/garage/mileage/{vehicle.id}/'

    def _correct_url(self, vehicle):
        return f'/api/garage/mileage/{vehicle.id}/correct/'

    def test_garagiste_sees_history_in_action_a(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_a))
        self.assertEqual(response.status_code, 200)
        ids = [e['id'] for e in response.data['results']]
        self.assertIn(self.entry_a1.id, ids)
        self.assertIn(self.entry_a2.id, ids)

    def test_beneficiary_display_for_contract_entry(self):
        # Le garagiste n'a pas la permission api.view_contract mais doit tout de même
        # voir le nom du bénéficiaire (référence sans lien côté frontend).
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_a))
        entry = next(e for e in response.data['results'] if e['id'] == self.entry_contract_start.id)
        self.assertEqual(entry['beneficiary_display'], 'Alice Dupont')

    def test_beneficiary_display_none_for_non_contract_source(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_a))
        entry = next(e for e in response.data['results'] if e['id'] == self.entry_a1.id)
        self.assertIsNone(entry['beneficiary_display'])

    def test_garagiste_sees_history_in_action_b(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_b))
        self.assertEqual(response.status_code, 200)

    def test_garagiste_gets_403_for_vehicle_in_inaccessible_action(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_c))
        self.assertEqual(response.status_code, 403)

    def test_non_numeric_vehicle_pk_returns_404(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get('/api/garage/mileage/abc/')
        self.assertEqual(response.status_code, 404)

    def test_referent_sees_history_in_current_action(self):
        self.client.force_authenticate(user=self.referent)
        response = self.client.get(self._url(self.vehicle_a))
        self.assertEqual(response.status_code, 200)

    def test_referent_gets_403_for_vehicle_outside_current_action(self):
        # Le référent appartient à action_b mais sa current_action est action_a
        self.client.force_authenticate(user=self.referent)
        response = self.client.get(self._url(self.vehicle_b))
        self.assertEqual(response.status_code, 403)

    def test_entries_sorted_by_date_descending(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_a))
        self.assertEqual(response.status_code, 200)
        dates = [e['date'] for e in response.data['results']]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_responsable_can_correct_mileage(self):
        self.client.force_authenticate(user=self.responsable)
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['source'], 'correction')
        correction = MileageEntry.objects.get(pk=response.data['id'])
        self.assertEqual(correction.value, 10500)
        self.assertEqual(correction.corrects_id, self.entry_a2.id)
        self.assertEqual(correction.correction_reason, 'Erreur de saisie')
        self.assertEqual(correction.author, self.responsable)
        # La date de l'historique reste celle de l'entrée corrigée (pas la date du jour) ;
        # la date à laquelle la correction a réellement été faite est tracée via created_at.
        self.assertEqual(correction.date, self.entry_a2.date)
        self.assertIsNotNone(correction.created_at)

    def test_correction_marks_original_entry_as_corrected(self):
        self.client.force_authenticate(user=self.responsable)
        self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.entry_a2.refresh_from_db()
        self.assertTrue(self.entry_a2.is_corrected)

    def test_correcting_most_recent_entry_updates_vehicle_kilometer(self):
        self.client.force_authenticate(user=self.responsable)
        self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10500)

    def test_correcting_older_entry_does_not_change_vehicle_kilometer(self):
        self.client.force_authenticate(user=self.responsable)
        # entry_a1 (2024-01-01) est plus ancienne qu'entry_a2 (2024-06-01, toujours non
        # corrigée) : la correction hérite de la date de l'entrée corrigée (2024-01-01),
        # elle ne doit donc pas devancer entry_a2 dans le recalcul de kilometer.
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a1.id, 'value': 9500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 201)
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10000)

    def test_user_without_correct_mileage_permission_gets_403(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 403)

    def test_empty_reason_returns_400(self):
        self.client.force_authenticate(user=self.responsable)
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': '',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('reason', response.data)

    def test_entry_belonging_to_another_vehicle_returns_400(self):
        self.client.force_authenticate(user=self.responsable)
        entry_b1 = MileageEntry.objects.create(
            vehicle=self.vehicle_b, value=5500,
            date=datetime.date(2024, 3, 1), source='contract', author=self.garagiste,
        )
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': entry_b1.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('entry', response.data)

    def test_nonexistent_entry_returns_400(self):
        self.client.force_authenticate(user=self.responsable)
        response = self.client.post(self._correct_url(self.vehicle_a), {
            'entry': 999999, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('entry', response.data)

    def test_nonexistent_vehicle_pk_returns_404_on_correct(self):
        self.client.force_authenticate(user=self.responsable)
        response = self.client.post('/api/garage/mileage/999999/correct/', {
            'entry': self.entry_a2.id, 'value': 10500, 'reason': 'Erreur de saisie',
        })
        self.assertEqual(response.status_code, 404)


class InterventionSheetAPITestCase(APITestCase):
    def setUp(self):
        from garage.apps import _setup_garage_groups
        _setup_garage_groups(sender=None)

        self.action_a = Action.objects.create(name='Action A')
        self.action_b = Action.objects.create(name='Action B')
        self.action_c = Action.objects.create(name='Action C')

        self.parking = Parking.objects.create(name='Dépôt')

        self.garagiste = User.objects.create_user(
            username='garagiste2@test.com', email='garagiste2@test.com', password='pass',
            phone='0600000011', first_name='Jean', last_name='Garagiste',
        )
        self.garagiste.actions.set([self.action_a, self.action_b])
        self.garagiste.current_action = self.action_a
        self.garagiste.save()
        self.garagiste.groups.add(Group.objects.get(name='Garagiste'))

        self.referent = User.objects.create_user(
            username='referent2@test.com', email='referent2@test.com', password='pass',
            phone='0600000012', first_name='Marie', last_name='Référent',
        )
        self.referent.actions.set([self.action_a, self.action_b])
        self.referent.current_action = self.action_a
        self.referent.save()
        self.referent.groups.add(Group.objects.get(name='Référents'))

        self.vehicle_a = Vehicle.objects.create(
            brand='Renault', modele='Clio', year=2020, imat='AA-101-AA',
            fleet_id=11, kilometer=10000, status='available',
            parking=self.parking, action=self.action_a,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )
        self.vehicle_b = Vehicle.objects.create(
            brand='Peugeot', modele='208', year=2021, imat='BB-102-BB',
            fleet_id=12, kilometer=5000, status='available',
            parking=self.parking, action=self.action_b,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )
        self.vehicle_c = Vehicle.objects.create(
            brand='Citroën', modele='C3', year=2019, imat='CC-103-CC',
            fleet_id=13, kilometer=8000, status='available',
            parking=self.parking, action=self.action_c,
            fuel_type='essence', transmission='manuelle', type='voiture',
        )

        self.catalog_task_periodic = TaskCatalog.objects.create(
            name='Vidange', vehicle_types=['voiture'], km_periodicity=10000,
        )
        self.catalog_task_no_periodicity = TaskCatalog.objects.create(
            name='Nettoyage', vehicle_types=['voiture'],
        )

    def _list_url(self):
        return '/api/garage/intervention/'

    def _detail_url(self, sheet):
        return f'/api/garage/intervention/{sheet.id}/'

    def _tasks_url(self, sheet):
        return f'/api/garage/intervention/{sheet.id}/tasks/'

    def _validate_url(self, sheet):
        return f'/api/garage/intervention/{sheet.id}/validate/'

    def _maintenance(self, vehicle=None):
        response = self.client.get(f'/api/garage/maintenance/{(vehicle or self.vehicle_a).id}/')
        self.assertEqual(response.status_code, 200)
        return response.data

    def _maintenance_row(self, catalog_task, vehicle=None):
        rows = [row for row in self._maintenance(vehicle)['tasks'] if row['catalog_task_id'] == catalog_task.id]
        self.assertEqual(len(rows), 1)
        return rows[0]

    def test_create_sheet_by_garagiste(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.post(self._list_url(), {'vehicle': self.vehicle_a.id})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'open')
        self.assertEqual(response.data['current_step'], 1)
        sheet = InterventionSheet.objects.get(pk=response.data['id'])
        self.assertEqual(sheet.created_by, self.garagiste)

    def test_create_sheet_for_out_of_scope_vehicle_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.post(self._list_url(), {'vehicle': self.vehicle_c.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(InterventionSheet.objects.count(), 0)

    def test_referent_forbidden_on_write_actions(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)

        self.client.force_authenticate(user=self.referent)
        self.assertEqual(self.client.post(self._list_url(), {'vehicle': self.vehicle_a.id}).status_code, 403)
        self.assertEqual(
            self.client.patch(self._detail_url(sheet), {'current_step': 2}, format='json').status_code, 403
        )
        self.assertEqual(
            self.client.post(self._tasks_url(sheet), {'type': 'done', 'description': 'Test'}).status_code, 403
        )
        self.assertEqual(self.client.post(self._validate_url(sheet)).status_code, 403)

    def test_patch_start_mileage_valid(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(
            self._detail_url(sheet), {'start_mileage': 10500, 'current_step': 2}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10500)
        self.assertEqual(sheet.current_step, 2)

    def test_search_by_vehicle_imat(self):
        self.client.force_authenticate(user=self.garagiste)
        InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        other_sheet = InterventionSheet.objects.create(vehicle=self.vehicle_b, created_by=self.garagiste)
        self.garagiste.current_action = self.action_b
        self.garagiste.save()

        response = self.client.get(self._list_url(), {'search': self.vehicle_b.imat})
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual([r['id'] for r in results], [other_sheet.id])

    def test_patch_start_mileage_lower_than_vehicle_kilometer_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(self._detail_url(sheet), {'start_mileage': 9000}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

    def test_create_task_with_catalog_wear_and_parts(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done',
            'catalog_task': self.catalog_task_periodic.id,
            'wear_level': 3,
            'parts': [{'name': 'Filtre à huile', 'unit_price': '12.50', 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        task = InterventionTask.objects.get(pk=response.data['id'])
        self.assertEqual(task.sheet, sheet)
        self.assertEqual(task.parts.count(), 1)

    def test_create_free_task_without_catalog(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'planned', 'name': 'Vérifier les freins', 'description': 'RAS',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Vérifier les freins')

    def test_create_free_task_without_name_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'planned', 'description': 'Sans nom ni catalogue',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)

    def test_create_task_with_photo(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        image_b64 = (
            'data:image/png;base64,'
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        )
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'name': 'Nettoyage', 'photos': [image_b64],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data['photos']), 1)
        self.assertIn('id', response.data['photos'][0])
        self.assertIn('url', response.data['photos'][0])
        task = InterventionTask.objects.get(pk=response.data['id'])
        self.assertEqual(GaragePhoto.objects.filter(object_id=task.pk).count(), 1)

    def test_validate_sheet_creates_mileage_entry_and_realization(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_mileage=10500,
            start_date=datetime.date(2026, 1, 1), end_date=datetime.date(2026, 1, 3),
        )
        InterventionTask.objects.create(
            sheet=sheet, type='done', catalog_task=self.catalog_task_periodic,
        )
        InterventionTask.objects.create(
            sheet=sheet, type='planned', catalog_task=self.catalog_task_periodic,
        )
        InterventionTask.objects.create(
            sheet=sheet, type='done', catalog_task=self.catalog_task_no_periodicity,
        )

        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 200)
        sheet.refresh_from_db()
        self.assertEqual(sheet.status, 'validated')

        entry = MileageEntry.objects.get(vehicle=self.vehicle_a, source='intervention')
        self.assertEqual(entry.value, 10500)

        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10500)

        summary = self._maintenance()
        row = next(r for r in summary['tasks'] if r['catalog_task_id'] == self.catalog_task_periodic.id)
        # Datée à la start_date de la fiche (et non à end_date) : une seule règle de date (D1)
        self.assertEqual(row['last_realization']['date'], '2026-01-01')
        self.assertEqual(row['last_realization']['km'], 10500)
        self.assertEqual(row['last_realization']['sheet_id'], sheet.id)
        # La tâche « à prévoir » de la même fiche est close par la réalisation
        self.assertEqual(row['signalements'], [])
        self.assertNotIn(self.catalog_task_no_periodicity.id, [r['catalog_task_id'] for r in summary['tasks']])
        self.assertEqual(
            [w['catalog_task_id'] for w in summary['other_work']], [self.catalog_task_no_periodicity.id],
        )

    def test_garagiste_multi_action_can_act_on_vehicle_b(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.post(self._list_url(), {'vehicle': self.vehicle_b.id})
        self.assertEqual(response.status_code, 201)

    def test_garagiste_cannot_access_sheet_for_vehicle_c(self):
        other_garagiste = User.objects.create_user(
            username='garagiste-c@test.com', email='garagiste-c@test.com', password='pass',
            phone='0600000013', first_name='Paul', last_name='GarC',
        )
        other_garagiste.actions.set([self.action_c])
        other_garagiste.current_action = self.action_c
        other_garagiste.save()
        other_garagiste.groups.add(Group.objects.get(name='Garagiste'))
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_c, created_by=other_garagiste)

        self.client.force_authenticate(user=self.garagiste)
        self.assertEqual(self.client.get(self._detail_url(sheet)).status_code, 404)
        self.assertEqual(
            self.client.patch(self._detail_url(sheet), {'current_step': 2}, format='json').status_code, 404
        )
        self.assertEqual(
            self.client.post(self._tasks_url(sheet), {'type': 'done', 'name': 'Test'}).status_code, 404
        )
        self.assertEqual(self.client.post(self._validate_url(sheet)).status_code, 404)

    # ── task_detail : édition/suppression par tâche (story 2.6, Tâche 1.6) ──────

    IMAGE_B64 = (
        'data:image/png;base64,'
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    )

    def _task_detail_url(self, sheet, task):
        return f'/api/garage/intervention/{sheet.id}/tasks/{task.id}/'

    def _make_open_sheet_with_task(self, **task_kwargs):
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        task = InterventionTask.objects.create(sheet=sheet, type='done', **task_kwargs)
        return sheet, task

    def test_patch_task_description_and_wear_level(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(catalog_task=self.catalog_task_periodic, wear_level=8)
        response = self.client.patch(
            self._task_detail_url(sheet, task),
            {'description': 'Huile 5W30', 'wear_level': 4}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.description, 'Huile 5W30')
        self.assertEqual(task.wear_level, 4)

    def test_patch_task_parts_replaces_previous(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(catalog_task=self.catalog_task_periodic)
        InterventionTaskPart.objects.create(task=task, name='Ancienne', unit_price='5.00', quantity=1)
        response = self.client.patch(
            self._task_detail_url(sheet, task),
            {'parts': [{'name': 'Neuve', 'unit_price': '9.90', 'quantity': 2}]}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        names = list(task.parts.values_list('name', flat=True))
        self.assertEqual(names, ['Neuve'])

    def test_patch_task_add_and_remove_photos(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(name='Nettoyage')
        add = self.client.patch(
            self._task_detail_url(sheet, task),
            {'add_photos': [self.IMAGE_B64]}, format='json',
        )
        self.assertEqual(add.status_code, 200)
        self.assertEqual(len(add.data['photos']), 1)
        photo_id = add.data['photos'][0]['id']
        self.assertEqual(GaragePhoto.objects.filter(object_id=task.pk).count(), 1)

        remove = self.client.patch(
            self._task_detail_url(sheet, task),
            {'remove_photo_ids': [photo_id]}, format='json',
        )
        self.assertEqual(remove.status_code, 200)
        self.assertEqual(len(remove.data['photos']), 0)
        self.assertEqual(GaragePhoto.objects.filter(object_id=task.pk).count(), 0)

    def test_delete_task_removes_task_and_photos(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(name='À supprimer')
        content_type = ContentType.objects.get_for_model(InterventionTask)
        GaragePhoto.objects.create(
            image=SimpleUploadedFile('p.png', b'\x89PNG\r\n', content_type='image/png'),
            content_type=content_type, object_id=task.pk,
        )
        response = self.client.delete(self._task_detail_url(sheet, task))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(InterventionTask.objects.filter(pk=task.pk).exists())
        self.assertEqual(GaragePhoto.objects.filter(object_id=task.pk).count(), 0)

    def test_referent_forbidden_on_task_detail(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(name='X')
        self.client.force_authenticate(user=self.referent)
        self.assertEqual(
            self.client.patch(self._task_detail_url(sheet, task), {'description': 'Y'}, format='json').status_code, 403
        )
        self.assertEqual(self.client.delete(self._task_detail_url(sheet, task)).status_code, 403)

    def test_task_detail_task_of_other_sheet_returns_404(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet_a, task_a = self._make_open_sheet_with_task(name='A')
        sheet_b = InterventionSheet.objects.create(vehicle=self.vehicle_b, created_by=self.garagiste)
        # task_a appartient à sheet_a, on tente d'y accéder via sheet_b
        response = self.client.patch(
            self._task_detail_url(sheet_b, task_a), {'description': 'Z'}, format='json',
        )
        self.assertEqual(response.status_code, 404)

    # ── filterset InterventionSheetFilter (story 2.6, Tâche 1.8) ───────────────

    def test_filter_by_vehicle_and_status(self):
        self.client.force_authenticate(user=self.garagiste)
        validated = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, status='validated', start_mileage=10500,
            start_date=datetime.date(2026, 1, 1),
        )
        InterventionTask.objects.create(sheet=validated, type='planned', name='À prévoir')
        InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste, status='open')
        response = self.client.get(f'{self._list_url()}?vehicle={self.vehicle_a.id}&status=validated')
        self.assertEqual(response.status_code, 200)
        ids = [s['id'] for s in response.data['results']]
        self.assertEqual(ids, [validated.id])
        self.assertEqual(len(response.data['results'][0]['tasks']), 1)

    def test_filter_by_status_and_created_by(self):
        self.client.force_authenticate(user=self.garagiste)
        mine = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste, status='open')
        response = self.client.get(f'{self._list_url()}?status=open&created_by={self.garagiste.id}')
        self.assertEqual(response.status_code, 200)
        ids = [s['id'] for s in response.data['results']]
        self.assertIn(mine.id, ids)

    def test_filter_by_out_of_scope_vehicle_returns_empty(self):
        # vehicle_c appartient à action_c, hors périmètre du garagiste (actions A+B)
        InterventionSheet.objects.create(
            vehicle=self.vehicle_c, created_by=self.garagiste, status='validated', start_mileage=8000,
            start_date=datetime.date(2026, 1, 1),
        )
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(f'{self._list_url()}?vehicle={self.vehicle_c.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])

    # ── Story 2.7 : éditabilité des fiches validées + traçabilité AuditLog ─────

    def _audit_log_url(self, sheet):
        return f'/api/garage/intervention/{sheet.id}/audit-log/'

    def _make_validated_sheet(self, **kwargs):
        defaults = {
            'vehicle': self.vehicle_a, 'created_by': self.garagiste, 'status': 'validated',
            'start_mileage': 10500, 'start_date': datetime.date(2026, 1, 1),
        }
        defaults.update(kwargs)
        return InterventionSheet.objects.create(**defaults)

    def test_patch_dates_on_validated_sheet_creates_audit_log(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        response = self.client.patch(
            self._detail_url(sheet), {'start_date': '2026-01-05'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        sheet.refresh_from_db()
        self.assertEqual(str(sheet.start_date), '2026-01-05')
        log = AuditLog.objects.get(field_name='start_date')
        self.assertEqual(log.action, 'field_modified')
        self.assertEqual(log.old_value, '2026-01-01')
        self.assertEqual(log.new_value, '2026-01-05')
        self.assertEqual(log.author, self.garagiste)

        # Aucun changement (même valeur) → pas de nouveau log
        response = self.client.patch(
            self._detail_url(sheet), {'start_date': '2026-01-05'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditLog.objects.filter(field_name='start_date').count(), 1)

    def test_patch_start_mileage_on_validated_sheet_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        response = self.client.patch(
            self._detail_url(sheet), {'start_mileage': 11000}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10500)
        self.assertFalse(AuditLog.objects.exists())

    def test_patch_open_sheet_stepper_flow_creates_no_audit_log(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(
            self._detail_url(sheet), {'start_mileage': 10500, 'current_step': 2}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AuditLog.objects.exists())

    def test_patch_task_fields_on_validated_sheet_creates_audit_logs(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(
            sheet=sheet, type='done', name='Nettoyage', description='Avant', wear_level=8,
        )
        response = self.client.patch(
            self._task_detail_url(sheet, task),
            {'name': 'Nettoyage moteur', 'description': 'Après', 'wear_level': 4}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditLog.objects.filter(field_name='name').count(), 1)
        self.assertEqual(AuditLog.objects.filter(field_name='description').count(), 1)
        self.assertEqual(AuditLog.objects.filter(field_name='wear_level').count(), 1)

        response = self.client.patch(
            self._task_detail_url(sheet, task),
            {'parts': [{'name': 'Filtre', 'unit_price': '9.90', 'quantity': 1}]}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditLog.objects.filter(field_name='parts').count(), 1)

        response = self.client.patch(
            self._task_detail_url(sheet, task),
            {'add_photos': [self.IMAGE_B64]}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditLog.objects.filter(field_name='photos').count(), 1)

    def test_delete_task_on_validated_sheet_creates_audit_log(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(sheet=sheet, type='done', name='À supprimer')
        response = self.client.delete(self._task_detail_url(sheet, task))
        self.assertEqual(response.status_code, 204)
        log = AuditLog.objects.get(action='task_deleted')
        self.assertEqual(log.author, self.garagiste)
        self.assertFalse(InterventionTask.objects.filter(pk=task.pk).exists())

    def test_patch_and_delete_task_on_open_sheet_creates_no_audit_log(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._make_open_sheet_with_task(name='X')
        response = self.client.patch(
            self._task_detail_url(sheet, task), {'description': 'Y'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AuditLog.objects.exists())

        sheet2, task2 = self._make_open_sheet_with_task(name='Z')
        response = self.client.delete(self._task_detail_url(sheet2, task2))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(AuditLog.objects.exists())

    def test_audit_log_returns_sheet_and_task_logs(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        self.client.patch(self._detail_url(sheet), {'start_date': '2026-01-05'}, format='json')
        task = InterventionTask.objects.create(sheet=sheet, type='done', name='Nettoyage', description='Avant')
        self.client.patch(self._task_detail_url(sheet, task), {'description': 'Après'}, format='json')

        response = self.client.get(self._audit_log_url(sheet))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['field_name'], 'description')
        self.assertEqual(response.data[1]['field_name'], 'start_date')

        self.client.force_authenticate(user=self.referent)
        response = self.client.get(self._audit_log_url(sheet))
        self.assertEqual(response.status_code, 200)

        other_garagiste = User.objects.create_user(
            username='garagiste-d@test.com', email='garagiste-d@test.com', password='pass',
            phone='0600000014', first_name='Léa', last_name='GarD',
        )
        other_garagiste.actions.set([self.action_c])
        other_garagiste.current_action = self.action_c
        other_garagiste.save()
        other_garagiste.groups.add(Group.objects.get(name='Garagiste'))
        self.client.force_authenticate(user=other_garagiste)
        response = self.client.get(self._audit_log_url(sheet))
        self.assertEqual(response.status_code, 404)

    def test_post_task_on_validated_sheet_creates_audit_log_and_realization(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': self.catalog_task_periodic.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AuditLog.objects.filter(action='task_added').count(), 1)
        row = self._maintenance_row(self.catalog_task_periodic)
        self.assertEqual(row['last_realization']['km'], sheet.start_mileage)
        self.assertEqual(row['last_realization']['task_id'], response.data['id'])

        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': self.catalog_task_no_periodicity.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AuditLog.objects.filter(action='task_added').count(), 2)
        self.assertIn(
            self.catalog_task_no_periodicity.id, [w['catalog_task_id'] for w in self._maintenance()['other_work']],
        )

        response = self.client.post(self._tasks_url(sheet), {'type': 'planned', 'name': 'Libre'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AuditLog.objects.filter(action='task_added').count(), 3)

    def test_post_task_on_open_sheet_creates_no_audit_log_and_no_realization(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_mileage=10500,
        )
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': self.catalog_task_periodic.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertFalse(AuditLog.objects.exists())
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['status'], 'not_recorded')

    def test_delete_only_occurrence_returns_to_not_recorded(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(
            sheet=sheet, type='done', catalog_task=self.catalog_task_periodic,
        )
        self.assertIsNotNone(self._maintenance_row(self.catalog_task_periodic)['last_realization'])
        response = self.client.delete(self._task_detail_url(sheet, task))
        self.assertEqual(response.status_code, 204)
        row = self._maintenance_row(self.catalog_task_periodic)
        self.assertEqual(row['status'], 'not_recorded')
        self.assertIsNone(row['last_realization'])

    def test_delete_recent_occurrence_falls_back_to_older_one(self):
        self.client.force_authenticate(user=self.garagiste)
        older_sheet = self._make_validated_sheet(start_mileage=9500, start_date=datetime.date(2025, 1, 1))
        InterventionTask.objects.create(sheet=older_sheet, type='done', catalog_task=self.catalog_task_periodic)
        recent_sheet = self._make_validated_sheet(start_mileage=10500, start_date=datetime.date(2026, 1, 1))
        recent_task = InterventionTask.objects.create(
            sheet=recent_sheet, type='done', catalog_task=self.catalog_task_periodic,
        )
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['last_realization']['km'], 10500)
        response = self.client.delete(self._task_detail_url(recent_sheet, recent_task))
        self.assertEqual(response.status_code, 204)
        row = self._maintenance_row(self.catalog_task_periodic)
        self.assertEqual(row['last_realization']['km'], older_sheet.start_mileage)
        self.assertEqual(row['last_realization']['date'], '2025-01-01')

    def test_patch_start_date_of_validated_sheet_moves_realization_date(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=self.catalog_task_periodic)
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['last_realization']['date'], '2026-01-01')
        response = self.client.patch(self._detail_url(sheet), {'start_date': '2026-01-05'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['last_realization']['date'], '2026-01-05')

    def test_patch_task_of_validated_sheet_updates_summary(self):
        self.client.force_authenticate(user=self.garagiste)
        wear_task = self._make_wear_task()
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=wear_task, wear_level=8)
        self.assertEqual(self._maintenance_row(wear_task)['last_realization']['wear_level'], 8)
        response = self.client.patch(f'{self._tasks_url(sheet)}{task.id}/', {'wear_level': 6}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._maintenance_row(wear_task)['last_realization']['wear_level'], 6)

    def test_wear_task_posed_at_alert_threshold_is_to_plan_in_summary(self):
        self.client.force_authenticate(user=self.garagiste)
        wear_task = self._make_wear_task()
        sheet = self._make_validated_sheet()
        InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=wear_task, wear_level=4)
        row = self._maintenance_row(wear_task)
        self.assertEqual((row['status'], row['source']), ('to_plan', 'usure'))

    def test_mileage_correction_of_intervention_entry_updates_sheet_and_due_km(self):
        self.garagiste.user_permissions.add(Permission.objects.get(codename='correct_mileage'))
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_mileage=10500,
            start_date=datetime.date(2026, 1, 1),
        )
        InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=self.catalog_task_periodic)
        self.assertEqual(self.client.post(self._validate_url(sheet)).status_code, 200)
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['km']['due'], 20500)

        entry = MileageEntry.objects.get(source='intervention', source_id=sheet.id)
        url = f'/api/garage/mileage/{self.vehicle_a.id}/correct/'
        response = self.client.post(url, {'entry': entry.id, 'value': 10200, 'reason': 'Erreur de saisie'})
        self.assertEqual(response.status_code, 201)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10200)
        self.assertEqual(self._maintenance_row(self.catalog_task_periodic)['km']['due'], 20200)

        # corriger la correction suit la chaîne jusqu'à l'entrée de la fiche
        response = self.client.post(url, {'entry': response.data['id'], 'value': 10300, 'reason': 'Encore faux'})
        self.assertEqual(response.status_code, 201)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10300)

    def test_mileage_correction_of_manual_entry_does_not_touch_sheets(self):
        self.garagiste.user_permissions.add(Permission.objects.get(codename='correct_mileage'))
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        entry = MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10800, date=datetime.date(2026, 2, 1), source='manual',
            source_id=sheet.id, author=self.garagiste,
        )
        response = self.client.post(
            f'/api/garage/mileage/{self.vehicle_a.id}/correct/',
            {'entry': entry.id, 'value': 10700, 'reason': 'Erreur de saisie'},
        )
        self.assertEqual(response.status_code, 201)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10500)

    def test_validated_sheet_requires_start_mileage_and_start_date_in_database(self):
        for missing in ('start_mileage', 'start_date'):
            with self.subTest(missing=missing), self.assertRaises(IntegrityError), transaction.atomic():
                self._make_validated_sheet(**{missing: None})
        # une fiche ouverte peut ne pas les avoir
        InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)

    # ── Story 2.9 : synchronisation kilométrage — saisies hors ordre chronologique ──

    def test_validate_sheet_with_more_recent_entry_returns_warning_and_does_not_update_vehicle(self):
        self.client.force_authenticate(user=self.garagiste)
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10800, date=datetime.date(2026, 1, 10),
            source='manual', author=self.garagiste,
        )
        self.vehicle_a.kilometer = 10800
        self.vehicle_a.save(update_fields=['kilometer'])

        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste,
            start_mileage=10800, start_date=datetime.date(2026, 1, 5),
        )
        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['warnings']), 1)
        warning = response.data['warnings'][0]
        self.assertEqual(warning['code'], 'mileage_not_applied')
        self.assertEqual(warning['more_recent_entry']['value'], 10800)
        self.assertEqual(warning['more_recent_entry']['date'], '2026-01-10')

        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10800)

    def test_validate_past_sheet_without_end_date_does_not_roll_back_vehicle_kilometer(self):
        self.client.force_authenticate(user=self.garagiste)
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10000, date=datetime.date(2025, 6, 1),
            source='manual', author=self.garagiste,
        )
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=12000, date=datetime.date(2025, 9, 1),
            source='manual', author=self.garagiste,
        )
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 12000)

        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste,
            start_mileage=11000, start_date=datetime.date(2025, 7, 1),
        )
        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 200)

        entry = MileageEntry.objects.get(vehicle=self.vehicle_a, source='intervention')
        self.assertEqual(entry.date, datetime.date(2025, 7, 1))
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 12000)
        self.assertEqual(len(response.data['warnings']), 1)
        self.assertEqual(response.data['warnings'][0]['more_recent_entry']['value'], 12000)

    def test_validate_sheet_without_mileage_history_returns_no_warning(self):
        self.client.force_authenticate(user=self.garagiste)
        self.assertFalse(MileageEntry.objects.filter(vehicle=self.vehicle_a).exists())
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste,
            start_mileage=10500, start_date=datetime.date(2025, 7, 1),
        )
        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['warnings'], [])
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10500)

    def test_validate_sheet_chronological_order_returns_no_warning(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_mileage=10500,
            start_date=timezone.localdate(),
        )
        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['warnings'], [])
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.kilometer, 10500)

    def test_patch_start_mileage_consistent_with_historical_entry_in_the_past_succeeds(self):
        self.client.force_authenticate(user=self.garagiste)
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=9500, date=datetime.date(2025, 6, 1),
            source='manual', author=self.garagiste,
        )
        # Entrée plus récente : porte vehicle.kilometer au-dessus de la référence historique
        # (2025-06-15), pour que le test discrimine bien l'ancien comportement (comparaison
        # au kilométrage courant) du nouveau (comparaison à la référence historique).
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10800, date=datetime.date(2026, 1, 15),
            source='manual', author=self.garagiste,
        )
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(
            self._detail_url(sheet),
            {'start_mileage': 9700, 'start_date': '2025-06-15'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 9700)

    def test_patch_start_mileage_below_historical_entry_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=9500, date=datetime.date(2025, 6, 1),
            source='manual', author=self.garagiste,
        )
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10800, date=datetime.date(2026, 1, 15),
            source='manual', author=self.garagiste,
        )
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(
            self._detail_url(sheet),
            {'start_mileage': 9400, 'start_date': '2025-06-15'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

    def test_patch_start_mileage_without_prior_history_falls_back_to_vehicle_kilometer(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.patch(
            self._detail_url(sheet),
            {'start_mileage': 9000, 'start_date': '2025-06-15'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

        response = self.client.patch(
            self._detail_url(sheet),
            {'start_mileage': 10500, 'start_date': '2025-06-15'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_patch_start_mileage_today_behaves_as_before(self):
        self.client.force_authenticate(user=self.garagiste)
        # Entrée historique alignée sur vehicle.kilometer : avec start_date = aujourd'hui, la
        # référence historique est la dernière entrée, donc identique au kilométrage courant.
        MileageEntry.objects.create(
            vehicle=self.vehicle_a, value=10000, date=datetime.date(2025, 1, 1),
            source='manual', author=self.garagiste,
        )
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        today = timezone.now().date().isoformat()
        response = self.client.patch(
            self._detail_url(sheet), {'start_mileage': 9000, 'start_date': today}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

        response = self.client.patch(
            self._detail_url(sheet), {'start_mileage': 10500, 'start_date': today}, format='json',
        )
        self.assertEqual(response.status_code, 200)

    # ── Story 2.10 : start_date obligatoire, usure de la pièce posée, synthèse d'entretien ──

    def _make_wear_task(self):
        return TaskCatalog.objects.create(
            name='Pneus', vehicle_types=['voiture'], km_periodicity=30000, is_wear_task=True,
        )

    def test_validate_without_start_date_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_mileage=10500,
        )
        response = self.client.post(self._validate_url(sheet))
        self.assertEqual(response.status_code, 400)
        sheet.refresh_from_db()
        self.assertEqual(sheet.status, 'open')
        self.assertFalse(MileageEntry.objects.filter(source='intervention').exists())

    def test_patch_start_date_null_on_validated_sheet_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        response = self.client.patch(self._detail_url(sheet), {'start_date': None}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_date', response.data)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_date, datetime.date(2026, 1, 1))

    def test_patch_start_date_null_on_open_sheet_is_allowed(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_date=datetime.date(2026, 1, 1),
        )
        response = self.client.patch(self._detail_url(sheet), {'start_date': None}, format='json')
        self.assertEqual(response.status_code, 200)
        sheet.refresh_from_db()
        self.assertIsNone(sheet.start_date)

    def test_post_done_wear_task_below_alert_threshold_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        wear_task = self._make_wear_task()
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': wear_task.id, 'wear_level': 3,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('wear_level', response.data)
        self.assertIn('4/10', str(response.data['wear_level']))
        self.assertFalse(InterventionTask.objects.exists())

        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': wear_task.id, 'wear_level': 4,
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_post_done_wear_task_honours_configured_threshold(self):
        self.client.force_authenticate(user=self.garagiste)
        config = get_config()
        config.wear_alert_threshold = 6
        config.save()
        wear_task = self._make_wear_task()
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': wear_task.id, 'wear_level': 5,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_patch_done_wear_task_below_alert_threshold_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        wear_task = self._make_wear_task()
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=wear_task, wear_level=8)
        response = self.client.patch(self._task_detail_url(sheet, task), {'wear_level': 2}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('wear_level', response.data)
        task.refresh_from_db()
        self.assertEqual(task.wear_level, 8)
        self.assertFalse(AuditLog.objects.exists())

        response = self.client.patch(self._task_detail_url(sheet, task), {'wear_level': 4}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_planned_wear_task_below_threshold_is_accepted(self):
        self.client.force_authenticate(user=self.garagiste)
        wear_task = self._make_wear_task()
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'planned', 'catalog_task': wear_task.id, 'wear_level': 2,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        task = InterventionTask.objects.get(pk=response.data['id'])
        response = self.client.patch(self._task_detail_url(sheet, task), {'wear_level': 1}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_wear_rule_not_applied_to_non_wear_task(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': self.catalog_task_periodic.id, 'wear_level': 1,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'name': 'Libre', 'wear_level': 1,
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_maintenance_multi_action_garagiste_can_read_vehicle_of_other_action(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(f'/api/garage/maintenance/{self.vehicle_b.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['vehicle_id'], self.vehicle_b.id)

    def test_maintenance_without_view_vehicle_permission_returns_403(self):
        user = User.objects.create_user(
            username='nogarage@test.com', email='nogarage@test.com', password='pass',
            phone='0600000015', first_name='Sans', last_name='Droit',
        )
        user.actions.set([self.action_a])
        user.current_action = self.action_a
        user.save()
        self.client.force_authenticate(user=user)
        response = self.client.get(f'/api/garage/maintenance/{self.vehicle_a.id}/')
        self.assertEqual(response.status_code, 403)

    def test_maintenance_vehicle_outside_user_actions_returns_403(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(f'/api/garage/maintenance/{self.vehicle_c.id}/')
        self.assertEqual(response.status_code, 403)

    def test_maintenance_unknown_vehicle_returns_404(self):
        self.client.force_authenticate(user=self.garagiste)
        self.assertEqual(self.client.get('/api/garage/maintenance/999999/').status_code, 404)
        self.assertEqual(self.client.get('/api/garage/maintenance/abc/').status_code, 404)

    def test_maintenance_unauthenticated_returns_401(self):
        response = self.client.get(f'/api/garage/maintenance/{self.vehicle_a.id}/')
        self.assertEqual(response.status_code, 401)

    def test_maintenance_response_shape_and_open_sheet(self):
        self.client.force_authenticate(user=self.garagiste)
        validated = self._make_validated_sheet(start_mileage=9000)
        InterventionTask.objects.create(sheet=validated, type='done', catalog_task=self.catalog_task_periodic)
        InterventionTask.objects.create(sheet=validated, type='planned', name='Bruit train avant')
        open_sheet = InterventionSheet.objects.create(
            vehicle=self.vehicle_a, created_by=self.garagiste, start_date=datetime.date(2026, 2, 1),
        )
        InterventionTask.objects.create(sheet=open_sheet, type='done', catalog_task=self.catalog_task_no_periodicity)
        InterventionTask.objects.create(sheet=open_sheet, type='planned', name='Essuie-glaces')

        data = self._maintenance()
        self.assertEqual(
            set(data.keys()),
            {'vehicle_id', 'current_km', 'today', 'tasks', 'signalements', 'other_work', 'sheets', 'counts'},
        )
        self.assertEqual(data['current_km'], 10000)
        self.assertEqual(data['today'], timezone.localdate().isoformat())

        row = next(r for r in data['tasks'] if r['catalog_task_id'] == self.catalog_task_periodic.id)
        self.assertEqual(row['status'], 'up_to_date')
        self.assertEqual(row['source'], None)
        self.assertEqual(row['km'], {'lifespan': 10000, 'due': 19000, 'remaining': 9000, 'progress': 0.1, 'soon': None})
        self.assertIsNone(row['months'])
        self.assertEqual(row['main_axis'], 'km')
        self.assertEqual(row['last_realization']['date'], '2026-01-01')

        self.assertEqual([sig['name'] for sig in data['signalements']], ['Bruit train avant'])
        self.assertEqual(data['signalements'][0]['source'], 'signalement')
        self.assertEqual(data['signalements'][0]['sheet_date'], '2026-01-01')

        # Fiche ouverte : présente dans sheets, mais ses tâches ne sont ni réalisations ni signalements
        self.assertEqual([sheet['id'] for sheet in data['sheets']], [open_sheet.id, validated.id])
        self.assertEqual(data['sheets'][0]['status'], 'open')
        self.assertEqual(data['sheets'][0]['done_count'], 1)
        self.assertEqual(data['sheets'][0]['planned_count'], 1)
        self.assertEqual(data['sheets'][1]['created_by_display'], 'Jean Garagiste')
        self.assertEqual(data['other_work'], [])

        # Les autres tâches cycliques du catalogue préconfiguré (migration 0003) ne sont pas enregistrées
        self.assertTrue(all(r['status'] == 'not_recorded' for r in data['tasks'] if r is not row))
        self.assertEqual(data['counts'], {
            'overdue': 0, 'to_plan': 1, 'up_to_date': 1, 'not_recorded': len(data['tasks']) - 1,
            'other_work': 0, 'sheets': 2,
        })

    def test_maintenance_exposes_icon_periodicity_and_signalement_photos(self):
        self.client.force_authenticate(user=self.garagiste)
        self.catalog_task_periodic.icon = 'oil'
        self.catalog_task_periodic.month_periodicity = 12
        self.catalog_task_periodic.save()
        self.catalog_task_no_periodicity.icon = 'body'
        self.catalog_task_no_periodicity.save()
        sheet = self._make_validated_sheet(start_mileage=9000)
        InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=self.catalog_task_no_periodicity)
        InterventionTask.objects.create(sheet=sheet, type='done', name='Rétroviseur')
        signalement = InterventionTask.objects.create(sheet=sheet, type='planned', name='Bruit train avant')
        GaragePhoto.objects.create(
            image=SimpleUploadedFile('p.png', b'\x89PNG\r\n', content_type='image/png'),
            content_type=ContentType.objects.get_for_model(InterventionTask), object_id=signalement.pk,
        )

        data = self._maintenance()

        # Ligne jamais enregistrée : pas d'axe, mais l'icône et la périodicité sont connues
        row = next(r for r in data['tasks'] if r['catalog_task_id'] == self.catalog_task_periodic.id)
        self.assertEqual(row['status'], 'not_recorded')
        self.assertIsNone(row['km'])
        self.assertEqual(row['icon'], 'oil')
        self.assertEqual(row['periodicity'], {'km': 10000, 'months': 12})

        other = {item['name']: item for item in data['other_work']}
        self.assertEqual(other['Nettoyage']['icon'], 'body')
        self.assertIsNone(other['Rétroviseur']['icon'])

        photos = data['signalements'][0]['photos']
        self.assertEqual(len(photos), 1)
        self.assertTrue(photos[0].startswith('http://testserver/'))

    def test_initial_catalog_tasks_get_their_icon(self):
        self.assertEqual(TaskCatalog.objects.get(name='Distribution').icon, 'belt')
        self.assertEqual(TaskCatalog.objects.get(name='Pneus').icon, 'tire')
        self.assertEqual(TaskCatalog.objects.get(name='Biellettes').icon, 'steering')

    def test_load_maintenance_data_query_count_is_constant(self):
        for vehicle in (self.vehicle_a, self.vehicle_b, self.vehicle_c):
            sheet = self._make_validated_sheet(vehicle=vehicle, start_mileage=vehicle.kilometer)
            InterventionTask.objects.create(sheet=sheet, type='done', catalog_task=self.catalog_task_periodic)
            InterventionTask.objects.create(sheet=sheet, type='planned', name='Libre')
            InterventionSheet.objects.create(vehicle=vehicle, created_by=self.garagiste)

        with CaptureQueriesContext(connection) as one_vehicle:
            data_one = load_maintenance_data([self.vehicle_a])
        with CaptureQueriesContext(connection) as three_vehicles:
            data_three = load_maintenance_data([self.vehicle_a, self.vehicle_b, self.vehicle_c])

        self.assertEqual(len(one_vehicle), len(three_vehicles))
        self.assertEqual(len(three_vehicles), 4)  # catalogue, tâches, photos des signalements, fiches
        self.assertEqual(len(data_one['occurrences_by_vehicle'][self.vehicle_a.id]), 2)
        for vehicle in (self.vehicle_a, self.vehicle_b, self.vehicle_c):
            self.assertEqual(len(data_three['occurrences_by_vehicle'][vehicle.id]), 2)
            self.assertEqual(len(data_three['sheets_by_vehicle'][vehicle.id]), 2)

    def test_task_catalog_admin_exposes_soon_thresholds(self):
        admin_user = User.objects.create_superuser(
            username='admin210@test.com', email='admin210@test.com', password='pass', phone='0600000016',
        )
        request = RequestFactory().get('/admin/garage/taskcatalog/add/')
        request.user = admin_user
        model_admin = TaskCatalogAdmin(TaskCatalog, AdminSite())
        form = model_admin.get_form(request)
        self.assertIn('soon_km', form.base_fields)
        self.assertIn('soon_months', form.base_fields)
        self.assertIn('soon_km', model_admin.list_display)
        self.assertIn('soon_months', model_admin.list_display)

    def test_task_catalog_soon_threshold_must_be_below_periodicity(self):
        task = TaskCatalog(name='Vidange', km_periodicity=15000, month_periodicity=12, soon_km=15000, soon_months=12)
        with self.assertRaises(ValidationError) as ctx:
            task.clean()
        self.assertEqual(set(ctx.exception.message_dict), {'soon_km', 'soon_months'})
        TaskCatalog(name='Vidange', km_periodicity=15000, month_periodicity=12, soon_km=14999, soon_months=11).clean()
        TaskCatalog(name='Libre', soon_km=1000, soon_months=2).clean()  # sans périodicité : ignoré

    def test_task_catalog_admin_form_rejects_soon_threshold_above_periodicity(self):
        form = TaskCatalogForm(data={
            'name': 'Vidange', 'vehicle_types': ['voiture'], 'km_periodicity': 15000, 'soon_km': 20000,
        })
        self.assertFalse(form.is_valid())
        self.assertIn('soon_km', form.errors)


# ── Story 2.10 : calcul pur de l'entretien par tâche (aucune base de données) ──

TODAY = datetime.date(2026, 10, 1)
VEHICLE = SimpleNamespace(id=1, type='voiture', kilometer=50000)
CONFIG = SimpleNamespace(wear_alert_threshold=4, wear_critical_threshold=3)


def _catalog(id=1, name='Vidange', km=None, months=None, soon_km=None, soon_months=None, types=('voiture',),
             is_wear_task=False):
    return CatalogTask(
        id=id, name=name, vehicle_types=list(types), km_periodicity=km, month_periodicity=months,
        soon_km=soon_km, soon_months=soon_months, is_critical=False, is_wear_task=is_wear_task,
    )


def _occurrence(task_id, sheet_id, type='done', catalog_task_id=1, date=datetime.date(2026, 1, 1), km=40000,
                name='Vidange', description='', wear_level=None):
    return TaskOccurrence(
        task_id=task_id, sheet_id=sheet_id, vehicle_id=VEHICLE.id, type=type, catalog_task_id=catalog_task_id,
        name=name, description=description, wear_level=wear_level, sheet_start_date=date, sheet_start_mileage=km,
    )


def _data(catalog, occurrences):
    return {'catalog': catalog, 'occurrences_by_vehicle': {VEHICLE.id: occurrences}, 'sheets_by_vehicle': {VEHICLE.id: []}}


class AddMonthsTestCase(SimpleTestCase):
    def test_clamps_to_last_day_of_month(self):
        self.assertEqual(add_months(datetime.date(2026, 1, 31), 1), datetime.date(2026, 2, 28))
        self.assertEqual(add_months(datetime.date(2024, 1, 31), 1), datetime.date(2024, 2, 29))
        self.assertEqual(add_months(datetime.date(2026, 3, 31), 1), datetime.date(2026, 4, 30))

    def test_crosses_years_both_ways(self):
        self.assertEqual(add_months(datetime.date(2026, 11, 15), 14), datetime.date(2028, 1, 15))
        self.assertEqual(add_months(datetime.date(2026, 1, 15), -2), datetime.date(2025, 11, 15))
        self.assertEqual(add_months(datetime.date(2026, 3, 31), -1), datetime.date(2026, 2, 28))


class ComputeTaskStatusesTestCase(SimpleTestCase):
    def _row(self, catalog, occurrences):
        rows = compute_task_statuses(_data(catalog, occurrences), VEHICLE, TODAY, CONFIG)
        self.assertEqual(len(rows), 1)
        return rows[0]

    def test_km_overdue_at_exact_due_and_up_to_date_one_km_before(self):
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, km=40000)])
        self.assertEqual(row['status'], 'overdue')
        self.assertEqual(row['km']['remaining'], 0)
        self.assertIsNone(row['source'])
        self.assertIsNone(row['months'])
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, km=40001)])
        self.assertEqual(row['status'], 'up_to_date')

    def test_months_overdue_at_exact_due_date_and_up_to_date_one_day_before(self):
        row = self._row([_catalog(months=12)], [_occurrence(1, 1, date=datetime.date(2025, 10, 1))])
        self.assertEqual(row['status'], 'overdue')
        self.assertEqual(row['months']['remaining_days'], 0)
        self.assertIsNone(row['km'])
        row = self._row([_catalog(months=12)], [_occurrence(1, 1, date=datetime.date(2025, 10, 2))])
        self.assertEqual(row['status'], 'up_to_date')
        self.assertEqual(row['months']['due'], datetime.date(2026, 10, 2))

    def test_to_plan_on_soon_km_inclusive(self):
        row = self._row([_catalog(km=10000, soon_km=1000)], [_occurrence(1, 1, km=41000)])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'echeance'))
        row = self._row([_catalog(km=10000, soon_km=1000)], [_occurrence(1, 1, km=41001)])
        self.assertEqual(row['status'], 'up_to_date')

    def test_to_plan_on_soon_months(self):
        # échéance 2026-12-01, seuil 2 mois → à prévoir dès le 2026-10-01
        row = self._row([_catalog(months=12, soon_months=2)], [_occurrence(1, 1, date=datetime.date(2025, 12, 1))])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'echeance'))
        row = self._row([_catalog(months=12, soon_months=2)], [_occurrence(1, 1, date=datetime.date(2025, 12, 2))])
        self.assertEqual(row['status'], 'up_to_date')

    def test_null_or_zero_thresholds_never_give_to_plan(self):
        for soon in (None, 0):
            row = self._row([_catalog(km=10000, soon_km=soon)], [_occurrence(1, 1, km=40001)])
            self.assertEqual(row['status'], 'up_to_date')
            self.assertIsNone(row['km']['soon'])

    def test_null_or_zero_soon_months_never_gives_to_plan(self):
        for soon in (None, 0):
            row = self._row([_catalog(months=12, soon_months=soon)], [_occurrence(1, 1, date=datetime.date(2025, 10, 2))])
            self.assertEqual(row['status'], 'up_to_date')
            self.assertIsNone(row['months']['soon'])

    def test_wear_task_posed_at_or_below_alert_threshold_is_to_plan_by_wear(self):
        catalog = [_catalog(km=10000, is_wear_task=True)]
        for wear, expected in ((4, ('to_plan', 'usure')), (5, ('up_to_date', None)), (None, ('up_to_date', None))):
            with self.subTest(wear=wear):
                row = self._row(catalog, [_occurrence(1, 1, km=45000, wear_level=wear)])
                self.assertEqual((row['status'], row['source']), expected)

    def test_wear_does_not_override_overdue_or_due_date_source(self):
        row = self._row([_catalog(km=10000, is_wear_task=True)], [_occurrence(1, 1, km=30000, wear_level=4)])
        self.assertEqual((row['status'], row['source']), ('overdue', None))
        row = self._row([_catalog(km=10000, soon_km=1000, is_wear_task=True)], [_occurrence(1, 1, km=41000, wear_level=4)])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'echeance'))

    def test_wear_level_ignored_on_non_wear_task(self):
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, km=45000, wear_level=2)])
        self.assertEqual(row['status'], 'up_to_date')

    def test_not_recorded(self):
        row = self._row([_catalog(km=10000, months=12)], [])
        self.assertEqual(row['status'], 'not_recorded')
        self.assertIsNone(row['source'])
        self.assertIsNone(row['last_realization'])
        self.assertIsNone(row['km'])
        self.assertIsNone(row['months'])
        self.assertIsNone(row['main_axis'])

    def test_not_recorded_with_signalement_becomes_to_plan(self):
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, type='planned')])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'signalement'))
        self.assertEqual([sig['task_id'] for sig in row['signalements']], [1])

    def test_up_to_date_with_signalement_becomes_to_plan(self):
        occurrences = [
            _occurrence(1, 1, km=45000),
            _occurrence(2, 2, type='planned', date=datetime.date(2026, 2, 1)),
        ]
        row = self._row([_catalog(km=10000)], occurrences)
        self.assertEqual((row['status'], row['source']), ('to_plan', 'signalement'))

    def test_to_plan_by_due_date_with_signalement_keeps_echeance_source(self):
        occurrences = [
            _occurrence(1, 1, km=41000),
            _occurrence(2, 2, type='planned', date=datetime.date(2026, 2, 1)),
        ]
        row = self._row([_catalog(km=10000, soon_km=1000)], occurrences)
        self.assertEqual((row['status'], row['source']), ('to_plan', 'echeance'))
        self.assertEqual(len(row['signalements']), 1)

    def test_overdue_with_signalement_stays_overdue(self):
        occurrences = [
            _occurrence(1, 1, km=30000),
            _occurrence(2, 2, type='planned', date=datetime.date(2026, 2, 1)),
        ]
        row = self._row([_catalog(km=10000)], occurrences)
        self.assertEqual(row['status'], 'overdue')
        self.assertIsNone(row['source'])
        self.assertEqual([sig['task_id'] for sig in row['signalements']], [2])

    def test_main_axis_is_the_most_advanced_axis(self):
        # km : 5000 / 10000 = 0.5 ; mois : 304 / 365 jours = 0.83
        row = self._row([_catalog(km=10000, months=12)], [_occurrence(1, 1, km=45000, date=datetime.date(2025, 12, 1))])
        self.assertEqual(row['main_axis'], 'months')
        self.assertEqual(row['km']['progress'], 0.5)
        self.assertEqual(row['months']['progress'], 0.83)
        # km : 9000 / 10000 = 0.9
        row = self._row([_catalog(km=10000, months=12)], [_occurrence(1, 1, km=41000, date=datetime.date(2025, 12, 1))])
        self.assertEqual(row['main_axis'], 'km')

    def test_progress_may_exceed_one(self):
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, km=35000)])
        self.assertEqual(row['km']['progress'], 1.5)

    def test_last_realization_is_latest_by_start_date_then_sheet_id(self):
        occurrences = [
            _occurrence(1, 5, km=42000, date=datetime.date(2026, 3, 1)),
            _occurrence(2, 3, km=43000, date=datetime.date(2026, 3, 1)),
            _occurrence(3, 9, km=41000, date=datetime.date(2026, 2, 1)),
        ]
        row = self._row([_catalog(km=10000)], occurrences)
        self.assertEqual(row['last_realization'], {
            'sheet_id': 5, 'task_id': 1, 'date': datetime.date(2026, 3, 1), 'km': 42000, 'wear_level': None,
        })

    def test_non_applicable_and_non_cyclic_tasks_have_no_row(self):
        catalog = [
            _catalog(id=1, km=10000, types=('scouter',)),
            _catalog(id=2, name='Nettoyage'),
            _catalog(id=3, name='Zéro', km=0, months=0),
        ]
        self.assertEqual(compute_task_statuses(_data(catalog, []), VEHICLE, TODAY, CONFIG), [])

    def test_rows_sorted_by_name(self):
        catalog = [_catalog(id=1, name='Vidange', km=10000), _catalog(id=2, name='Distribution', km=100000)]
        rows = compute_task_statuses(_data(catalog, []), VEHICLE, TODAY, CONFIG)
        self.assertEqual([row['name'] for row in rows], ['Distribution', 'Vidange'])


class ComputeOpenSignalementsTestCase(SimpleTestCase):
    CATALOG = [_catalog(id=1, km=10000), _catalog(id=2, name='Nettoyage')]

    def _open_ids(self, occurrences):
        result = compute_open_signalements(_data(self.CATALOG, occurrences), VEHICLE)
        return (
            sorted(sig['task_id'] for sigs in result['by_task'].values() for sig in sigs),
            sorted(sig['task_id'] for sig in result['standalone']),
        )

    def test_closed_by_done_in_same_sheet(self):
        occurrences = [_occurrence(1, 1, type='planned'), _occurrence(2, 1)]
        self.assertEqual(self._open_ids(occurrences), ([], []))

    def test_closed_by_done_in_later_sheet(self):
        occurrences = [
            _occurrence(1, 1, type='planned', date=datetime.date(2026, 1, 1)),
            _occurrence(2, 2, date=datetime.date(2026, 2, 1)),
        ]
        self.assertEqual(self._open_ids(occurrences), ([], []))

    def test_stays_open_when_done_in_earlier_sheet(self):
        occurrences = [
            _occurrence(1, 2, type='planned', date=datetime.date(2026, 2, 1)),
            _occurrence(2, 1, date=datetime.date(2026, 1, 1)),
        ]
        self.assertEqual(self._open_ids(occurrences), ([1], []))

    def test_same_start_date_is_decided_by_sheet_id(self):
        same_day = datetime.date(2026, 2, 1)
        closed = [_occurrence(1, 5, type='planned', date=same_day), _occurrence(2, 6, date=same_day)]
        self.assertEqual(self._open_ids(closed), ([], []))
        still_open = [_occurrence(1, 6, type='planned', date=same_day), _occurrence(2, 5, date=same_day)]
        self.assertEqual(self._open_ids(still_open), ([1], []))

    def test_free_signalement_is_never_closed_by_a_realization(self):
        occurrences = [
            _occurrence(1, 1, type='planned', catalog_task_id=None, name='Bruit', date=datetime.date(2026, 1, 1)),
            _occurrence(2, 1, catalog_task_id=None, name='Bruit', date=datetime.date(2026, 1, 1)),
            _occurrence(3, 2, catalog_task_id=None, name='Bruit', date=datetime.date(2026, 2, 1)),
        ]
        self.assertEqual(self._open_ids(occurrences), ([], [1]))

    def test_signalement_on_non_cyclic_catalog_task_is_standalone_and_closable(self):
        open_signalement = [_occurrence(1, 1, type='planned', catalog_task_id=2, name='Nettoyage')]
        result = compute_open_signalements(_data(self.CATALOG, open_signalement), VEHICLE)
        self.assertEqual(result['by_task'], {})
        self.assertEqual(result['standalone'], [{
            'task_id': 1, 'sheet_id': 1, 'sheet_date': datetime.date(2026, 1, 1), 'catalog_task_id': 2,
            'name': 'Nettoyage', 'description': '', 'source': 'signalement', 'photos': [],
        }])
        closed = open_signalement + [_occurrence(2, 2, catalog_task_id=2, name='Nettoyage', date=datetime.date(2026, 2, 1))]
        self.assertEqual(self._open_ids(closed), ([], []))


class ComputeOtherWorkTestCase(SimpleTestCase):
    def test_latest_occurrence_and_free_tasks_grouped_by_normalized_name(self):
        catalog = [_catalog(id=1, km=10000), _catalog(id=2, name='Nettoyage'), _catalog(id=3, name='Batterie', km=1000, types=('scouter',))]
        occurrences = [
            _occurrence(1, 1, catalog_task_id=1),  # cyclique : pas dans les autres travaux
            _occurrence(2, 1, catalog_task_id=None, name='Pneus', date=datetime.date(2026, 1, 1)),
            _occurrence(3, 2, catalog_task_id=None, name=' pneus  ', km=45000, date=datetime.date(2026, 3, 1)),
            _occurrence(4, 1, catalog_task_id=2, name='Nettoyage', date=datetime.date(2026, 1, 1)),
            _occurrence(5, 3, catalog_task_id=2, name='Nettoyage', date=datetime.date(2026, 2, 1)),
            _occurrence(6, 1, catalog_task_id=3, name='Batterie', date=datetime.date(2026, 1, 1)),  # non applicable
            _occurrence(7, 3, type='planned', catalog_task_id=None, name='Phare'),  # signalement, pas un travail
        ]
        work = compute_other_work(_data(catalog, occurrences), VEHICLE)
        self.assertEqual(
            [(item['key'], item['name'], item['task_id']) for item in work],
            [('free:pneus', ' pneus  ', 3), ('cat:2', 'Nettoyage', 5), ('cat:3', 'Batterie', 6)],
        )
        self.assertEqual(work[0]['km'], 45000)
        self.assertEqual(work[0]['date'], datetime.date(2026, 3, 1))
