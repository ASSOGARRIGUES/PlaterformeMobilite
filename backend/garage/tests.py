from django.test import TestCase, RequestFactory
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from core.models import Action
from .models import TaskCatalog, MaintenanceConfig
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
