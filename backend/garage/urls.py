from rest_framework.routers import DefaultRouter
from .views import TaskCatalogViewSet

router = DefaultRouter()
router.register(r'task-catalog', TaskCatalogViewSet, basename='task-catalog')

urlpatterns = router.urls
