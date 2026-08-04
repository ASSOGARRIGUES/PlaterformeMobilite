from rest_framework.routers import DefaultRouter
from .views import TaskCatalogViewSet, MileageHistoryViewSet, InterventionSheetViewSet

router = DefaultRouter()
router.register(r'task-catalog', TaskCatalogViewSet, basename='task-catalog')
router.register(r'mileage/(?P<vehicle_pk>[^/.]+)', MileageHistoryViewSet, basename='vehicle-mileage')
router.register(r'intervention', InterventionSheetViewSet, basename='intervention')

urlpatterns = router.urls
