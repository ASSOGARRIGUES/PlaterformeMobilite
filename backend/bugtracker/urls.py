from django.urls import path, include
from rest_framework_nested.routers import NestedSimpleRouter

from . import views

from rest_framework import routers

router = routers.DefaultRouter()
router.register(r'bug', views.BugViewSet)

urlpatterns = [
    path('', include(router.urls)),
]