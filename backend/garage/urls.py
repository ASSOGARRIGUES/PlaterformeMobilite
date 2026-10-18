from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TaskCatalogViewSet, MileageHistoryViewSet, InterventionSheetViewSet, InspectionSheetViewSet, MaintenanceViewSet, GarageConfigView

router = DefaultRouter()
router.register(r'task-catalog', TaskCatalogViewSet, basename='task-catalog')
router.register(r'mileage/(?P<vehicle_pk>[^/.]+)', MileageHistoryViewSet, basename='vehicle-mileage')
router.register(r'intervention', InterventionSheetViewSet, basename='intervention')
router.register(r'inspection', InspectionSheetViewSet, basename='inspection')
router.register(r'maintenance', MaintenanceViewSet, basename='maintenance')

urlpatterns = [path('config/', GarageConfigView.as_view(), name='garage-config')] + router.urls
