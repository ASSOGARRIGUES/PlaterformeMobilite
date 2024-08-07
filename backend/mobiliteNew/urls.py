"""
URL configuration for mobiliteNew project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView
from rest_framework import permissions
from rest_framework_simplejwt import views as jwt_views

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', include('core.urls')),
    path('admin/', admin.site.urls),
    path("status/", include("health_check.urls")),
    path(r'api/', include('api.urls')),
    path(r'api/appcom/', include('inappcom.urls')),
    path('api/bugtracker/', include('bugtracker.urls')),
    path("api/api-auth", include("rest_framework.urls", namespace="rest_framework")),
    path(
        "api/token/", jwt_views.TokenObtainPairView.as_view(), name="token_obtain_pair"
    ),
    path(
        "api/token/refresh/", jwt_views.TokenRefreshView.as_view(), name="token_refresh"
    ),
    path('api-schema/', SpectacularAPIView.as_view(), name='schema'),
    path('tinymce/', include('tinymce.urls'))
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
