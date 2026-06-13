from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from core.models import Action
from .models import TaskCatalog

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
        TaskCatalog.objects.create(name='Active', vehicle_type='voiture')
        TaskCatalog.objects.create(name='Archived', vehicle_type='voiture', archived=True)
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 200)
        names = [t['name'] for t in response.data['results']]
        self.assertIn('Active', names)
        self.assertNotIn('Archived', names)

    def test_filter_by_vehicle_type_voiture(self):
        TaskCatalog.objects.create(name='Voiture only', vehicle_type='voiture')
        TaskCatalog.objects.create(name='Both', vehicle_type='les_deux')
        TaskCatalog.objects.create(name='2 roues only', vehicle_type='2_roues')
        response = self.client.get('/api/garage/task-catalog/?vehicle_type=voiture')
        names = [t['name'] for t in response.data['results']]
        self.assertIn('Voiture only', names)
        self.assertIn('Both', names)
        self.assertNotIn('2 roues only', names)

    def test_filter_by_vehicle_type_scouter(self):
        TaskCatalog.objects.create(name='Voiture only', vehicle_type='voiture')
        TaskCatalog.objects.create(name='Both', vehicle_type='les_deux')
        TaskCatalog.objects.create(name='2 roues only', vehicle_type='2_roues')
        response = self.client.get('/api/garage/task-catalog/?vehicle_type=scouter')
        names = [t['name'] for t in response.data['results']]
        self.assertNotIn('Voiture only', names)
        self.assertIn('Both', names)
        self.assertIn('2 roues only', names)

    def test_archived_field_not_in_response(self):
        TaskCatalog.objects.create(name='Task', vehicle_type='voiture')
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('archived', response.data['results'][0])

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/garage/task-catalog/')
        self.assertEqual(response.status_code, 401)

    def test_detail_endpoint(self):
        task = TaskCatalog.objects.create(name='Vidange', vehicle_type='les_deux', km_periodicity=15000, is_critical=False)
        response = self.client.get(f'/api/garage/task-catalog/{task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Vidange')
        self.assertEqual(response.data['km_periodicity'], 15000)
