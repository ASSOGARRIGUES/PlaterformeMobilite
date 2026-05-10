from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from bugtracker.models import Bug

User = get_user_model()


def make_user(email='u@test.com', superuser=False):
    if superuser:
        return User.objects.create_superuser(
            username=email, email=email, password='pass',
            phone='00', first_name='X', last_name='Y',
        )
    return User.objects.create_user(
        username=email, email=email, password='pass',
        phone='00', first_name='X', last_name='Y',
    )


class BugModelTest(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_save_emails_admins_on_create(self):
        Bug.objects.create(
            description='Test bug', targeted_version='1.0', reporter=self.user,
        )
        self.assertGreater(len(mail.outbox), 0)

    def test_save_emails_reporter_when_closed(self):
        bug = Bug.objects.create(
            description='Test bug', targeted_version='1.0', reporter=self.user,
        )
        mail.outbox.clear()
        bug.status = 'closed'
        bug.save()
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(bug.reporter_have_been_notified)

    def test_reporter_not_notified_twice(self):
        bug = Bug.objects.create(
            description='Test bug', targeted_version='1.0', reporter=self.user,
        )
        mail.outbox.clear()
        bug.status = 'closed'
        bug.reporter_have_been_notified = True
        bug.save()
        self.assertEqual(len(mail.outbox), 0)

    def test_no_reporter_email_when_status_is_not_closed(self):
        bug = Bug.objects.create(
            description='Test bug', targeted_version='1.0', reporter=self.user,
        )
        mail.outbox.clear()
        bug.status = 'pending'
        bug.save()
        self.assertEqual(len(mail.outbox), 0)


class BugViewSetTest(APITestCase):
    def setUp(self):
        self.user = make_user(superuser=True)
        self.client.force_authenticate(user=self.user)

    def test_create_sets_reporter_to_current_user(self):
        r = self.client.post('/api/bugtracker/bug/', {
            'description': 'Something broke',
            'targeted_version': '1.0',
            'severity': 'high',
            'type': 'bug',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        bug = Bug.objects.get(pk=r.data['id'])
        self.assertEqual(bug.reporter, self.user)

    def test_list_bugs(self):
        Bug.objects.create(
            description='Bug', targeted_version='1.0', reporter=self.user,
        )
        r = self.client.get('/api/bugtracker/bug/')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data['count'], 1)

    def test_filter_by_status(self):
        Bug.objects.create(
            description='Open bug', targeted_version='1.0',
            reporter=self.user, status='open',
        )
        Bug.objects.create(
            description='Closed bug', targeted_version='1.0',
            reporter=self.user, status='closed',
        )
        r = self.client.get('/api/bugtracker/bug/?status=open')
        self.assertEqual(r.status_code, 200)
        for bug in r.data['results']:
            self.assertEqual(bug['status'], 'open')

    def test_update_bug_status(self):
        bug = Bug.objects.create(
            description='Bug', targeted_version='1.0', reporter=self.user,
        )
        r = self.client.patch(f'/api/bugtracker/bug/{bug.pk}/', {
            'status': 'pending',
        })
        self.assertEqual(r.status_code, 200)
        bug.refresh_from_db()
        self.assertEqual(bug.status, 'pending')

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/bugtracker/bug/')
        self.assertEqual(r.status_code, 401)
