from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Action

User = get_user_model()


def make_user(email, superuser=False):
    if superuser:
        return User.objects.create_superuser(
            username=email, email=email, password='pass',
            phone='00', first_name='X', last_name='Y',
        )
    return User.objects.create_user(
        username=email, email=email, password='pass',
        phone='00', first_name='X', last_name='Y',
    )


class ActionModelTest(TestCase):
    def test_str(self):
        action = Action.objects.create(name='Garrigues')
        self.assertEqual(str(action), 'Garrigues')

    def test_get_default_creates_when_empty(self):
        Action.objects.all().delete()
        pk = Action.get_default_action_pk()
        self.assertEqual(Action.objects.get(pk=pk).name, 'Default')

    def test_get_default_returns_first_existing(self):
        Action.objects.all().delete()
        action = Action.objects.create(name='Existing')
        pk = Action.get_default_action_pk()
        self.assertEqual(pk, action.pk)
        self.assertEqual(Action.objects.count(), 1)


class UserModelTest(TestCase):
    def setUp(self):
        self.action1 = Action.objects.create(name='A1')
        self.action2 = Action.objects.create(name='A2')

    def test_get_actions_superuser_returns_all(self):
        user = make_user('su@test.com', superuser=True)
        actions = list(user.get_actions())
        self.assertIn(self.action1, actions)
        self.assertIn(self.action2, actions)

    def test_get_actions_regular_user_returns_own_only(self):
        user = make_user('u@test.com')
        user.actions.add(self.action1)
        actions = list(user.get_actions())
        self.assertIn(self.action1, actions)
        self.assertNotIn(self.action2, actions)

    def test_email_is_username_field(self):
        self.assertEqual(User.USERNAME_FIELD, 'email')
