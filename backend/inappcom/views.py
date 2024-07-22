from django.db.models import Q
from django.shortcuts import render
from rest_framework import permissions, viewsets

from .models import InAppBroadcast
from .serializers import InAppBroadcastSerializer, BroadcastViewedSerializer


# Create your views here.
class InAppBroadcastViewSet(viewsets.ModelViewSet):
    queryset = InAppBroadcast.objects.all()
    serializer_class = InAppBroadcastSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return InAppBroadcast.objects.filter(~Q(viewedBy=user) & Q(active=True))

    def get_serializer_class(self):
        if self.action == 'list':
            return InAppBroadcastSerializer
        return BroadcastViewedSerializer
