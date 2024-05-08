from datetime import datetime

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import render
from django.views import View
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from .models import Vehicle, Beneficiary, Contract
from .serializers import VehicleSerializer, BeneficiarySerializer, ContractSerializer, UserSerializer, \
    EndContractSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['brand', 'fleet_id', 'fuel_type', 'imat', 'kilometer', 'modele', 'status', 'transmission', 'type', 'year']
    filterset_fields = {
        'fleet_id': ["in", "exact"]
    }


class BeneficiaryViewSet(viewsets.ModelViewSet):
    queryset = Beneficiary.objects.all()
    serializer_class = BeneficiarySerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'postal_code']


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter,DjangoFilterBackend]
    search_fields = ['vehicle__brand', 'vehicle__modele', 'vehicle__fleet_id', 'beneficiary__first_name',
                     'beneficiary__last_name', 'start_date', 'end_date', 'referent__first_name', 'referent__last_name']
    filterset_fields = {
        'beneficiary': ["in", "exact"],
        'vehicle': ["in", "exact"],
        'referent': ["in", "exact"],
        'status': ["in", "exact"],
        'start_date': ['gte', 'lte', 'gt', 'lt'],
        'end_date': ['gte', 'lte', 'gt', 'lt']
    }

    @action(detail=True, methods=['get'])
    def get_contract_pdf(self, request, pk=None):
        contract = self.get_object()
        pdf = contract.render_contract_pdf()
        return HttpResponse(pdf, content_type='application/pdf')

    @action(detail=True, methods=['get'])
    def get_bill_pdf(self, request, pk=None):
        contract = self.get_object()
        pdf = contract.render_bill_pdf()
        return HttpResponse(pdf, content_type='application/pdf')

    @action(detail=True, methods=['get', 'patch'], serializer_class=EndContractSerializer)
    def end(self, request, pk=None):
        contract = self.get_object()
        if request.method == 'GET':
            serializer = EndContractSerializer(contract)
            print(serializer.data)
            return Response(serializer.data)
        elif request.method == 'PATCH':
            serializer = EndContractSerializer(contract, data=request.data)
            if serializer.is_valid():
                serializer.save()
                contract.status = 'over'
                contract.vehicle.kilometer = contract.end_kilometer
                contract.ended_at = datetime.now()
                contract.save()
                contract.vehicle.save()
                return Response(serializer.data, status=200)
            return Response(serializer.errors, status=400)

    @action(detail=True, methods=['post'])
    def payed(self, request, pk=None):
        contract = self.get_object()
        contract.status = 'payed'
        contract.save()
        return Response({'status': 'payed'}, status=200)


class UserViewSet(viewsets.ModelViewSet):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']


#WhoAmIViewSet is a viewset that returns the current user information using the WhoAmISerializer

class WhoAmIViewSet(viewsets.ViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer
    def list(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


