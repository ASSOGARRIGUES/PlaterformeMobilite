from django.urls import path, include
from . import views

from rest_framework import routers

router = routers.DefaultRouter()
router.register('vehicle', views.VehicleViewSet)
router.register('beneficiary', views.BeneficiaryViewSet)
router.register('contract', views.ContractViewSet)
router.register('user', views.UserViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
