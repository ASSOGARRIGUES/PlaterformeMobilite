from django.urls import path, include
from rest_framework_nested.routers import NestedSimpleRouter

from . import views

from rest_framework import routers

router = routers.DefaultRouter()
router.register('vehicle', views.VehicleViewSet)
router.register('beneficiary', views.BeneficiaryViewSet)
router.register('contract', views.ContractViewSet)
router.register('referent', views.UserViewSet)
router.register('whoami', views.WhoAmIViewSet, basename='whoami')
router.register('parking', views.ParkingViewSet)
router.register('user-actions', views.UserActionViewSet, basename='user_actions')

contract_router = NestedSimpleRouter(router, r'contract', lookup='contract')
contract_router.register(r'payment', views.PaymentViewSet, basename='contract-payment')

urlpatterns = [
    path('', include(router.urls)),
    path(r'', include(contract_router.urls)),
]
