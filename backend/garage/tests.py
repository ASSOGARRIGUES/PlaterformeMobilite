import datetime
from django.utils import timezone

from types import SimpleNamespace

from django.db import IntegrityError, connection, transaction
from django.test import TestCase, SimpleTestCase, RequestFactory
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.apps import apps
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from core.models import Action
from api.models import Parking, Vehicle, Beneficiary, Contract
from .models import (
    MileageEntry, TaskCatalog, MaintenanceConfig, InterventionSheet, InterventionTask, InterventionTaskPart,
    GaragePhoto, AuditLog, InspectionSheet, InspectionTask, InspectionWearMeasurement, InspectionDamage,
)
from .alerts import (
    get_config, add_months, load_maintenance_data, compute_task_statuses, compute_open_signalements,
    compute_other_work, CatalogTask, TaskOccurrence, WearMeasurement, is_signalement_open,
)
from .admin import MaintenanceConfigAdmin, TaskCatalogAdmin, TaskCatalogForm
from .serializers import get_measurable_tasks

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

    def test_list_returns_icon(self):
        TaskCatalog.objects.create(name='Defaut', vehicle_types=['voiture'])
        TaskCatalog.objects.create(name='Vidange', vehicle_types=['voiture'], icon='oil')
        response = self.client.get('/api/garage/task-catalog/')
        icons = {t['name']: t['icon'] for t in response.data['results']}
        self.assertEqual(icons, {'Defaut': 'tool', 'Vidange': 'oil'})

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


class WearThresholdsMigrationTestCase(TestCase):
    def _run(self):
        import importlib
        importlib.import_module('garage.migrations.0021_wear_thresholds_2_5').update_default_thresholds(apps, None)

    def _set(self, alert, critical):
        MaintenanceConfig.objects.all().delete()
        config = MaintenanceConfig(wear_alert_threshold=alert, wear_critical_threshold=critical)
        config.save()
        MaintenanceConfig.objects.filter(pk=1).update(wear_alert_threshold=alert, wear_critical_threshold=critical)

    def test_old_defaults_become_2_5(self):
        self._set(alert=4, critical=3)
        self._run()
        config = MaintenanceConfig.objects.get(pk=1)
        self.assertEqual((config.wear_alert_threshold, config.wear_critical_threshold), (5, 2))

    def test_customised_thresholds_are_left_untouched(self):
        self._set(alert=6, critical=3)
        self._run()
        config = MaintenanceConfig.objects.get(pk=1)
        self.assertEqual((config.wear_alert_threshold, config.wear_critical_threshold), (6, 3))


class MaintenanceConfigTestCase(TestCase):
    def setUp(self):
        MaintenanceConfig.objects.all().delete()

    def test_default_values(self):
        config = MaintenanceConfig.objects.create()
        self.assertEqual(config.ct_alert_days, 7)
        self.assertEqual(config.wear_alert_threshold, 5)
        self.assertEqual(config.wear_critical_threshold, 2)
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

    def test_clean_rejects_alert_threshold_of_ten(self):
        from django.core.exceptions import ValidationError
        config = MaintenanceConfig(wear_alert_threshold=10, wear_critical_threshold=2)
        with self.assertRaises(ValidationError) as ctx:
            config.clean()
        self.assertIn('wear_alert_threshold', ctx.exception.message_dict)

    def test_clean_accepts_alert_threshold_of_nine(self):
        MaintenanceConfig(wear_alert_threshold=9, wear_critical_threshold=2).clean()

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

    def _superuser_with_view_vehicle(self):
        # Superuser sans Action assignée : get_actions() renvoie toutes les Actions.
        return User.objects.create_superuser(
            username='root@test.com', email='root@test.com', password='pass',
            phone='0600000009', first_name='Root', last_name='Admin',
        )

    def test_superuser_sees_mileage_history_of_any_action(self):
        self.client.force_authenticate(user=self._superuser_with_view_vehicle())
        response = self.client.get(self._url(self.vehicle_c))
        self.assertEqual(response.status_code, 200)

    def test_superuser_sees_intervention_sheets_of_any_action(self):
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_c, created_by=self.garagiste)
        self.client.force_authenticate(user=self._superuser_with_view_vehicle())
        response = self.client.get('/api/garage/intervention/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(sheet.id, [s['id'] for s in response.data['results']])

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
            'type': 'done', 'catalog_task': wear_task.id, 'wear_level': 4,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('wear_level', response.data)
        self.assertIn('5/10', str(response.data['wear_level']))
        self.assertFalse(InterventionTask.objects.exists())

        response = self.client.post(self._tasks_url(sheet), {
            'type': 'done', 'catalog_task': wear_task.id, 'wear_level': 5,
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
        response = self.client.patch(self._task_detail_url(sheet, task), {'wear_level': 4}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('wear_level', response.data)
        task.refresh_from_db()
        self.assertEqual(task.wear_level, 8)
        self.assertFalse(AuditLog.objects.exists())

        response = self.client.patch(self._task_detail_url(sheet, task), {'wear_level': 5}, format='json')
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
            inspection = InspectionSheet.objects.create(
                vehicle=vehicle, created_by=self.garagiste, status='validated',
                start_mileage=vehicle.kilometer, start_date=datetime.date(2026, 1, 1),
            )
            inspection_task = InspectionTask.objects.create(sheet=inspection, name='Bruit')
            GaragePhoto.objects.create(
                image=SimpleUploadedFile('p.jpg', b'x', content_type='image/jpeg'),
                content_type=ContentType.objects.get_for_model(InspectionTask), object_id=inspection_task.pk,
            )
            InspectionWearMeasurement.objects.create(sheet=inspection, catalog_task=self.catalog_task_periodic, level=5)

        with CaptureQueriesContext(connection) as one_vehicle:
            data_one = load_maintenance_data([self.vehicle_a])
        with CaptureQueriesContext(connection) as three_vehicles:
            data_three = load_maintenance_data([self.vehicle_a, self.vehicle_b, self.vehicle_c])

        self.assertEqual(len(one_vehicle), len(three_vehicles))
        # catalogue, tâches d'intervention, tâches de contrôle, photos des signalements, mesures, fiches
        self.assertEqual(len(three_vehicles), 6)
        self.assertEqual(len(data_one['occurrences_by_vehicle'][self.vehicle_a.id]), 3)
        for vehicle in (self.vehicle_a, self.vehicle_b, self.vehicle_c):
            self.assertEqual(len(data_three['occurrences_by_vehicle'][vehicle.id]), 3)
            self.assertEqual(len(data_three['measurements_by_vehicle'][vehicle.id]), 1)
            inspection_occurrence = [o for o in data_three['occurrences_by_vehicle'][vehicle.id] if o.sheet_kind == 'inspection']
            self.assertEqual(len(inspection_occurrence[0].photo_urls), 1)
            self.assertEqual(len(data_three['sheets_by_vehicle'][vehicle.id]), 2)

    def test_load_maintenance_data_query_count_is_constant_with_dismissed_task(self):
        for vehicle in (self.vehicle_a, self.vehicle_b):
            sheet = self._make_validated_sheet(vehicle=vehicle, start_mileage=vehicle.kilometer)
            InterventionTask.objects.create(
                sheet=sheet, type='planned', name='Libre',
                dismissed_at=timezone.now(), dismissed_by=self.garagiste,
            )
        with CaptureQueriesContext(connection) as one_vehicle:
            data = load_maintenance_data([self.vehicle_a])
        with CaptureQueriesContext(connection) as two_vehicles:
            load_maintenance_data([self.vehicle_a, self.vehicle_b])
        self.assertEqual(len(one_vehicle), len(two_vehicles))
        self.assertTrue(data['occurrences_by_vehicle'][self.vehicle_a.id][0].dismissed)

    # ── Écarter un signalement (story 2.13) ──

    def _dismiss_url(self, sheet, task):
        return f'/api/garage/intervention/{sheet.id}/tasks/{task.id}/dismiss/'

    def _planned_task(self, sheet=None, **kwargs):
        sheet = sheet or self._make_validated_sheet()
        kwargs.setdefault('name', 'Bruit train avant')
        return sheet, InterventionTask.objects.create(sheet=sheet, type='planned', **kwargs)

    def test_dismiss_free_signalement_returns_204_and_audits(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._planned_task()
        self.assertEqual(len(self._maintenance()['signalements']), 1)
        before = self._maintenance()['counts']['to_plan']

        response = self.client.post(self._dismiss_url(sheet, task))
        self.assertEqual(response.status_code, 204)
        task.refresh_from_db()
        self.assertIsNotNone(task.dismissed_at)
        self.assertEqual(task.dismissed_by, self.garagiste)
        log = AuditLog.objects.get(action='task_dismissed')
        self.assertEqual((log.author, log.object_id, log.new_value), (self.garagiste, task.pk, 'Bruit train avant'))

        data = self._maintenance()
        self.assertEqual(data['signalements'], [])
        self.assertEqual(data['counts']['to_plan'], before - 1)

    def test_dismiss_signalement_attached_to_task_removes_it_from_the_row(self):
        self.client.force_authenticate(user=self.garagiste)
        done_sheet = self._make_validated_sheet(start_mileage=10000, start_date=datetime.date(2026, 1, 1))
        InterventionTask.objects.create(sheet=done_sheet, type='done', catalog_task=self.catalog_task_periodic)
        sheet, task = self._planned_task(
            sheet=self._make_validated_sheet(start_mileage=10100, start_date=datetime.date(2026, 2, 1)),
            name='', catalog_task=self.catalog_task_periodic,
        )
        row = self._maintenance_row(self.catalog_task_periodic)
        self.assertEqual((row['status'], len(row['signalements'])), ('to_plan', 1))

        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 204)
        row = self._maintenance_row(self.catalog_task_periodic)
        self.assertEqual((row['status'], row['signalements']), ('up_to_date', []))
        self.assertEqual(AuditLog.objects.get(action='task_dismissed').new_value, 'Vidange')

    def test_dismiss_twice_returns_400_with_single_audit(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._planned_task()
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 204)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)
        self.assertEqual(AuditLog.objects.filter(action='task_dismissed').count(), 1)

    def test_dismiss_done_task_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet()
        task = InterventionTask.objects.create(sheet=sheet, type='done', name='Pneus')
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)

    def test_dismiss_task_of_open_sheet_returns_400(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = InterventionSheet.objects.create(vehicle=self.vehicle_a, created_by=self.garagiste)
        _, task = self._planned_task(sheet=sheet)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)

    def test_dismiss_requires_manage_intervention(self):
        sheet, task = self._planned_task()
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 401)
        self.client.force_authenticate(user=self.referent)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 403)
        task.refresh_from_db()
        self.assertIsNone(task.dismissed_at)

    def test_dismiss_sheet_of_vehicle_outside_user_actions_returns_404(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet = self._make_validated_sheet(vehicle=self.vehicle_c, start_mileage=8000)
        _, task = self._planned_task(sheet=sheet)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 404)

    def test_dismiss_unknown_task_or_task_of_other_sheet_returns_404(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._planned_task()
        other_sheet = self._make_validated_sheet(start_date=datetime.date(2026, 3, 1))
        self.assertEqual(self.client.post(self._dismiss_url(other_sheet, task)).status_code, 404)
        self.assertEqual(self.client.post(f'/api/garage/intervention/{sheet.id}/tasks/999999/dismiss/').status_code, 404)

    def test_task_detail_delete_still_reachable_next_to_dismiss(self):
        self.client.force_authenticate(user=self.garagiste)
        sheet, task = self._planned_task()
        response = self.client.delete(f'/api/garage/intervention/{sheet.id}/tasks/{task.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(InterventionTask.objects.filter(pk=task.pk).exists())

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
                name='Vidange', description='', wear_level=None, dismissed=False, sheet_kind='intervention'):
    return TaskOccurrence(
        task_id=task_id, sheet_id=sheet_id, vehicle_id=VEHICLE.id, type=type, catalog_task_id=catalog_task_id,
        name=name, description=description, wear_level=wear_level, sheet_start_date=date, sheet_start_mileage=km,
        dismissed=dismissed, sheet_kind=sheet_kind,
    )


def _measurement(sheet_id, level, catalog_task_id=1, date=datetime.date(2026, 1, 1), km=40000):
    return WearMeasurement(
        catalog_task_id=catalog_task_id, sheet_id=sheet_id, vehicle_id=VEHICLE.id, level=level,
        sheet_start_date=date, sheet_start_mileage=km,
    )


def _data(catalog, occurrences, measurements=()):
    return {
        'catalog': catalog, 'occurrences_by_vehicle': {VEHICLE.id: occurrences},
        'sheets_by_vehicle': {VEHICLE.id: []}, 'measurements_by_vehicle': {VEHICLE.id: list(measurements)},
    }


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

    def test_dismissed_signalement_returns_to_up_to_date_or_not_recorded(self):
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, km=45000), _occurrence(2, 2, type='planned', date=datetime.date(2026, 2, 1), dismissed=True)])
        self.assertEqual(row['status'], 'up_to_date')
        self.assertEqual(row['signalements'], [])
        row = self._row([_catalog(km=10000)], [_occurrence(1, 1, type='planned', dismissed=True)])
        self.assertEqual(row['status'], 'not_recorded')

    def test_overdue_with_dismissed_signalement_stays_overdue(self):
        occurrences = [_occurrence(1, 1, km=30000), _occurrence(2, 2, type='planned', date=datetime.date(2026, 2, 1), dismissed=True)]
        row = self._row([_catalog(km=10000)], occurrences)
        self.assertEqual(row['status'], 'overdue')
        self.assertEqual(row['signalements'], [])

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


class WearMeasurementStatusTestCase(SimpleTestCase):
    """Priorité mesure / pose (E7, FR-8.6) et lignes d'usure sans périodicité (E8). CONFIG : alerte 4, critique 3."""
    WEAR = _catalog(id=1, name='Plaquettes', is_wear_task=True)
    POSE = datetime.date(2026, 3, 1)

    def _row(self, occurrences, measurements, catalog=None):
        rows = compute_task_statuses(_data(catalog or [self.WEAR], occurrences, measurements), VEHICLE, TODAY, CONFIG)
        self.assertEqual(len(rows), 1)
        return rows[0]

    def _pose(self, wear_level=10):
        return _occurrence(1, 1, date=self.POSE, wear_level=wear_level)

    def test_newer_measure_at_critical_is_overdue(self):
        row = self._row([self._pose()], [_measurement(2, 3, date=datetime.date(2026, 4, 1))])
        self.assertEqual(row['status'], 'overdue')

    def test_newer_measure_at_alert_is_to_plan_measure(self):
        row = self._row([self._pose()], [_measurement(2, 4, date=datetime.date(2026, 4, 1))])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'mesure'))

    def test_newer_measure_above_alert_replaces_worn_pose(self):
        row = self._row([self._pose(wear_level=4)], [_measurement(2, 8, date=datetime.date(2026, 4, 1))])
        self.assertEqual(row['status'], 'up_to_date')
        self.assertIsNone(row['source'])

    def test_same_date_pose_prevails_over_measure(self):
        row = self._row([self._pose(wear_level=10)], [_measurement(2, 1, date=self.POSE)])
        self.assertEqual(row['status'], 'up_to_date')
        row = self._row([self._pose(wear_level=4)], [_measurement(2, 9, date=self.POSE)])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'usure'))

    def test_measure_without_pose_drives_status(self):
        row = self._row([], [_measurement(2, 2)])
        self.assertEqual(row['status'], 'overdue')
        row = self._row([], [_measurement(2, 4)])
        self.assertEqual((row['status'], row['source']), ('to_plan', 'mesure'))
        row = self._row([], [_measurement(2, 9)])
        self.assertEqual(row['status'], 'up_to_date')

    def test_older_measure_than_pose_is_ignored(self):
        row = self._row([self._pose()], [_measurement(2, 1, date=datetime.date(2026, 2, 1))])
        self.assertEqual(row['status'], 'up_to_date')

    def test_latest_measure_wins_by_date_then_sheet_id(self):
        row = self._row([], [
            _measurement(5, 9, date=datetime.date(2026, 4, 1)), _measurement(3, 1, date=datetime.date(2026, 2, 1)),
        ])
        self.assertEqual(row['status'], 'up_to_date')
        self.assertEqual(row['last_measurement']['level'], 9)
        row = self._row([], [
            _measurement(3, 1, date=datetime.date(2026, 4, 1)), _measurement(5, 9, date=datetime.date(2026, 4, 1)),
        ])
        self.assertEqual(row['last_measurement']['sheet_id'], 5)

    def test_measure_above_alert_does_not_clear_km_overdue(self):
        wear = _catalog(id=1, name='Plaquettes', km=5000, is_wear_task=True)
        row = self._row(
            [_occurrence(1, 1, date=self.POSE, km=40000)], [_measurement(2, 9, date=datetime.date(2026, 4, 1))],
            catalog=[wear],
        )
        self.assertEqual(row['status'], 'overdue')

    def test_wear_task_without_periodicity_has_a_row(self):
        row = self._row([self._pose(wear_level=10)], [])
        self.assertEqual(row['status'], 'up_to_date')
        self.assertIsNone(row['km'])
        self.assertIsNone(row['months'])
        self.assertIsNone(row['main_axis'])
        self.assertEqual(row['periodicity'], {'km': None, 'months': None})

    def test_non_wear_task_without_periodicity_has_no_row(self):
        rows = compute_task_statuses(_data([_catalog(id=1, name='Nettoyage')], []), VEHICLE, TODAY, CONFIG)
        self.assertEqual(rows, [])

    def test_wear_task_without_pose_nor_measure_is_not_recorded(self):
        row = self._row([], [])
        self.assertEqual(row['status'], 'not_recorded')
        self.assertIsNone(row['last_measurement'])

    def test_last_measurement_payload(self):
        row = self._row([], [_measurement(7, 6, date=datetime.date(2026, 5, 2), km=41000)])
        self.assertEqual(row['last_measurement'], {
            'sheet_id': 7, 'date': datetime.date(2026, 5, 2), 'km': 41000, 'level': 6,
        })

    def test_measure_of_other_task_is_ignored(self):
        row = self._row([], [_measurement(2, 1, catalog_task_id=99)])
        self.assertEqual(row['status'], 'not_recorded')


class InspectionSignalementTestCase(SimpleTestCase):
    CATALOG = [_catalog(id=1, km=10000), _catalog(id=2, name='Nettoyage')]
    D = datetime.date(2026, 3, 1)

    def _open(self, occurrences):
        result = compute_open_signalements(_data(self.CATALOG, occurrences), VEHICLE)
        everything = [s for sigs in result['by_task'].values() for s in sigs] + result['standalone']
        return sorted((s['sheet_kind'], s['task_id']) for s in everything)

    def _planned(self, task_id=1, sheet_id=5, date=D, catalog_task_id=1):
        return _occurrence(task_id, sheet_id, type='planned', date=date, catalog_task_id=catalog_task_id,
                           sheet_kind='inspection')

    def test_inspection_signalement_is_open_and_tagged(self):
        self.assertEqual(self._open([self._planned()]), [('inspection', 1)])

    def test_closed_by_later_done(self):
        done = _occurrence(2, 6, date=datetime.date(2026, 4, 1))
        self.assertEqual(self._open([self._planned(), done]), [])

    def test_not_closed_by_earlier_done_even_with_same_sheet_id(self):
        # intervention n°5 antérieure, contrôle n°5 postérieur : les ids ne se comparent jamais
        done = _occurrence(2, 5, date=datetime.date(2026, 2, 1))
        self.assertEqual(self._open([self._planned(sheet_id=5), done]), [('inspection', 1)])

    def test_same_day_intervention_closes_inspection_signalement(self):
        done = _occurrence(2, 3, date=self.D)
        self.assertEqual(self._open([self._planned(sheet_id=9), done]), [])

    def test_same_day_inspection_does_not_close_intervention_signalement(self):
        planned = _occurrence(1, 5, type='planned', date=self.D)
        later_inspection_done_like = self._planned(task_id=2, sheet_id=5)
        self.assertEqual(
            self._open([planned, later_inspection_done_like]), [('inspection', 2), ('intervention', 1)],
        )

    def test_free_inspection_signalement_never_closed_by_done(self):
        free = _occurrence(1, 5, type='planned', catalog_task_id=None, name='Bruit', sheet_kind='inspection')
        done = _occurrence(2, 6, date=datetime.date(2026, 4, 1))
        self.assertEqual(self._open([free, done]), [('inspection', 1)])

    def test_dismissed_inspection_signalement_is_not_open(self):
        planned = _occurrence(1, 5, type='planned', sheet_kind='inspection', dismissed=True)
        self.assertEqual(self._open([planned]), [])


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
            'task_id': 1, 'sheet_id': 1, 'sheet_kind': 'intervention', 'sheet_date': datetime.date(2026, 1, 1),
            'catalog_task_id': 2,
            'name': 'Nettoyage', 'description': '', 'source': 'signalement', 'photos': [], 'author_display': '',
        }])
        closed = open_signalement + [_occurrence(2, 2, catalog_task_id=2, name='Nettoyage', date=datetime.date(2026, 2, 1))]
        self.assertEqual(self._open_ids(closed), ([], []))

    def test_dismissed_signalement_is_neither_attached_nor_standalone(self):
        occurrences = [
            _occurrence(1, 1, type='planned', dismissed=True),
            _occurrence(2, 1, type='planned', catalog_task_id=None, name='Bruit', dismissed=True),
            _occurrence(3, 1, type='planned', catalog_task_id=2, name='Nettoyage', dismissed=True),
        ]
        self.assertEqual(self._open_ids(occurrences), ([], []))

    def test_dismissed_and_closed_by_later_realization_is_still_absent(self):
        occurrences = [
            _occurrence(1, 1, type='planned', dismissed=True),
            _occurrence(2, 2, date=datetime.date(2026, 2, 1)),
        ]
        self.assertEqual(self._open_ids(occurrences), ([], []))


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

    def test_wear_task_without_periodicity_is_tracked_not_other_work(self):
        catalog = [_catalog(id=1, name='Plaquettes', is_wear_task=True)]
        occurrences = [_occurrence(1, 1, catalog_task_id=1, name='Plaquettes', wear_level=5)]
        self.assertEqual(compute_other_work(_data(catalog, occurrences), VEHICLE), [])


class InspectionSheetAPITestCase(APITestCase):
    IMAGE_B64 = InterventionSheetAPITestCase.IMAGE_B64

    def setUp(self):
        from garage.apps import _setup_garage_groups
        _setup_garage_groups(sender=None)
        TaskCatalog.objects.all().delete()

        self.action_a = Action.objects.create(name='Action A')
        self.action_b = Action.objects.create(name='Action B')
        self.action_c = Action.objects.create(name='Action C')
        parking = Parking.objects.create(name='Dépôt')

        def make_user(email, group, actions, **extra):
            user = User.objects.create_user(username=email, email=email, password='pass', **extra)
            user.actions.set(actions)
            user.current_action = actions[0]
            user.save()
            user.groups.add(Group.objects.get(name=group))
            return user

        self.garagiste = make_user('g@test.com', 'Garagiste', [self.action_a, self.action_b],
                                   phone='0600000021', first_name='Jean', last_name='Garagiste')
        self.referent = make_user('r@test.com', 'Référents', [self.action_a], phone='0600000022')

        def make_vehicle(imat, fleet_id, action, km, vtype='voiture'):
            return Vehicle.objects.create(
                brand='Renault', modele='Clio', year=2020, imat=imat, fleet_id=fleet_id, kilometer=km,
                status='available', parking=parking, action=action, fuel_type='essence',
                transmission='manuelle', type=vtype,
            )

        self.vehicle = make_vehicle('AA-201-AA', 21, self.action_a, 10000)
        self.vehicle_b = make_vehicle('BB-202-BB', 22, self.action_b, 5000)
        self.vehicle_c = make_vehicle('CC-203-CC', 23, self.action_c, 8000)
        self.scooter = make_vehicle('DD-204-DD', 24, self.action_a, 100, vtype='scouter')

        self.brakes = TaskCatalog.objects.create(
            name='Freins test', vehicle_types=['voiture'], is_wear_task=True, measured_in_inspection=True,
        )
        self.tires = TaskCatalog.objects.create(
            name='Pneus test', vehicle_types=['voiture', 'scouter'], is_wear_task=True, measured_in_inspection=True,
        )
        self.not_measured = TaskCatalog.objects.create(
            name='Disques test', vehicle_types=['voiture'], is_wear_task=True,
        )
        self.oil = TaskCatalog.objects.create(name='Vidange test', vehicle_types=['voiture'], km_periodicity=10000)
        self.client.force_authenticate(user=self.garagiste)

    # ── helpers ──

    def _url(self, sheet=None, suffix=''):
        base = '/api/garage/inspection/'
        return f'{base}{sheet.id}/{suffix}' if sheet else base + suffix

    def _create(self, vehicle=None, **extra):
        return self.client.post(self._url(), {'vehicle': (vehicle or self.vehicle).id, **extra}, format='json')

    def _open_sheet(self, vehicle=None, hours_old=0, **kwargs):
        sheet = InspectionSheet.objects.create(vehicle=vehicle or self.vehicle, created_by=self.garagiste, **kwargs)
        if hours_old:
            InspectionSheet.objects.filter(pk=sheet.pk).update(created_at=timezone.now() - datetime.timedelta(hours=hours_old))
            sheet.refresh_from_db()
        return sheet

    def _validated_sheet(self, vehicle=None, **kwargs):
        kwargs.setdefault('start_mileage', 10500)
        kwargs.setdefault('start_date', datetime.date(2026, 1, 1))
        return InspectionSheet.objects.create(
            vehicle=vehicle or self.vehicle, created_by=self.garagiste, status='validated', **kwargs,
        )

    def _measure_missing(self, sheet, level=8):
        """Complète la fiche : la validation exige une mesure par tâche mesurable du type de véhicule."""
        done = set(sheet.wear_measurements.values_list('catalog_task_id', flat=True))
        for task in get_measurable_tasks(sheet.vehicle):
            if task.id not in done:
                InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=task, level=level)

    def _listed_ids(self):
        data = self.client.get(self._url()).data
        return [row['id'] for row in (data['results'] if isinstance(data, dict) else data)]

    def _maintenance(self):
        response = self.client.get(f'/api/garage/maintenance/{self.vehicle.id}/')
        self.assertEqual(response.status_code, 200)
        return response.data

    # ── 5.1 cycle complet ──

    def test_full_cycle_creates_sheet_then_validates_with_mileage_entry(self):
        response = self._create()
        self.assertEqual(response.status_code, 201, response.data)
        sheet = InspectionSheet.objects.get(pk=response.data['id'])
        self.assertEqual((sheet.status, sheet.current_step, sheet.start_date), ('open', 1, timezone.localdate()))
        response = self.client.patch(self._url(sheet), {
            'current_step': 3, 'start_mileage': 10200, 'oil_ok': True, 'coolant_ok': False, 'lights_ok': True,
            'wear_measurements': [{'catalog_task': self.brakes.id, 'level': 6}, {'catalog_task': self.tires.id, 'level': 7}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(self._url(sheet, 'validate/'))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'validated')
        self.assertEqual(response.data['warnings'], [])
        entry = MileageEntry.objects.get(source='inspection')
        self.assertEqual((entry.source_id, entry.value, entry.date), (sheet.id, 10200, sheet.start_date))
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.kilometer, 10200)

    def test_backdated_validation_warns_and_keeps_vehicle_km(self):
        MileageEntry.objects.create(
            vehicle=self.vehicle, value=10000, date=datetime.date(2026, 5, 1), source='creation', author=self.garagiste,
        )
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self._measure_missing(sheet)
        response = self.client.post(self._url(sheet, 'validate/'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['warnings'][0]['code'], 'mileage_not_applied')
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.kilometer, 10000)

    def test_validate_without_mileage_is_refused(self):
        sheet = self._open_sheet()
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 400)
        self.assertFalse(MileageEntry.objects.filter(source='inspection').exists())

    def test_second_open_sheet_for_same_vehicle_is_refused(self):
        self._open_sheet()
        self.assertEqual(self._create().status_code, 400)
        self.assertEqual(self._create(vehicle=self.scooter).status_code, 201)

    def test_delete_open_sheet_ok_validated_refused(self):
        sheet = self._open_sheet()
        self.assertEqual(self.client.delete(self._url(sheet)).status_code, 204)
        validated = self._validated_sheet()
        self.assertEqual(self.client.delete(self._url(validated)).status_code, 400)
        self.assertTrue(InspectionSheet.objects.filter(pk=validated.pk).exists())

    def test_future_start_date_refused_for_both_sheet_kinds(self):
        future = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        self.assertEqual(self._create(start_date=future).status_code, 400)
        response = self.client.post('/api/garage/intervention/', {'vehicle': self.vehicle.id, 'start_date': future}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_start_mileage_below_reference_refused(self):
        sheet = self._open_sheet()
        response = self.client.patch(self._url(sheet), {'start_mileage': 9000}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

    def test_current_step_out_of_range_refused(self):
        sheet = self._open_sheet()
        self.assertEqual(self.client.patch(self._url(sheet), {'current_step': 8}, format='json').status_code, 400)

    # ── 5.2 expiration ──

    def test_expired_sheet_is_hidden_and_not_editable_nor_validatable(self):
        sheet = self._open_sheet(hours_old=25, start_mileage=10100)
        ids = self._listed_ids()
        self.assertNotIn(sheet.id, ids)
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 400)
        self.assertFalse(MileageEntry.objects.filter(source='inspection').exists())
        self.assertEqual(InspectionSheet.objects.get(pk=sheet.pk).status, 'open')

    def test_sheet_under_limit_is_resumable_and_listed(self):
        sheet = self._open_sheet(hours_old=23)
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 200)
        self.assertIn(sheet.id, self._listed_ids())

    def test_expiration_delay_is_read_from_config(self):
        config = get_config()
        config.inspection_open_max_hours = 2
        config.save()
        sheet = self._open_sheet(hours_old=3)
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 400)
        recent = self._open_sheet(vehicle=self.scooter, hours_old=1)
        self.assertEqual(self.client.patch(self._url(recent), {'oil_ok': True}, format='json').status_code, 200)

    def test_expired_sheet_does_not_block_new_one(self):
        self._open_sheet(hours_old=30)
        self.assertEqual(self._create().status_code, 201)

    def test_validated_old_sheet_is_never_expired(self):
        sheet = self._validated_sheet()
        InspectionSheet.objects.filter(pk=sheet.pk).update(created_at=timezone.now() - datetime.timedelta(days=90))
        response = self.client.get(self._url(sheet))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_expired'])
        self.assertIsNone(response.data['expires_at'])

    def test_expired_sheet_refuses_tasks_and_damages(self):
        sheet = self._open_sheet(hours_old=25)
        self.assertEqual(self.client.post(self._url(sheet, 'tasks/'), {'name': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self._url(sheet, 'damages/'), {'description': 'x'}, format='json').status_code, 400)

    # ── 5.3 permissions et périmètre ──

    def test_referent_reads_but_cannot_write(self):
        sheet = self._validated_sheet()
        self.client.force_authenticate(user=self.referent)
        self.assertEqual(self.client.get(self._url(sheet)).status_code, 200)
        self.assertEqual(self._create().status_code, 403)
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 403)
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 403)
        self.assertEqual(self.client.get(self._url(suffix=f'measurable-tasks/?vehicle={self.vehicle.id}')).status_code, 403)

    def test_garagiste_sees_all_his_actions_but_not_others(self):
        mine = self._validated_sheet(vehicle=self.vehicle_b)
        other = self._validated_sheet(vehicle=self.vehicle_c)
        ids = self._listed_ids()
        self.assertIn(mine.id, ids)
        self.assertNotIn(other.id, ids)
        self.assertEqual(self.client.get(self._url(other)).status_code, 404)
        self.assertEqual(self._create(vehicle=self.vehicle_c).status_code, 400)

    def _contract(self, **kwargs):
        beneficiary = Beneficiary.objects.create(
            first_name='B', last_name='B', phone='0600000099', address='1 rue Test', email='b@b.com',
            city='Paris', postal_code='75001', action=self.action_a,
        ) if not hasattr(self, '_beneficiary') else self._beneficiary
        self._beneficiary = beneficiary
        defaults = dict(
            vehicle=self.vehicle, beneficiary=beneficiary, start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 4, 1), price=100, deposit=50, start_kilometer=10000, referent=self.garagiste,
            action=self.action_a,
        )
        defaults.update(kwargs)
        return Contract.objects.create(**defaults)

    def _list_for_contract(self, contract):
        data = self.client.get(self._url(), {'contract': contract.id}).data
        return sorted(row['id'] for row in (data['results'] if isinstance(data, dict) else data))

    def test_contract_filter_bounded_period(self):
        user = self.garagiste
        user.user_permissions.add(Permission.objects.get(codename='view_contract'))
        user = User.objects.get(pk=user.pk)
        self.client.force_authenticate(user=user)
        contract = self._contract(status='over', ended_at=timezone.make_aware(datetime.datetime(2026, 4, 1)))
        inside = self._validated_sheet(start_date=datetime.date(2026, 3, 1))
        self._validated_sheet(start_date=datetime.date(2026, 1, 15))   # avant
        self._validated_sheet(start_date=datetime.date(2026, 4, 2))    # après
        self._validated_sheet(vehicle=self.scooter, start_date=datetime.date(2026, 3, 1))  # autre véhicule
        self._open_sheet(vehicle=self.vehicle_b)  # ouverte, autre véhicule
        self.assertEqual(self._list_for_contract(contract), [inside.id])

    def test_contract_filter_open_ended_and_open_sheet_excluded(self):
        self.garagiste.user_permissions.add(Permission.objects.get(codename='view_contract'))
        self.client.force_authenticate(user=User.objects.get(pk=self.garagiste.pk))
        contract = self._contract(status='pending')
        late = self._validated_sheet(start_date=datetime.date(2030, 1, 1))
        self._open_sheet(start_date=datetime.date(2026, 3, 1))
        self.assertEqual(self._list_for_contract(contract), [late.id])

    def test_contract_filter_requires_view_contract_and_current_action(self):
        contract = self._contract()
        self._validated_sheet(start_date=datetime.date(2026, 3, 1))
        self.assertEqual(self._list_for_contract(contract), [])  # pas de api.view_contract
        self.garagiste.user_permissions.add(Permission.objects.get(codename='view_contract'))
        user = User.objects.get(pk=self.garagiste.pk)
        user.current_action = self.action_b
        user.save()
        self.client.force_authenticate(user=user)
        self.assertEqual(self._list_for_contract(contract), [])  # contrat hors Action courante

    # ── 5.4 mesures ──

    def _patch_measurements(self, sheet, measurements):
        return self.client.patch(self._url(sheet), {'wear_measurements': measurements}, format='json')

    def test_measurement_on_unmeasured_inapplicable_or_archived_task_refused(self):
        sheet = self._open_sheet()
        self.assertEqual(self._patch_measurements(sheet, [{'catalog_task': self.not_measured.id, 'level': 5}]).status_code, 400)
        self.assertEqual(self._patch_measurements(sheet, [{'catalog_task': self.oil.id, 'level': 5}]).status_code, 400)
        scooter_sheet = self._open_sheet(vehicle=self.scooter)
        self.assertEqual(self._patch_measurements(scooter_sheet, [{'catalog_task': self.brakes.id, 'level': 5}]).status_code, 400)
        self.assertEqual(self._patch_measurements(scooter_sheet, [{'catalog_task': self.tires.id, 'level': 5}]).status_code, 200)
        TaskCatalog.objects.filter(pk=self.brakes.pk).update(archived=True)
        self.assertEqual(self._patch_measurements(sheet, [{'catalog_task': self.brakes.id, 'level': 5}]).status_code, 400)

    def test_duplicate_measurement_and_out_of_range_level_refused(self):
        sheet = self._open_sheet()
        both = [{'catalog_task': self.brakes.id, 'level': 5}, {'catalog_task': self.brakes.id, 'level': 6}]
        self.assertEqual(self._patch_measurements(sheet, both).status_code, 400)
        self.assertEqual(self._patch_measurements(sheet, [{'catalog_task': self.brakes.id, 'level': 11}]).status_code, 400)
        self.assertEqual(sheet.wear_measurements.count(), 0)

    def test_measurements_patch_replaces_everything(self):
        sheet = self._open_sheet()
        self._patch_measurements(sheet, [{'catalog_task': self.brakes.id, 'level': 5}, {'catalog_task': self.tires.id, 'level': 7}])
        self.assertEqual(sheet.wear_measurements.count(), 2)
        self._patch_measurements(sheet, [{'catalog_task': self.tires.id, 'level': 2}])
        self.assertEqual(list(sheet.wear_measurements.values_list('catalog_task_id', 'level')), [(self.tires.id, 2)])
        self.client.patch(self._url(sheet), {'oil_ok': True}, format='json')  # sans la clé : mesures conservées
        self.assertEqual(sheet.wear_measurements.count(), 1)

    def test_validation_rechecks_measurements(self):
        sheet = self._open_sheet(start_mileage=10100)
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.not_measured, level=5)
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 400)
        self.assertEqual(InspectionSheet.objects.get(pk=sheet.pk).status, 'open')
        self.assertFalse(MileageEntry.objects.filter(source='inspection').exists())

    def test_measurable_tasks_order_filter_and_param(self):
        TaskCatalog.objects.create(name='Aaa archivée', vehicle_types=['voiture'], is_wear_task=True,
                                   measured_in_inspection=True, archived=True)
        response = self.client.get(self._url(suffix=f'measurable-tasks/?vehicle={self.vehicle.id}'))
        self.assertEqual([t['name'] for t in response.data], ['Freins test', 'Pneus test'])
        self.assertEqual(set(response.data[0]), {'id', 'name', 'icon'})
        response = self.client.get(self._url(suffix=f'measurable-tasks/?vehicle={self.scooter.id}'))
        self.assertEqual([t['name'] for t in response.data], ['Pneus test'])
        self.assertEqual(self.client.get(self._url(suffix='measurable-tasks/')).status_code, 400)
        self.assertEqual(self.client.get(self._url(suffix='measurable-tasks/?vehicle=abc')).status_code, 400)
        self.assertEqual(self.client.get(self._url(suffix='measurable-tasks/?vehicle=99999')).status_code, 404)
        self.assertEqual(self.client.get(self._url(suffix=f'measurable-tasks/?vehicle={self.vehicle_c.id}')).status_code, 404)

    def test_validated_measurement_feeds_maintenance_summary(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=2)
        row = next(r for r in self._maintenance()['tasks'] if r['catalog_task_id'] == self.brakes.id)
        self.assertEqual(row['status'], 'not_recorded')  # fiche encore ouverte : mesure ignorée
        self._measure_missing(sheet)
        self.client.post(self._url(sheet, 'validate/'))
        row = next(r for r in self._maintenance()['tasks'] if r['catalog_task_id'] == self.brakes.id)
        self.assertEqual(row['status'], 'overdue')
        self.assertEqual(row['last_measurement']['level'], 2)
        self.assertEqual(row['last_measurement']['sheet_id'], sheet.id)
        self.assertIsNone(row['km'])

    # ── 5.5 fiche validée : édition et audit ──

    def test_editing_validated_sheet_writes_audit_log(self):
        sheet = self._validated_sheet(lights_notes='avant')
        response = self.client.patch(self._url(sheet), {'lights_notes': 'après', 'oil_ok': False}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        logs = AuditLog.objects.filter(content_type=ContentType.objects.get_for_model(InspectionSheet), object_id=sheet.id)
        by_field = {log.field_name: log for log in logs}
        self.assertEqual((by_field['lights_notes'].old_value, by_field['lights_notes'].new_value), ('avant', 'après'))
        self.assertEqual(by_field['lights_notes'].author, self.garagiste)
        self.assertEqual(by_field['oil_ok'].new_value, 'False')
        self.client.patch(self._url(sheet), {'lights_notes': 'après'}, format='json')
        self.assertEqual(logs.count(), 2)  # valeur inchangée : rien de nouveau

    def test_validated_sheet_mileage_and_step_are_immutable(self):
        sheet = self._validated_sheet(current_step=7)
        self.assertEqual(self.client.patch(self._url(sheet), {'start_mileage': 10600}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self._url(sheet), {'current_step': 2}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self._url(sheet), {'start_date': None}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self._url(sheet), {'start_mileage': 10500}, format='json').status_code, 200)

    def test_measurements_change_on_validated_sheet_writes_one_entry(self):
        sheet = self._validated_sheet()
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=8)
        response = self._patch_measurements(sheet, [
            {'catalog_task': self.brakes.id, 'level': 5}, {'catalog_task': self.tires.id, 'level': 6},
        ])
        self.assertEqual(response.status_code, 200)
        logs = AuditLog.objects.filter(field_name='wear_measurements')
        self.assertEqual(logs.count(), 1)
        self.assertIn('Freins test : 8/10', logs[0].old_value)
        self.assertIn('Pneus test : 6/10', logs[0].new_value)

    def test_tasks_damages_and_photos_are_traced_on_validated_sheet(self):
        sheet = self._validated_sheet()
        response = self.client.post(self._url(sheet, 'tasks/'), {'name': 'Bruit', 'photos': [self.IMAGE_B64]}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        task_id = response.data['id']
        self.assertEqual(len(response.data['photos']), 1)
        self.assertTrue(AuditLog.objects.filter(action='task_added', object_id=task_id).exists())
        photo_id = response.data['photos'][0]['id']
        response = self.client.patch(
            self._url(sheet, f'tasks/{task_id}/'),
            {'description': 'fort', 'remove_photo_ids': [photo_id], 'add_photos': [self.IMAGE_B64]}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        fields = set(AuditLog.objects.filter(
            content_type=ContentType.objects.get_for_model(InspectionTask), object_id=task_id,
        ).values_list('field_name', flat=True))
        self.assertTrue({'description', 'photos'} <= fields)
        response = self.client.post(self._url(sheet, 'damages/'), {'description': 'Rayure', 'photos': [self.IMAGE_B64]}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        damage_id = response.data['id']
        self.assertTrue(AuditLog.objects.filter(action='damage_added', object_id=damage_id).exists())
        history = self.client.get(self._url(sheet, 'audit-log/'))
        self.assertEqual(history.status_code, 200)
        self.assertTrue({'task_added', 'damage_added'} <= {log['action'] for log in history.data})
        self.client.patch(self._url(sheet, f'damages/{damage_id}/'), {'description': 'Grosse rayure'}, format='json')
        self.assertEqual(self.client.delete(self._url(sheet, f'damages/{damage_id}/')).status_code, 204)
        self.assertTrue(AuditLog.objects.filter(action='damage_deleted', old_value__contains='Rayure').exists())
        self.assertEqual(GaragePhoto.objects.filter(
            content_type=ContentType.objects.get_for_model(InspectionDamage)).count(), 0)
        self.assertEqual(self.client.delete(self._url(sheet, f'tasks/{task_id}/')).status_code, 204)
        self.assertTrue(AuditLog.objects.filter(action='task_deleted').exists())

    def test_changes_on_open_sheet_are_not_audited(self):
        sheet = self._open_sheet()
        self.client.patch(self._url(sheet), {'oil_ok': True}, format='json')
        self.client.post(self._url(sheet, 'tasks/'), {'name': 'Bruit'}, format='json')
        self.client.post(self._url(sheet, 'damages/'), {'description': 'Rayure'}, format='json')
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_free_task_requires_a_name_and_nonnumeric_task_pk_is_404(self):
        sheet = self._open_sheet()
        self.assertEqual(self.client.post(self._url(sheet, 'tasks/'), {'description': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self._url(sheet, 'tasks/abc/'), {}, format='json').status_code, 404)
        self.assertEqual(self.client.patch(self._url(sheet, 'damages/abc/'), {}, format='json').status_code, 404)

    def test_deleting_open_sheet_removes_photos(self):
        sheet = self._open_sheet()
        self.client.post(self._url(sheet, 'tasks/'), {'name': 'Bruit', 'photos': [self.IMAGE_B64]}, format='json')
        self.assertEqual(GaragePhoto.objects.count(), 1)
        self.client.delete(self._url(sheet))
        self.assertEqual(GaragePhoto.objects.count(), 0)

    # ── 5.6 signalements ──

    def _inspection_signalement(self, **kwargs):
        sheet = self._validated_sheet()
        kwargs.setdefault('name', 'Bruit train avant')
        return sheet, InspectionTask.objects.create(sheet=sheet, **kwargs)

    def _dismiss_url(self, sheet, task):
        return self._url(sheet, f'tasks/{task.id}/dismiss/')

    def test_inspection_task_shows_in_summary_tagged_inspection(self):
        sheet, task = self._inspection_signalement()
        standalone = self._maintenance()['signalements']
        self.assertEqual([(s['task_id'], s['sheet_kind'], s['sheet_id']) for s in standalone], [(task.id, 'inspection', sheet.id)])
        _, task_oil = self._inspection_signalement(name='', catalog_task=self.oil)
        row = next(r for r in self._maintenance()['tasks'] if r['catalog_task_id'] == self.oil.id)
        self.assertEqual((row['status'], row['source']), ('to_plan', 'signalement'))
        self.assertEqual(row['signalements'][0]['sheet_kind'], 'inspection')

    def test_dismiss_inspection_signalement(self):
        sheet, task = self._inspection_signalement()
        response = self.client.post(self._dismiss_url(sheet, task))
        self.assertEqual(response.status_code, 204)
        task.refresh_from_db()
        self.assertEqual(task.dismissed_by, self.garagiste)
        self.assertTrue(AuditLog.objects.filter(
            action='task_dismissed', content_type=ContentType.objects.get_for_model(InspectionTask), object_id=task.id,
        ).exists())
        self.assertEqual(self._maintenance()['signalements'], [])
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)  # déjà écarté

    def test_dismiss_already_closed_signalement_is_refused_without_audit(self):
        sheet, task = self._inspection_signalement(name='', catalog_task=self.oil)
        later = InterventionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.garagiste, status='validated',
            start_mileage=10600, start_date=datetime.date(2026, 2, 1),
        )
        InterventionTask.objects.create(sheet=later, type='done', catalog_task=self.oil)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_dismiss_closed_intervention_signalement_is_refused_without_audit(self):
        old = InterventionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.garagiste, status='validated',
            start_mileage=10100, start_date=datetime.date(2026, 1, 1),
        )
        planned = InterventionTask.objects.create(sheet=old, type='planned', catalog_task=self.oil)
        later = InterventionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.garagiste, status='validated',
            start_mileage=10600, start_date=datetime.date(2026, 2, 1),
        )
        InterventionTask.objects.create(sheet=later, type='done', catalog_task=self.oil)
        response = self.client.post(f'/api/garage/intervention/{old.id}/tasks/{planned.id}/dismiss/')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_dismiss_nonnumeric_pk_is_404_for_both_kinds(self):
        sheet, _ = self._inspection_signalement()
        self.assertEqual(self.client.post(self._url(sheet, 'tasks/abc/dismiss/')).status_code, 404)
        intervention = InterventionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.garagiste, status='validated',
            start_mileage=10100, start_date=datetime.date(2026, 1, 1),
        )
        self.assertEqual(self.client.post(f'/api/garage/intervention/{intervention.id}/tasks/abc/dismiss/').status_code, 404)

    def test_open_inspection_sheet_task_cannot_be_dismissed(self):
        sheet = self._open_sheet()
        task = InspectionTask.objects.create(sheet=sheet, name='Bruit')
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 400)

    def test_dismiss_requires_manage_intervention(self):
        sheet, task = self._inspection_signalement()
        self.client.force_authenticate(user=self.referent)
        self.assertEqual(self.client.post(self._dismiss_url(sheet, task)).status_code, 403)

    def test_is_signalement_open_distinguishes_sheet_kinds(self):
        sheet, task = self._inspection_signalement()
        self.assertTrue(is_signalement_open(self.vehicle, 'inspection', task.id))
        self.assertFalse(is_signalement_open(self.vehicle, 'intervention', task.id))

    # ── 5.7 correction km ──

    def test_mileage_correction_updates_inspection_sheet(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self._measure_missing(sheet)
        self.client.post(self._url(sheet, 'validate/'))
        entry = MileageEntry.objects.get(source='inspection')
        responsible = User.objects.create_user(username='resp@test.com', email='resp@test.com', password='pass', phone='0600000023')
        responsible.actions.set([self.action_a])
        responsible.current_action = self.action_a
        responsible.save()
        responsible.groups.add(Group.objects.get(name='Responsable garagiste'))
        self.client.force_authenticate(user=responsible)
        response = self.client.post(
            f'/api/garage/mileage/{self.vehicle.id}/correct/',
            {'entry': entry.id, 'value': 10150, 'reason': 'Erreur de saisie'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        sheet.refresh_from_db()
        self.assertEqual(sheet.start_mileage, 10150)

    # ── 5.8 config, catalogue, permissions ──

    def test_config_endpoint_exposes_thresholds(self):
        response = self.client.get('/api/garage/config/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'wear_alert_threshold': 5, 'wear_critical_threshold': 2, 'inspection_edit_days': 3})
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get('/api/garage/config/').status_code, (401, 403))

    def test_threshold_above_ten_is_refused(self):
        config = get_config()
        config.wear_alert_threshold = 11
        with self.assertRaises(ValidationError):
            config.save()

    def test_measured_in_inspection_requires_wear_task(self):
        task = TaskCatalog(name='Vidange x', vehicle_types=['voiture'], measured_in_inspection=True)
        with self.assertRaises(ValidationError):
            task.full_clean()
        task.is_wear_task = True
        task.full_clean()
        form = TaskCatalogForm(data={
            'name': 'Vidange y', 'icon': 'tool', 'vehicle_types': ['voiture'], 'measured_in_inspection': True,
        })
        self.assertFalse(form.is_valid())
        self.assertIn('measured_in_inspection', form.errors)

    def test_seed_marks_brake_pads_and_tires(self):
        import importlib
        migration = importlib.import_module('garage.migrations.0020_inspection_sheet')
        TaskCatalog.objects.create(name='Plaquettes de frein', vehicle_types=['voiture'], is_wear_task=True)
        TaskCatalog.objects.create(name='Pneus', vehicle_types=['voiture'], is_wear_task=True)
        TaskCatalog.objects.create(name='Freins arrière', vehicle_types=['voiture'], is_wear_task=True)
        from django.apps import apps
        migration.mark_measured_tasks(apps, None)
        self.assertEqual(
            set(TaskCatalog.objects.filter(measured_in_inspection=True).exclude(pk__in=[self.brakes.pk, self.tires.pk])
                .values_list('name', flat=True)),
            {'Plaquettes de frein', 'Pneus'},
        )

    def test_manage_inspection_permission_moved_to_inspection_sheet(self):
        permission = Permission.objects.get(codename='manage_inspection')
        self.assertEqual(permission.content_type.model, 'inspectionsheet')
        self.assertEqual(Permission.objects.filter(codename='manage_inspection').count(), 1)
        for group_name in ('Garagiste', 'Responsable garagiste'):
            self.assertIn(permission, Group.objects.get(name=group_name).permissions.all())
        for group_name in ('Référents', 'Responsable référents'):
            self.assertNotIn(permission, Group.objects.get(name=group_name).permissions.all())

    def test_obsolete_permission_cleanup(self):
        from django.apps import apps
        import importlib
        migration = importlib.import_module('garage.migrations.0020_inspection_sheet')
        stale = Permission.objects.create(
            codename='manage_inspection', name='ancienne',
            content_type=ContentType.objects.get_for_model(MaintenanceConfig),
        )
        migration.delete_obsolete_permissions(apps, None)
        self.assertFalse(Permission.objects.filter(pk=stale.pk).exists())
        self.assertEqual(Permission.objects.filter(codename='manage_inspection').count(), 1)

    # ── revue de code 3.1 ──

    def test_create_with_null_start_date_defaults_to_today(self):
        response = self._create(start_date=None)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(InspectionSheet.objects.get(pk=response.data['id']).start_date, timezone.localdate())

    def test_start_date_change_rechecks_stored_mileage(self):
        MileageEntry.objects.create(
            vehicle=self.vehicle, value=12000, date=datetime.date(2026, 2, 1), source='creation', author=self.garagiste,
        )
        sheet = self._open_sheet(start_mileage=11000, start_date=datetime.date(2026, 1, 1))
        response = self.client.patch(self._url(sheet), {'start_date': '2026-03-01'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_mileage', response.data)

    def test_start_date_change_on_validated_sheet_moves_mileage_entry(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self._measure_missing(sheet)
        self.client.post(self._url(sheet, 'validate/'))
        response = self.client.patch(self._url(sheet), {'start_date': '2026-03-05'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(MileageEntry.objects.get(source='inspection').date, datetime.date(2026, 3, 5))

    def test_task_with_archived_or_inapplicable_catalog_task_is_refused(self):
        sheet = self._open_sheet(vehicle=self.scooter)
        response = self.client.post(self._url(sheet, 'tasks/'), {'catalog_task': self.brakes.id}, format='json')
        self.assertEqual(response.status_code, 400)  # Freins test : voiture seulement
        self.tires.archived = True
        self.tires.save()
        response = self.client.post(self._url(sheet, 'tasks/'), {'catalog_task': self.tires.id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unchanged_measurement_on_now_archived_task_does_not_block_edit(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=4)
        self.brakes.archived = True
        self.brakes.save()
        response = self.client.patch(self._url(sheet), {
            'oil_ok': True, 'wear_measurements': [{'catalog_task': self.brakes.id, 'level': 4}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.patch(self._url(sheet), {
            'wear_measurements': [{'catalog_task': self.brakes.id, 'level': 3}],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    # ── Story 3.3 : validated_at, fenêtre d'édition, mesures complètes, relevé km courant ──

    def _responsible(self):
        user = User.objects.create_user(username='resp2@test.com', email='resp2@test.com', password='pass', phone='0600000024')
        user.actions.set([self.action_a])
        user.current_action = self.action_a
        user.save()
        user.groups.add(Group.objects.get(name='Responsable garagiste'))
        return user

    def _validated_at(self, delta, **kwargs):
        """Fiche validée il y a `delta` (horloge réelle) ; updated_at suit validated_at par défaut."""
        sheet = self._validated_sheet(**kwargs)
        InspectionSheet.objects.filter(pk=sheet.pk).update(validated_at=timezone.now() - delta)
        sheet.refresh_from_db()
        return sheet

    def test_validation_sets_validated_at_and_open_sheet_has_none(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self.assertIsNone(self.client.get(self._url(sheet)).data['validated_at'])
        self._measure_missing(sheet)
        before = timezone.now()
        response = self.client.post(self._url(sheet, 'validate/'))
        self.assertEqual(response.status_code, 200, response.data)
        sheet.refresh_from_db()
        self.assertGreaterEqual(sheet.validated_at, before)
        self.assertIsNotNone(response.data['validated_at'])

    def test_patch_cannot_change_validated_at(self):
        sheet = self._validated_sheet()
        InspectionSheet.objects.filter(pk=sheet.pk).update(validated_at=timezone.now())
        sheet.refresh_from_db()
        response = self.client.patch(self._url(sheet), {'validated_at': '2020-01-01T00:00:00Z', 'oil_ok': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        updated = InspectionSheet.objects.get(pk=sheet.pk)
        self.assertEqual(updated.validated_at, sheet.validated_at)

    def test_validation_requires_every_measurable_task_measured(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=5)
        response = self.client.post(self._url(sheet, 'validate/'))
        self.assertEqual(response.status_code, 400)
        self.assertIn('Pneus test', str(response.data['wear_measurements']))
        self.assertNotIn('Freins test', str(response.data['wear_measurements']))
        sheet.refresh_from_db()
        self.assertEqual((sheet.status, sheet.validated_at), ('open', None))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.tires, level=5)
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 200)

    def test_validation_only_requires_tasks_of_the_vehicle_type(self):
        sheet = self._open_sheet(vehicle=self.scooter, start_mileage=150, start_date=datetime.date(2026, 3, 1))
        response = self.client.post(self._url(sheet, 'validate/'))
        self.assertEqual(response.status_code, 400)
        self.assertIn('Pneus test', str(response.data['wear_measurements']))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.tires, level=5)  # pas de freins sur scooter
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 200)

    def test_validation_without_any_measurable_task_is_allowed(self):
        TaskCatalog.objects.filter(measured_in_inspection=True).update(measured_in_inspection=False)
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self.assertEqual(self.client.post(self._url(sheet, 'validate/')).status_code, 200)

    def test_measurement_cannot_be_removed_from_validated_sheet_but_unmeasured_task_not_required(self):
        sheet = self._validated_sheet()
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=5)
        response = self.client.patch(self._url(sheet), {'wear_measurements': []}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Freins test', str(response.data['wear_measurements']))
        self.assertEqual(sheet.wear_measurements.count(), 1)
        # Pneus jamais mesurés (catalogue étendu après coup) : n'empêche pas la modification
        response = self.client.patch(self._url(sheet), {
            'wear_measurements': [{'catalog_task': self.brakes.id, 'level': 4}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_measurement_level_is_required(self):
        sheet = self._open_sheet()
        response = self.client.patch(self._url(sheet), {'wear_measurements': [{'catalog_task': self.brakes.id}]}, format='json')
        self.assertEqual(response.status_code, 400)

    # fenêtre de modification

    def _edit_attempts(self, sheet):
        damage = InspectionDamage.objects.create(sheet=sheet, description='Rayure')
        task = InspectionTask.objects.create(sheet=sheet, name='Phares')
        return {
            'sheet': self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code,
            'damage_add': self.client.post(self._url(sheet, 'damages/'), {'description': 'Bosse'}, format='json').status_code,
            'damage_patch': self.client.patch(self._url(sheet, f'damages/{damage.id}/'), {'description': 'Rayure 2'}, format='json').status_code,
            'damage_delete': self.client.delete(self._url(sheet, f'damages/{damage.id}/')).status_code,
            'task_add': self.client.post(self._url(sheet, 'tasks/'), {'name': 'Essuie-glace'}, format='json').status_code,
            'task_patch': self.client.patch(self._url(sheet, f'tasks/{task.id}/'), {'name': 'Phares avant'}, format='json').status_code,
            'task_delete': self.client.delete(self._url(sheet, f'tasks/{task.id}/')).status_code,
        }

    def test_edit_within_window_is_open_to_any_garagiste(self):
        sheet = self._validated_at(datetime.timedelta(days=2, hours=23))
        self.assertEqual(set(self._edit_attempts(sheet).values()), {200, 201, 204})

    def test_edit_after_window_is_refused_to_garagiste_on_every_endpoint(self):
        sheet = self._validated_at(datetime.timedelta(days=3, hours=1))
        codes = self._edit_attempts(sheet)
        self.assertEqual(set(codes.values()), {403}, codes)
        response = self.client.patch(self._url(sheet), {'oil_ok': True}, format='json')
        self.assertIn('plus de 3 jours', response.data['detail'])
        self.assertIn('responsable', response.data['detail'])

    def test_edit_after_window_is_allowed_with_edit_validated_inspection(self):
        sheet = self._validated_at(datetime.timedelta(days=30))
        self.client.force_authenticate(user=self._responsible())
        self.assertEqual(set(self._edit_attempts(sheet).values()), {200, 201, 204})

    def test_edit_window_follows_config_and_message_uses_it(self):
        config = get_config()
        config.inspection_edit_days = 1
        config.save()
        sheet = self._validated_at(datetime.timedelta(days=2))
        response = self.client.patch(self._url(sheet), {'oil_ok': True}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('plus de 1 jour :', response.data['detail'])
        config.inspection_edit_days = 5
        config.save()
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 200)

    def test_edit_window_exact_limit_uses_frozen_clock(self):
        from unittest import mock
        sheet = self._validated_sheet()
        validated = datetime.datetime(2026, 6, 1, 12, 0, tzinfo=datetime.timezone.utc)
        InspectionSheet.objects.filter(pk=sheet.pk).update(validated_at=validated)
        limit = validated + datetime.timedelta(days=3)
        with mock.patch('django.utils.timezone.now', return_value=limit):
            self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 200)
        with mock.patch('django.utils.timezone.now', return_value=limit + datetime.timedelta(seconds=1)):
            self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': False}, format='json').status_code, 403)

    def test_open_sheet_is_not_concerned_by_edit_window(self):
        sheet = self._open_sheet()
        InspectionSheet.objects.filter(pk=sheet.pk).update(validated_at=timezone.now() - datetime.timedelta(days=90))
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 200)

    def test_validated_sheet_without_validated_at_falls_back_on_updated_at(self):
        sheet = self._validated_sheet()  # validated_at nul (donnée ancienne)
        self.assertIsNone(sheet.validated_at)
        InspectionSheet.objects.filter(pk=sheet.pk).update(updated_at=timezone.now() - datetime.timedelta(days=10))
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 403)
        InspectionSheet.objects.filter(pk=sheet.pk).update(updated_at=timezone.now() - datetime.timedelta(days=1))
        self.assertEqual(self.client.patch(self._url(sheet), {'oil_ok': True}, format='json').status_code, 200)

    def test_dismiss_task_is_not_concerned_by_edit_window(self):
        sheet = self._validated_at(datetime.timedelta(days=30))
        task = InspectionTask.objects.create(sheet=sheet, catalog_task=self.oil)
        self.client.force_authenticate(user=self._responsible())
        response = self.client.post(self._url(sheet, f'tasks/{task.id}/dismiss/'))
        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))

    def test_edit_validated_inspection_permission_belongs_to_responsable_garagiste_only(self):
        self.assertTrue(self._responsible().has_perm('garage.edit_validated_inspection'))
        self.assertFalse(self.garagiste.has_perm('garage.edit_validated_inspection'))
        self.assertFalse(self.referent.has_perm('garage.edit_validated_inspection'))

    # relevé km courant, icône, config

    def test_mileage_entry_is_root_entry_then_follows_corrections(self):
        sheet = self._open_sheet(start_mileage=10100, start_date=datetime.date(2026, 3, 1))
        self.assertIsNone(self.client.get(self._url(sheet)).data['mileage_entry'])
        self._measure_missing(sheet)
        self.client.post(self._url(sheet, 'validate/'))
        root = MileageEntry.objects.get(source='inspection')
        self.assertEqual(self.client.get(self._url(sheet)).data['mileage_entry'], {'id': root.id, 'value': 10100})
        self.client.force_authenticate(user=self._responsible())
        response = self.client.post(
            f'/api/garage/mileage/{self.vehicle.id}/correct/',
            {'entry': root.id, 'value': 10150, 'reason': 'Erreur'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        correction = MileageEntry.objects.get(corrects=root)
        self.assertEqual(self.client.get(self._url(sheet)).data['mileage_entry'], {'id': correction.id, 'value': 10150})

    def test_inspection_signalement_carries_its_author(self):
        sheet = self._validated_sheet(start_date=datetime.date(2026, 3, 1))
        InspectionTask.objects.create(sheet=sheet, name='Phares')
        signalements = self._maintenance()['signalements']
        self.assertEqual([(s['sheet_kind'], s['author_display']) for s in signalements], [('inspection', 'Jean Garagiste')])

    def test_wear_measurement_exposes_catalog_task_icon(self):
        sheet = self._validated_sheet()
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=5)
        measurement = self.client.get(self._url(sheet)).data['wear_measurements'][0]
        self.assertEqual(measurement['catalog_task_icon'], self.brakes.icon)

    def test_maintenance_task_exposes_measure_prevails(self):
        sheet = self._validated_sheet(start_date=datetime.date(2026, 3, 1))
        InspectionWearMeasurement.objects.create(sheet=sheet, catalog_task=self.brakes, level=5)
        rows = {r['catalog_task_id']: r for r in self._maintenance()['tasks']}
        self.assertIs(rows[self.brakes.id]['measure_prevails'], True)
        self.assertIs(rows[self.tires.id]['measure_prevails'], False)


class MeasurePrevailsTestCase(SimpleTestCase):
    """measure_prevails : la mesure prévaut si elle est plus récente que la dernière pose (la pose à égalité)."""
    WEAR = _catalog(id=1, name='Plaquettes', is_wear_task=True)
    POSE = datetime.date(2026, 3, 1)

    def _prevails(self, occurrences, measurements):
        rows = compute_task_statuses(_data([self.WEAR], occurrences, measurements), VEHICLE, TODAY, CONFIG)
        return rows[0]['measure_prevails']

    def test_newer_measure_prevails(self):
        pose = _occurrence(1, 1, date=self.POSE)
        self.assertIs(self._prevails([pose], [_measurement(2, 4, date=datetime.date(2026, 4, 1))]), True)

    def test_same_date_pose_prevails(self):
        pose = _occurrence(1, 1, date=self.POSE)
        self.assertIs(self._prevails([pose], [_measurement(2, 4, date=self.POSE)]), False)

    def test_older_measure_does_not_prevail(self):
        pose = _occurrence(1, 1, date=self.POSE)
        self.assertIs(self._prevails([pose], [_measurement(2, 4, date=datetime.date(2026, 2, 1))]), False)

    def test_measure_without_pose_prevails(self):
        self.assertIs(self._prevails([], [_measurement(2, 4)]), True)

    def test_no_measure_does_not_prevail(self):
        self.assertIs(self._prevails([_occurrence(1, 1, date=self.POSE)], []), False)


class AuditReadabilityTestCase(TestCase):
    """describe_audit_entry et AuditLogAdmin : un journal lisible par un responsable, en lecture seule."""

    def setUp(self):
        from .audit import (
            log_field_change, log_task_added, log_task_deleted, log_task_dismissed, log_damage_added,
            log_damage_deleted,
        )
        self.audit = SimpleNamespace(
            field=log_field_change, task_added=log_task_added, task_deleted=log_task_deleted,
            task_dismissed=log_task_dismissed, damage_added=log_damage_added, damage_deleted=log_damage_deleted,
        )
        TaskCatalog.objects.all().delete()
        action = Action.objects.create(name='Action A')
        parking = Parking.objects.create(name='Dépôt')
        self.user = User.objects.create_user(
            username='k@test.com', email='k@test.com', password='pass', phone='0600000031',
            first_name='Karim', last_name='Garagiste',
        )
        self.vehicle = Vehicle.objects.create(
            brand='Peugeot', modele='208', year=2020, imat='AB-123-CD', fleet_id=31, kilometer=1000,
            status='available', parking=parking, action=action, fuel_type='essence', transmission='manuelle',
            type='voiture',
        )
        self.sheet = InspectionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.user, status='validated', start_mileage=1000,
            start_date=datetime.date(2026, 10, 3),
        )
        self.intervention = InterventionSheet.objects.create(
            vehicle=self.vehicle, created_by=self.user, status='validated', start_mileage=1000,
            start_date=datetime.date(2026, 9, 1), end_date=datetime.date(2026, 9, 1),
        )
        self.superuser = User.objects.create_superuser(
            username='su@test.com', email='su@test.com', password='pass', phone='0600000032',
        )

    def _describe(self, entry):
        from .audit import describe_audit_entry
        return describe_audit_entry(AuditLog.objects.get(pk=entry.pk))

    def _last(self):
        return AuditLog.objects.order_by('-id').first()

    def _field(self, instance, field, old, new):
        self.audit.field(instance, field, old, new, self.user)
        return self._describe(self._last())

    def test_boolean_fields_read_ok_defect(self):
        for field, label in (('oil_ok', "Niveau d'huile"), ('coolant_ok', 'Niveau de refroidissement'),
                             ('washer_ok', 'Niveau de lave-glace'), ('lights_ok', 'Éclairage')):
            d = self._field(self.sheet, field, True, False)
            self.assertEqual((d['action'], d['field'], d['change']), ('Modification', label, 'OK → Défaut'))
        self.assertEqual(self._field(self.sheet, 'oil_ok', None, True)['change'], 'Non vérifié → OK')

    def test_road_test_reads_done_not_done(self):
        d = self._field(self.sheet, 'road_test_done', True, False)
        self.assertEqual((d['field'], d['change']), ('Essai routier', 'Réalisé → Non réalisé'))

    def test_text_fields_and_empty_values(self):
        d = self._field(self.sheet, 'lights_notes', '', 'Feu stop gauche')
        self.assertEqual((d['field'], d['change']), ("Notes d'éclairage", 'vide → Feu stop gauche'))
        d = self._field(self.sheet, 'road_test_notes', 'RAS', '')
        self.assertEqual((d['field'], d['change']), ("Observations de l'essai", 'RAS → vide'))

    def test_start_date_is_formatted(self):
        d = self._field(self.sheet, 'start_date', datetime.date(2026, 10, 3), datetime.date(2026, 10, 4))
        self.assertEqual((d['field'], d['change']), ('Date de début', '03/10/2026 → 04/10/2026'))

    def test_photos_read_as_counts(self):
        d = self._field(self.sheet, 'photos', '#1, #2, #3', '#1, #2')
        self.assertEqual((d['field'], d['change']), ('Photos', '3 photos → 2 photos'))
        self.assertEqual(self._field(self.sheet, 'photos', 'Aucune photo', '#4')['change'], '0 photo → 1 photo')

    def test_wear_measurements_keep_their_readable_text(self):
        d = self._field(self.sheet, 'wear_measurements', 'Pneus : 6/10', 'Pneus : 5/10')
        self.assertEqual((d['field'], d['change']), ('Usure', 'Pneus : 6/10 → Pneus : 5/10'))

    def test_task_and_intervention_fields_have_french_labels(self):
        task = InterventionTask.objects.create(sheet=self.intervention, type='done', description='x')
        for field, label in (('name', 'Nom'), ('description', 'Description'), ('wear_level', "Niveau d'usure"),
                             ('parts', 'Pièces')):
            self.assertEqual(self._field(task, field, 'a', 'b')['field'], label)
        self.assertEqual(self._field(task, 'wear_level', '6', '5')['change'], '6/10 → 5/10')

    def test_add_delete_and_dismiss_actions(self):
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        task = InspectionTask.objects.create(sheet=self.sheet, name='Phares')
        self.audit.damage_added(damage, self.user)
        self.assertEqual(self._describe(self._last())['action'], "Ajout d'un dégât")
        self.audit.damage_deleted(damage, self.user)
        self.assertEqual(self._describe(self._last())['action'], "Suppression d'un dégât")
        self.audit.task_added(task, self.user)
        self.assertEqual(self._describe(self._last())['action'], "Ajout d'une tâche")
        self.audit.task_dismissed(task, self.user)
        self.assertEqual(self._describe(self._last())['action'], "Écartement d'une tâche")
        self.audit.task_deleted(task, self.user)
        self.assertEqual(self._describe(self._last())['action'], "Suppression d'une tâche")

    def test_sheet_is_resolved_from_sheet_task_and_damage(self):
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        self.audit.damage_added(damage, self.user)
        d = self._describe(self._last())
        self.assertEqual((d['sheet_kind'], d['sheet_label'], d['sheet']), ('Contrôle', 'AB-123-CD — 03/10/2026', self.sheet))
        d = self._field(self.sheet, 'oil_ok', True, False)
        self.assertEqual(d['sheet'], self.sheet)
        task = InterventionTask.objects.create(sheet=self.intervention, type='done', description='x')
        d = self._field(task, 'description', 'a', 'b')
        self.assertEqual((d['sheet_kind'], d['sheet_label']), ('Intervention', 'AB-123-CD — 01/09/2026'))

    def test_entry_whose_object_was_deleted_never_fails(self):
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        self.audit.damage_deleted(damage, self.user)
        damage.delete()
        d = self._describe(self._last())
        self.assertEqual((d['sheet_label'], d['sheet']), ('objet supprimé', None))
        self.assertEqual(d['action'], "Suppression d'un dégât")

    def test_author_falls_back_on_email_and_date_is_local(self):
        self.user.first_name = self.user.last_name = ''
        self.user.save()
        d = self._field(self.sheet, 'oil_ok', True, False)
        self.assertEqual(d['author'], 'k@test.com')
        self.assertEqual(d['date'].utcoffset(), timezone.localtime(AuditLog.objects.get().created_at).utcoffset())

    def _admin(self):
        from .admin import AuditLogAdmin
        return AuditLogAdmin(AuditLog, AdminSite())

    def _request(self, **params):
        request = RequestFactory().get('/admin/garage/auditlog/', params)
        request.user = self.superuser
        return request

    def test_admin_is_read_only(self):
        admin_obj, request = self._admin(), self._request()
        self.assertFalse(admin_obj.has_add_permission(request))
        self.assertFalse(admin_obj.has_change_permission(request))
        self.assertFalse(admin_obj.has_delete_permission(request))
        self.assertTrue(admin_obj.has_view_permission(request))

    def test_admin_changelist_renders_every_kind_of_entry(self):
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        self.audit.damage_added(damage, self.user)
        self.audit.damage_deleted(damage, self.user)
        damage.delete()  # entrée orpheline : pas d'erreur 500
        self.audit.field(self.sheet, 'oil_ok', True, False, self.user)
        self.audit.field(self.intervention, 'start_date', datetime.date(2026, 9, 1), datetime.date(2026, 9, 2), self.user)
        self.client.force_login(self.superuser)
        response = self.client.get('/admin/garage/auditlog/')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn('OK → Défaut', content)
        self.assertIn('Karim Garagiste', content)
        self.assertIn('objet supprimé', content)
        self.assertIn(f'/admin/garage/inspectionsheet/{self.sheet.pk}/change/', content)
        self.assertEqual(self.client.get('/admin/garage/auditlog/?sheet_kind=inspection').status_code, 200)

    def test_admin_filters_by_sheet_kind_and_action(self):
        self.audit.field(self.sheet, 'oil_ok', True, False, self.user)
        self.audit.field(self.intervention, 'start_date', datetime.date(2026, 9, 1), datetime.date(2026, 9, 2), self.user)
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        self.audit.damage_added(damage, self.user)
        admin_obj = self._admin()

        def filtered(**params):
            request = self._request(**params)
            changelist = admin_obj.get_changelist_instance(request)
            return changelist.queryset.count()

        self.assertEqual(filtered(), 3)
        self.assertEqual(filtered(sheet_kind='inspection'), 2)
        self.assertEqual(filtered(sheet_kind='intervention'), 1)
        self.assertEqual(filtered(audit_action='damage_added'), 1)

    def test_admin_searches_by_plate_and_author(self):
        self.audit.field(self.sheet, 'oil_ok', True, False, self.user)
        damage = InspectionDamage.objects.create(sheet=self.sheet, description='Rayure')
        self.audit.damage_added(damage, self.user)
        other_vehicle = Vehicle.objects.create(
            brand='Renault', modele='Clio', year=2020, imat='ZZ-999-ZZ', fleet_id=32, kilometer=1,
            status='available', parking=self.vehicle.parking, action=self.vehicle.action, fuel_type='essence',
            transmission='manuelle', type='voiture',
        )
        other = InspectionSheet.objects.create(
            vehicle=other_vehicle, created_by=self.user, status='validated', start_mileage=1, start_date=datetime.date(2026, 1, 1),
        )
        self.audit.field(other, 'oil_ok', True, False, self.user)
        admin_obj = self._admin()
        count = lambda term: admin_obj.get_changelist_instance(self._request(q=term)).queryset.count()
        self.assertEqual(count('AB-123'), 2)  # fiche + dégât de la fiche
        self.assertEqual(count('zz-999'), 1)
        self.assertEqual(count('Karim'), 3)
        self.assertEqual(count('introuvable'), 0)


class ValidatedAtBackfillTestCase(TestCase):
    def test_validated_sheets_get_updated_at_and_open_sheets_stay_empty(self):
        import importlib
        migration = importlib.import_module('garage.migrations.0022_inspection_validated_at_edit_window_help_texts')
        action = Action.objects.create(name='Action A')
        parking = Parking.objects.create(name='Dépôt')
        user = User.objects.create_user(username='b@test.com', email='b@test.com', password='pass', phone='0600000041')
        vehicle = Vehicle.objects.create(
            brand='Renault', modele='Clio', year=2020, imat='BF-001-BF', fleet_id=41, kilometer=1,
            status='available', parking=parking, action=action, fuel_type='essence', transmission='manuelle',
            type='voiture',
        )
        validated = InspectionSheet.objects.create(
            vehicle=vehicle, created_by=user, status='validated', start_mileage=1, start_date=datetime.date(2026, 1, 1),
        )
        opened = InspectionSheet.objects.create(vehicle=vehicle, created_by=user)
        migration.backfill_validated_at(apps, None)
        validated.refresh_from_db()
        opened.refresh_from_db()
        self.assertEqual(validated.validated_at, validated.updated_at)
        self.assertIsNone(opened.validated_at)
