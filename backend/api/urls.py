from django.urls import path, include
from rest_framework_nested.routers import NestedDefaultRouter

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

router.register('contract-stats', views.ContractStatsViewSet, basename='contract-stats')
router.register('vehicle-stats', views.VehicleStatsViewSet, basename='vehicle-stats')

contract_router = NestedDefaultRouter(router, r'contract', lookup='contract')
contract_router.register(r'payment', views.PaymentViewSet, basename='contract-payment')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(contract_router.urls)),
]
