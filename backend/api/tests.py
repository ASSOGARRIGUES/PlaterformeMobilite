from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Action
from api.models import Beneficiary, Contract, Parking, Payment, PaymentMode, Vehicle

User = get_user_model()


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_action(name='TestAction'):
    return Action.objects.create(name=name)


def make_parking(name='Parking', action=None):
    p = Parking.objects.create(name=name)
    if action:
        p.actions.add(action)
    return p


def make_user(email='user@test.com', action=None, superuser=False, perms=()):
    if superuser:
        user = User.objects.create_superuser(
            username=email, email=email, password='pass',
            phone='0600000000', first_name='First', last_name='Last',
        )
    else:
        user = User.objects.create_user(
            username=email, email=email, password='pass',
            phone='0600000000', first_name='First', last_name='Last',
        )
    if action:
        user.actions.add(action)
        user.current_action = action
        user.save()
    for codename in perms:
        user.user_permissions.add(Permission.objects.get(codename=codename))
    return user


def make_vehicle(action, parking, vehicle_status='available', fleet_id=1, kilometer=10000):
    return Vehicle.objects.create(
        brand='Renault', modele='Clio', year=2020, imat='AA-000-AA',
        fleet_id=fleet_id, kilometer=kilometer, status=vehicle_status,
        parking=parking, action=action,
        fuel_type='essence', transmission='manuelle', type='voiture',
    )


def make_beneficiary(action, email='jean@test.com'):
    return Beneficiary.objects.create(
        first_name='Jean', last_name='Dupont', phone='0600000000',
        address='1 rue Test', email=email,
        city='Paris', postal_code='75001', action=action,
    )


def make_contract(vehicle, beneficiary, referent, action,
                  price=500, discount=0, deposit=100, contract_status='pending'):
    return Contract.objects.create(
        vehicle=vehicle, beneficiary=beneficiary,
        start_date=date.today(), end_date=date.today() + timedelta(days=30),
        price=price, discount=discount, deposit=deposit,
        start_kilometer=vehicle.kilometer,
        referent=referent, action=action, status=contract_status,
    )


def make_payment(contract, amount=100, user=None):
    return Payment.objects.create(
        contract=contract, amount=amount,
        mode=PaymentMode.CASH, created_by=user,
    )


# ── Model tests ───────────────────────────────────────────────────────────────

class ParkingModelTest(TestCase):
    def test_get_default_creates_when_empty(self):
        Parking.objects.all().delete()
        Action.objects.all().delete()
        pk = Parking.get_default_parking_pk()
        self.assertTrue(Parking.objects.filter(pk=pk).exists())
        self.assertEqual(Parking.objects.get(pk=pk).name, 'Défaut')

    def test_get_default_returns_first_existing(self):
        Parking.objects.all().delete()
        p = Parking.objects.create(name='Existing')
        pk = Parking.get_default_parking_pk()
        self.assertEqual(pk, p.pk)
        self.assertEqual(Parking.objects.count(), 1)

    def test_str(self):
        p = Parking.objects.create(name='Garrigues HQ')
        self.assertEqual(str(p), 'Garrigues HQ')


class ContractModelTest(TestCase):
    def setUp(self):
        self.action = make_action()
        self.parking = make_parking(action=self.action)
        self.user = make_user(action=self.action)
        self.vehicle = make_vehicle(self.action, self.parking)
        self.beneficiary = make_beneficiary(self.action)
        self.contract = make_contract(
            self.vehicle, self.beneficiary, self.user, self.action,
            price=300, contract_status='over',
        )

    def test_str(self):
        self.assertEqual(str(self.contract), 'Renault Clio Dupont')

    def test_update_if_paid_respects_discount(self):
        v2 = make_vehicle(self.action, self.parking, fleet_id=99)
        b2 = make_beneficiary(self.action, email='b2@test.com')
        contract = make_contract(v2, b2, self.user, self.action,
                                 price=300, discount=100, contract_status='over')
        make_payment(contract, amount=200)  # 200 >= 300-100
        contract.updateIfPaid()
        contract.refresh_from_db()
        self.assertEqual(contract.status, 'payed')

    def test_get_payments_sum_no_payments(self):
        self.assertEqual(self.contract.getPaymentsSum(), 0)

    def test_get_payments_sum_aggregates_all_payments(self):
        make_payment(self.contract, amount=100)
        make_payment(self.contract, amount=50)
        self.assertEqual(self.contract.getPaymentsSum(), 150)

    def test_update_if_paid_transitions_to_payed(self):
        make_payment(self.contract, amount=300)
        self.contract.updateIfPaid()
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'payed')

    def test_update_if_paid_reverts_to_over_when_underpaid(self):
        self.contract.status = 'payed'
        self.contract.save()
        # No payments → sum < price → revert
        self.contract.updateIfPaid()
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'over')

    def test_update_if_paid_ignores_non_over_contracts(self):
        self.contract.status = 'pending'
        self.contract.save()
        make_payment(self.contract, amount=300)
        self.contract.updateIfPaid()
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'pending')

    def test_update_if_paid_no_change_when_partially_paid(self):
        make_payment(self.contract, amount=100)  # 100 < 300
        self.contract.updateIfPaid()
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'over')


class PaymentModelTest(TestCase):
    def setUp(self):
        self.action = make_action()
        self.parking = make_parking(action=self.action)
        self.user = make_user(action=self.action)
        self.vehicle = make_vehicle(self.action, self.parking)
        self.beneficiary = make_beneficiary(self.action)
        self.contract = make_contract(
            self.vehicle, self.beneficiary, self.user, self.action,
        )

    def test_editable_true_for_latest_payment(self):
        p = make_payment(self.contract, amount=50)
        self.assertTrue(p.editable)

    def test_editable_false_when_newer_payment_exists(self):
        p1 = make_payment(self.contract, amount=50)
        Payment.objects.filter(pk=p1.pk).update(
            created_at=timezone.now() - timedelta(seconds=10)
        )
        p1.refresh_from_db()
        make_payment(self.contract, amount=50)
        self.assertFalse(p1.editable)

    def test_editable_false_on_archived_contract(self):
        p = make_payment(self.contract, amount=50)
        self.contract.archived = True
        self.contract.save()
        self.assertFalse(p.editable)

    def test_mode_display_returns_french_label(self):
        p = make_payment(self.contract, amount=50)
        self.assertEqual(p.mode_display, 'Espèces')


# ── Shared API base ───────────────────────────────────────────────────────────

class BaseAPITest(APITestCase):
    def setUp(self):
        self.action = make_action('TestAction')
        self.parking = make_parking('TestParking', action=self.action)
        self.user = make_user('user@test.com', action=self.action, superuser=True)
        self.client.force_authenticate(user=self.user)
        self._vehicle_counter = 0
        self._beneficiary_counter = 0

    def new_vehicle(self, **kwargs):
        self._vehicle_counter += 1
        return make_vehicle(self.action, self.parking,
                            fleet_id=self._vehicle_counter, **kwargs)

    def new_beneficiary(self):
        self._beneficiary_counter += 1
        return make_beneficiary(
            self.action,
            email=f'person{self._beneficiary_counter}@test.com',
        )

    def new_contract(self, **kwargs):
        vehicle = kwargs.pop('vehicle', self.new_vehicle())
        beneficiary = kwargs.pop('beneficiary', self.new_beneficiary())
        return make_contract(vehicle, beneficiary, self.user, self.action, **kwargs)


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthTest(APITestCase):
    def test_unauthenticated_vehicle_list_returns_401(self):
        self.assertEqual(self.client.get('/api/vehicle/').status_code, 401)

    def test_unauthenticated_beneficiary_list_returns_401(self):
        self.assertEqual(self.client.get('/api/beneficiary/').status_code, 401)

    def test_unauthenticated_contract_list_returns_401(self):
        self.assertEqual(self.client.get('/api/contract/').status_code, 401)

    def test_unauthenticated_whoami_returns_401(self):
        self.assertEqual(self.client.get('/api/whoami/').status_code, 401)


# ── Vehicle ───────────────────────────────────────────────────────────────────

class VehicleViewSetTest(BaseAPITest):
    def test_list_scoped_to_current_action(self):
        other_action = make_action('OtherAction')
        other_parking = make_parking('OtherParking', action=other_action)
        self.new_vehicle()  # belongs to self.action
        make_vehicle(other_action, other_parking, fleet_id=99)
        r = self.client.get('/api/vehicle/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 1)

    def test_create_sets_action_from_current_user(self):
        r = self.client.post('/api/vehicle/', {
            'brand': 'Peugeot', 'modele': '208', 'year': 2021,
            'imat': 'BB-111-BB', 'fleet_id': 10, 'kilometer': 5000,
            'fuel_type': 'diesel', 'transmission': 'manuelle', 'type': 'voiture',
            'parking': self.parking.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Vehicle.objects.get(fleet_id=10).action, self.action)

    def test_list_excludes_archived_by_default(self):
        active = self.new_vehicle()
        archived = self.new_vehicle()
        archived.archived = True
        archived.save()
        r = self.client.get('/api/vehicle/')
        ids = [v['id'] for v in r.data['results']]
        self.assertIn(active.pk, ids)
        self.assertNotIn(archived.pk, ids)

    def test_get_archived_lists_archived(self):
        v = self.new_vehicle()
        v.archived = True
        v.save()
        r = self.client.get('/api/vehicle/get_archived/')
        ids = [item['id'] for item in r.data]
        self.assertIn(v.pk, ids)

    def test_archive_fails_when_rented(self):
        v = self.new_vehicle(vehicle_status='rented')
        r = self.client.patch(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 400)

    def test_archive_fails_when_unpaid_contract_exists(self):
        v = self.new_vehicle()
        b = self.new_beneficiary()
        make_contract(v, b, self.user, self.action, contract_status='pending')
        r = self.client.patch(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 400)

    def test_archive_succeeds_for_available_vehicle_with_no_contracts(self):
        v = self.new_vehicle()
        r = self.client.patch(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        v.refresh_from_db()
        self.assertTrue(v.archived)

    def test_archive_succeeds_when_all_contracts_paid(self):
        v = self.new_vehicle()
        b = self.new_beneficiary()
        make_contract(v, b, self.user, self.action, contract_status='payed')
        r = self.client.patch(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 200)

    def test_archive_fails_if_already_archived(self):
        v = self.new_vehicle()
        v.archived = True
        v.save()
        r = self.client.patch(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 400)

    def test_unarchive_sets_archived_to_false(self):
        v = self.new_vehicle()
        v.archived = True
        v.save()
        r = self.client.patch(f'/api/vehicle/{v.pk}/unarchive/')
        self.assertEqual(r.status_code, 200)
        v.refresh_from_db()
        self.assertFalse(v.archived)

    def test_action_transfer_requires_can_transfer_permission(self):
        user = make_user('noperm@test.com', action=self.action,
                         perms=['add_vehicle'])
        self.client.force_authenticate(user=user)
        v = self.new_vehicle()
        other_action = make_action('OtherAction2')
        r = self.client.post(f'/api/vehicle/{v.pk}/action_transfer/',
                             {'action': other_action.pk})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['error'], 'no_permission')

    def test_action_transfer_moves_vehicle_to_new_action(self):
        perm = Permission.objects.get(codename='can_transfer_vehicle')
        self.user.user_permissions.add(perm)
        self.user = User.objects.get(pk=self.user.pk)  # clear perm cache
        self.client.force_authenticate(user=self.user)

        other_action = make_action('OtherAction')
        other_parking = make_parking('OtherParking', action=other_action)
        self.user.actions.add(other_action)
        v = self.new_vehicle()
        r = self.client.post(f'/api/vehicle/{v.pk}/action_transfer/', {
            'action': other_action.pk,
            'parking': other_parking.pk,
        })
        self.assertEqual(r.status_code, 200)
        v.refresh_from_db()
        self.assertEqual(v.action, other_action)
        self.assertEqual(v.parking, other_parking)

    def test_action_transfer_rejects_rented_vehicle(self):
        perm = Permission.objects.get(codename='can_transfer_vehicle')
        self.user.user_permissions.add(perm)
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)

        other_action = make_action('OtherAction3')
        other_parking = make_parking('OtherParking3', action=other_action)
        self.user.actions.add(other_action)
        v = self.new_vehicle(vehicle_status='rented')
        r = self.client.post(f'/api/vehicle/{v.pk}/action_transfer/', {
            'action': other_action.pk,
            'parking': other_parking.pk,
        })
        self.assertEqual(r.status_code, 400)

    def test_archive_get_returns_can_archive_true(self):
        v = self.new_vehicle()
        r = self.client.get(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['can_archive'])

    def test_archive_get_returns_can_archive_false_when_rented(self):
        v = self.new_vehicle(vehicle_status='rented')
        r = self.client.get(f'/api/vehicle/{v.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['can_archive'])

    def test_get_all_ids_returns_paginated_list(self):
        v = self.new_vehicle()
        r = self.client.get('/api/vehicle/get_all_ids/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('results', r.data)
        fleet_ids = [item['fleet_id'] for item in r.data['results']]
        self.assertIn(v.fleet_id, fleet_ids)

    def test_action_transfer_to_same_action_fails(self):
        perm = Permission.objects.get(codename='can_transfer_vehicle')
        self.user.user_permissions.add(perm)
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)
        v = self.new_vehicle()
        r = self.client.post(f'/api/vehicle/{v.pk}/action_transfer/', {
            'action': self.action.pk,
        })
        self.assertEqual(r.status_code, 400)

    def test_action_transfer_parking_not_in_target_action_fails(self):
        perm = Permission.objects.get(codename='can_transfer_vehicle')
        self.user.user_permissions.add(perm)
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)
        other_action = make_action('TargetAction')
        v = self.new_vehicle()
        r = self.client.post(f'/api/vehicle/{v.pk}/action_transfer/', {
            'action': other_action.pk,
            'parking': self.parking.pk,  # parking is in self.action, not other_action
        })
        self.assertEqual(r.status_code, 400)

    def test_vehicle_stats_returns_correct_counts(self):
        make_vehicle(self.action, self.parking, fleet_id=10, vehicle_status='available')
        make_vehicle(self.action, self.parking, fleet_id=11, vehicle_status='rented')
        make_vehicle(self.action, self.parking, fleet_id=12, vehicle_status='maintenance')
        r = self.client.get('/api/vehicle-stats/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['total'], 3)
        self.assertEqual(r.data['available'], 1)
        self.assertEqual(r.data['rented'], 1)
        self.assertEqual(r.data['maintenance'], 1)


# ── Beneficiary ───────────────────────────────────────────────────────────────

class BeneficiaryViewSetTest(BaseAPITest):
    def test_list_scoped_to_current_action(self):
        other_action = make_action('Other')
        make_beneficiary(self.action, email='mine@test.com')
        make_beneficiary(other_action, email='other@test.com')
        r = self.client.get('/api/beneficiary/')
        self.assertEqual(r.status_code, 200)
        emails = [b['email'] for b in r.data['results']]
        self.assertIn('mine@test.com', emails)
        self.assertNotIn('other@test.com', emails)

    def test_create_sets_action_from_current_user(self):
        r = self.client.post('/api/beneficiary/', {
            'first_name': 'Marie', 'last_name': 'Martin',
            'phone': '0611111111', 'address': '2 rue Test',
            'email': 'marie@test.com', 'city': 'Paris', 'postal_code': '75002',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Beneficiary.objects.get(email='marie@test.com').action, self.action)

    def test_archive_fails_with_unpaid_contract(self):
        b = self.new_beneficiary()
        v = self.new_vehicle()
        make_contract(v, b, self.user, self.action, contract_status='pending')
        r = self.client.patch(f'/api/beneficiary/{b.pk}/archive/')
        self.assertEqual(r.status_code, 400)

    def test_archive_succeeds_with_no_active_contracts(self):
        b = self.new_beneficiary()
        r = self.client.patch(f'/api/beneficiary/{b.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        b.refresh_from_db()
        self.assertTrue(b.archived)

    def test_archive_succeeds_when_contracts_are_paid(self):
        b = self.new_beneficiary()
        v = self.new_vehicle()
        make_contract(v, b, self.user, self.action, contract_status='payed')
        r = self.client.patch(f'/api/beneficiary/{b.pk}/archive/')
        self.assertEqual(r.status_code, 200)

    def test_unarchive(self):
        b = self.new_beneficiary()
        b.archived = True
        b.save()
        r = self.client.patch(f'/api/beneficiary/{b.pk}/unarchive/')
        self.assertEqual(r.status_code, 200)
        b.refresh_from_db()
        self.assertFalse(b.archived)

    def test_get_archived_lists_archived_beneficiaries(self):
        b = self.new_beneficiary()
        b.archived = True
        b.save()
        r = self.client.get('/api/beneficiary/get_archived/')
        self.assertEqual(r.status_code, 200)
        emails = [item['email'] for item in r.data]
        self.assertIn(b.email, emails)

    def test_archive_cascades_to_contracts(self):
        b = self.new_beneficiary()
        v = self.new_vehicle()
        contract = make_contract(v, b, self.user, self.action, contract_status='payed')
        r = self.client.patch(f'/api/beneficiary/{b.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        contract.refresh_from_db()
        self.assertTrue(contract.archived)


# ── Contract ──────────────────────────────────────────────────────────────────

class ContractViewSetTest(BaseAPITest):
    def _payload(self, vehicle, beneficiary):
        return {
            'vehicle': vehicle.pk,
            'beneficiary': beneficiary.pk,
            'referent': self.user.pk,
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=30)),
            'price': 500,
            'deposit': 100,
            'depositPaymentMode': 'cash',
            'status': 'pending',
        }

    def test_create_sets_vehicle_status_to_rented(self):
        v = self.new_vehicle()
        b = self.new_beneficiary()
        r = self.client.post('/api/contract/', self._payload(v, b))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        v.refresh_from_db()
        self.assertEqual(v.status, 'rented')

    def test_create_sets_start_kilometer_from_vehicle(self):
        v = self.new_vehicle(kilometer=12345)
        b = self.new_beneficiary()
        r = self.client.post('/api/contract/', self._payload(v, b))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        c = Contract.objects.get(pk=r.data['id'])
        self.assertEqual(c.start_kilometer, 12345)

    def test_create_fails_if_vehicle_not_available(self):
        v = self.new_vehicle(vehicle_status='rented')
        b = self.new_beneficiary()
        r = self.client.post('/api/contract/', self._payload(v, b))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fails_if_referent_not_in_current_action(self):
        other_action = make_action('Other')
        other_user = make_user('other@test.com', action=other_action)
        v = self.new_vehicle()
        b = self.new_beneficiary()
        payload = self._payload(v, b)
        payload['referent'] = other_user.pk
        r = self.client.post('/api/contract/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_within_15_minutes_succeeds(self):
        v = self.new_vehicle()
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action)
        r = self.client.delete(f'/api/contract/{c.pk}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_after_15_minutes_is_forbidden(self):
        v = self.new_vehicle()
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action)
        Contract.objects.filter(pk=c.pk).update(
            created_at=timezone.now() - timedelta(minutes=20)
        )
        r = self.client.delete(f'/api/contract/{c.pk}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_restores_vehicle_to_available(self):
        v = self.new_vehicle(vehicle_status='rented')
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action)
        self.client.delete(f'/api/contract/{c.pk}/')
        v.refresh_from_db()
        self.assertEqual(v.status, 'available')

    def test_archive_fails_if_not_paid(self):
        c = self.new_contract(contract_status='pending')
        r = self.client.patch(f'/api/contract/{c.pk}/archive/')
        self.assertEqual(r.status_code, 400)

    def test_archive_succeeds_if_paid(self):
        c = self.new_contract(contract_status='payed')
        r = self.client.patch(f'/api/contract/{c.pk}/archive/')
        self.assertEqual(r.status_code, 200)
        c.refresh_from_db()
        self.assertTrue(c.archived)

    def test_list_excludes_archived_by_default(self):
        active = self.new_contract()
        archived = self.new_contract()
        archived.archived = True
        archived.save()
        r = self.client.get('/api/contract/')
        ids = [c['id'] for c in r.data['results']]
        self.assertIn(active.pk, ids)
        self.assertNotIn(archived.pk, ids)

    def test_end_get_returns_current_data(self):
        c = self.new_contract()
        r = self.client.get(f'/api/contract/{c.pk}/end/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('start_kilometer', r.data)
        self.assertIn('vehicle_kilometer', r.data)

    def test_end_patch_sets_status_to_over_and_updates_vehicle(self):
        v = self.new_vehicle(kilometer=10000)
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action, price=500)
        r = self.client.patch(f'/api/contract/{c.pk}/end/', {
            'end_kilometer': 11000, 'price': 500, 'deposit': 100, 'discount': 0,
        })
        self.assertEqual(r.status_code, 200)
        c.refresh_from_db()
        self.assertEqual(c.status, 'over')
        v.refresh_from_db()
        self.assertEqual(v.kilometer, 11000)
        self.assertEqual(v.status, 'available')

    def test_end_patch_rejects_end_km_below_start_km(self):
        v = self.new_vehicle(kilometer=10000)
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action)
        r = self.client.patch(f'/api/contract/{c.pk}/end/', {
            'end_kilometer': 9000, 'price': 500, 'deposit': 100, 'discount': 0,
        })
        self.assertEqual(r.status_code, 400)

    def test_list_scoped_to_current_action(self):
        other_action = make_action('Other')
        other_parking = make_parking('OtherP', action=other_action)
        other_user = make_user('other@test.com', action=other_action)
        other_vehicle = make_vehicle(other_action, other_parking, fleet_id=50)
        other_beneficiary = make_beneficiary(other_action, email='ob@test.com')
        other_contract = make_contract(other_vehicle, other_beneficiary,
                                       other_user, other_action)
        my_contract = self.new_contract()
        r = self.client.get('/api/contract/')
        ids = [c['id'] for c in r.data['results']]
        self.assertIn(my_contract.pk, ids)
        self.assertNotIn(other_contract.pk, ids)

    def test_contract_stats_returns_counts(self):
        self.new_contract(contract_status='pending')
        self.new_contract(contract_status='waiting')
        self.new_contract(contract_status='payed')
        r = self.client.get('/api/contract-stats/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['current']['pending'], 1)
        self.assertEqual(r.data['current']['waiting'], 1)
        self.assertEqual(r.data['current']['payed'], 1)
        self.assertEqual(r.data['current']['total'], 3)

    def test_end_patch_rejects_end_km_below_vehicle_km(self):
        v = self.new_vehicle(kilometer=10000)
        b = self.new_beneficiary()
        c = make_contract(v, b, self.user, self.action)
        # Simulate vehicle km updated externally above the proposed end_km
        Vehicle.objects.filter(pk=v.pk).update(kilometer=12000)
        r = self.client.patch(f'/api/contract/{c.pk}/end/', {
            'end_kilometer': 11000, 'price': 500, 'deposit': 100, 'discount': 0,
        })
        self.assertEqual(r.status_code, 400)

    def test_contract_stats_includes_archived_section(self):
        c = self.new_contract(contract_status='payed')
        c.archived = True
        c.save()
        r = self.client.get('/api/contract-stats/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('archived', r.data)
        self.assertEqual(r.data['archived']['total'], 1)
        self.assertEqual(r.data['archived']['payed'], 1)
        self.assertEqual(r.data['archived']['not_payed'], 0)

    def test_contract_stats_ongoing_grouped(self):
        v1 = make_vehicle(self.action, self.parking, fleet_id=20)
        v2 = make_vehicle(self.action, self.parking, fleet_id=21)
        b = self.new_beneficiary()
        make_contract(v1, b, self.user, self.action, contract_status='pending')
        make_contract(v2, b, self.user, self.action, contract_status='waiting')
        r = self.client.post('/api/contract-stats/ongoing_grouped/',
                             [{'referents': [self.user.pk], 'id': 1}],
                             format='json')
        self.assertEqual(r.status_code, 200)
        # r.data keeps the raw Python dict — integer key 1, not string '1'
        self.assertEqual(r.data[1], 2)


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentViewSetTest(BaseAPITest):
    def setUp(self):
        super().setUp()
        v = self.new_vehicle()
        b = self.new_beneficiary()
        self.contract = make_contract(
            v, b, self.user, self.action, price=500, contract_status='over',
        )
        self.url = f'/api/contract/{self.contract.pk}/payment/'

    def test_create_payment(self):
        r = self.client.post(self.url, {'amount': 100, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Payment.objects.filter(contract=self.contract).count(), 1)

    def test_create_sets_created_by_to_current_user(self):
        r = self.client.post(self.url, {'amount': 100, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        payment = Payment.objects.get(pk=r.data['id'])
        self.assertEqual(payment.created_by, self.user)

    def test_create_rejects_zero_amount(self):
        r = self.client.post(self.url, {'amount': 0, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_negative_amount(self):
        r = self.client.post(self.url, {'amount': -50, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_amount_exceeding_price(self):
        r = self.client.post(self.url, {'amount': 600, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_when_total_would_exceed_price(self):
        make_payment(self.contract, amount=400)
        r = self.client.post(self.url, {'amount': 200, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fails_on_archived_contract(self):
        self.contract.archived = True
        self.contract.save()
        r = self.client.post(self.url, {'amount': 100, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fails_on_already_paid_contract(self):
        self.contract.status = 'payed'
        self.contract.save()
        r = self.client.post(self.url, {'amount': 100, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_payment_transitions_contract_to_payed(self):
        r = self.client.post(self.url, {'amount': 500, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'payed')

    def test_delete_latest_payment_succeeds(self):
        p = make_payment(self.contract, amount=100)
        r = self.client.delete(f'{self.url}{p.pk}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_non_latest_payment_fails(self):
        p1 = make_payment(self.contract, amount=100)
        Payment.objects.filter(pk=p1.pk).update(
            created_at=timezone.now() - timedelta(seconds=10)
        )
        make_payment(self.contract, amount=50)
        r = self.client.delete(f'{self.url}{p1.pk}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_summary_returns_correct_aggregates(self):
        make_payment(self.contract, amount=200)
        make_payment(self.contract, amount=100)
        r = self.client.get(f'{self.url}summary/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['payments_sum'], 300)
        self.assertEqual(r.data['total_due'], 500)
        self.assertEqual(r.data['nb_payments'], 2)
        self.assertFalse(r.data['is_payed'])

    def test_summary_is_payed_true_when_fully_paid(self):
        self.contract.status = 'payed'
        self.contract.save()
        r = self.client.get(f'{self.url}summary/')
        self.assertTrue(r.data['is_payed'])

    def test_update_payment_amount(self):
        p = make_payment(self.contract, amount=100)
        r = self.client.patch(f'{self.url}{p.pk}/', {'amount': 150, 'mode': 'cash'})
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.amount, 150)

    def test_update_rejects_total_exceeding_price(self):
        p = make_payment(self.contract, amount=100)
        r = self.client.patch(f'{self.url}{p.pk}/', {'amount': 600, 'mode': 'cash'})
        self.assertEqual(r.status_code, 400)

    def test_delete_payment_reverts_contract_to_over(self):
        r = self.client.post(self.url, {'amount': 500, 'mode': 'cash'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'payed')
        r2 = self.client.delete(f'{self.url}{r.data["id"]}/')
        self.assertEqual(r2.status_code, status.HTTP_204_NO_CONTENT)
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'over')

    def test_list_payments_for_contract(self):
        make_payment(self.contract, amount=100)
        make_payment(self.contract, amount=50)
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 2)


# ── WhoAmI / UserAction ───────────────────────────────────────────────────────

class WhoAmITest(BaseAPITest):
    def test_returns_current_user_email(self):
        r = self.client.get('/api/whoami/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['email'], self.user.email)

    def test_includes_is_superuser_flag(self):
        r = self.client.get('/api/whoami/')
        self.assertTrue(r.data['is_superuser'])


class UserActionViewSetTest(BaseAPITest):
    def test_list_returns_current_action(self):
        r = self.client.get('/api/user-actions/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['current_action']['id'], self.action.pk)

    def test_create_updates_current_action(self):
        new_action = make_action('NewAction')
        self.user.actions.add(new_action)
        r = self.client.post('/api/user-actions/', {'current_action': new_action.pk})
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_action, new_action)

    def test_superuser_sees_all_actions_in_list(self):
        other_action = make_action('OtherAction')
        r = self.client.get('/api/user-actions/')
        action_ids = [a['id'] for a in r.data['actions']]
        self.assertIn(self.action.pk, action_ids)
        self.assertIn(other_action.pk, action_ids)


# ── Parking ───────────────────────────────────────────────────────────────────

class ParkingViewSetTest(BaseAPITest):
    def test_list_returns_parking(self):
        r = self.client.get('/api/parking/')
        self.assertEqual(r.status_code, 200)
        names = [p['name'] for p in r.data['results']]
        self.assertIn('TestParking', names)

    def test_create_parking(self):
        r = self.client.post('/api/parking/', {
            'name': 'New Parking',
            'actions': [self.action.pk],
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Parking.objects.filter(name='New Parking').exists())

    def test_filter_by_action(self):
        other_parking = make_parking('UnrelatedParking')
        r = self.client.get(f'/api/parking/?actions={self.action.pk}')
        self.assertEqual(r.status_code, 200)
        names = [p['name'] for p in r.data['results']]
        self.assertIn('TestParking', names)
        self.assertNotIn('UnrelatedParking', names)


# ── Referent (User) ───────────────────────────────────────────────────────────

class ReferentViewSetTest(BaseAPITest):
    def test_list_returns_users(self):
        r = self.client.get('/api/referent/')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data['count'], 1)
        emails = [u['email'] for u in r.data['results']]
        self.assertIn(self.user.email, emails)

    def test_filter_by_action(self):
        other_action = make_action('UserFilterAction')
        other_user = make_user('other_ref@test.com', action=other_action)
        r = self.client.get(f'/api/referent/?actions={self.action.pk}')
        self.assertEqual(r.status_code, 200)
        emails = [u['email'] for u in r.data['results']]
        self.assertIn(self.user.email, emails)
        self.assertNotIn(other_user.email, emails)

    def test_search_by_email(self):
        r = self.client.get(f'/api/referent/?search={self.user.email}')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data['count'], 1)
        emails = [u['email'] for u in r.data['results']]
        self.assertIn(self.user.email, emails)
