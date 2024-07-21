from django.shortcuts import render
from rest_framework import viewsets, permissions

from .models import Bug
from .serializers import BugSerializer


# Create your views here.

class BugViewSet(viewsets.ModelViewSet):
    serializer_class = BugSerializer
    permission_classes = (permissions.DjangoModelPermissions,)
    queryset = Bug.objects.all()
