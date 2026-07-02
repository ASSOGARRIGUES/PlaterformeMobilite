import datetime

from django.test import TestCase, RequestFactory
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from core.models import Action
from api.models import Parking, Vehicle
from .models import MileageEntry, TaskCatalog, MaintenanceConfig
from .alerts import get_config
from .admin import MaintenanceConfigAdmin

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

    def _url(self, vehicle):
        return f'/api/garage/mileage/{vehicle.id}/'

    def test_garagiste_sees_history_in_action_a(self):
        self.client.force_authenticate(user=self.garagiste)
        response = self.client.get(self._url(self.vehicle_a))
        self.assertEqual(response.status_code, 200)
        ids = [e['id'] for e in response.data['results']]
        self.assertIn(self.entry_a1.id, ids)
        self.assertIn(self.entry_a2.id, ids)

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
