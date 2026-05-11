from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from inappcom.models import InAppBroadcast

User = get_user_model()


def make_user(email='u@test.com'):
    return User.objects.create_user(
        username=email, email=email, password='pass',
        phone='00', first_name='X', last_name='Y',
    )


def make_broadcast(title='Hello', active=True):
    return InAppBroadcast.objects.create(title=title, body='<p>Content</p>', active=active)


class InAppBroadcastViewSetTest(APITestCase):
    def setUp(self):
        self.user = make_user()
        self.client.force_authenticate(user=self.user)

    def test_list_returns_active_unviewed_broadcasts(self):
        make_broadcast()
        r = self.client.get('/api/appcom/broadcast/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 1)

    def test_list_excludes_broadcasts_already_viewed(self):
        b = make_broadcast()
        b.viewedBy.add(self.user)
        r = self.client.get('/api/appcom/broadcast/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 0)

    def test_list_excludes_inactive_broadcasts(self):
        make_broadcast(active=False)
        r = self.client.get('/api/appcom/broadcast/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 0)

    def test_list_shows_broadcast_not_viewed_by_other_user(self):
        other_user = make_user('other@test.com')
        b = make_broadcast()
        b.viewedBy.add(other_user)  # viewed by someone else, not self.user
        r = self.client.get('/api/appcom/broadcast/')
        self.assertEqual(r.data['count'], 1)

    def test_mark_as_viewed_adds_user_to_viewedBy(self):
        b = make_broadcast()
        r = self.client.post('/api/appcom/broadcast/', {'broadcast_id': b.pk})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn(self.user, b.viewedBy.all())

    def test_mark_as_viewed_with_invalid_id_fails(self):
        r = self.client.post('/api/appcom/broadcast/', {'broadcast_id': 99999})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/appcom/broadcast/')
        self.assertEqual(r.status_code, 401)
