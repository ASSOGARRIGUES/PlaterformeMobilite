from django.urls import path, include
from . import views

from rest_framework import routers

router = routers.DefaultRouter()
router.register('vehicle', views.VehicleViewSet)
router.register('beneficiary', views.BeneficiaryViewSet)
router.register('contract', views.ContractViewSet)
router.register('referent', views.UserViewSet)
router.register('whoami', views.WhoAmIViewSet, basename='whoami')
router.register('parking', views.ParkingViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
