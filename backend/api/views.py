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

from .filters import VehicleFilter
from .models import Vehicle, Beneficiary, Contract, Parking
from .serializers import VehicleSerializer, BeneficiarySerializer, ContractSerializer, UserSerializer, \
    EndContractSerializer, ParkingSerializer, MutationContractSerializer, MutationVehicleSerializer

MUTATION_ACTION = ['create', 'update', 'partial_update']
RETRIEVE_ACTION = ['retrieve', 'list']

class ArchivableModelViewSet(viewsets.ModelViewSet):

    def get_queryset(self):
        #if archived is not equal to 1 in the query params, return only non archived instances
        if self.action == 'list':
            if self.request.query_params.get('archived') == '0':
                return self.queryset.filter(archived=False)
            elif self.request.query_params.get('archived') == '1':
                return self.queryset.filter(archived=True)
            elif self.request.query_params.get('archived__in'):
                query = self.request.query_params.get('archived__in')
                print("archived__in", query)
                if '0' in query and '1' in query:
                    print("both")
                    return self.queryset

            return self.queryset.filter(archived=False)
        return self.queryset

    @action(detail=True, methods=['patch'])
    def archive(self, request, pk=None):
        instance = self.get_object()
        instance.archived = True
        #Retrieve all instance relying on the current instance
        for related_instance in instance._meta.related_objects:
            related_instance = getattr(instance, related_instance.get_accessor_name())
            for related in related_instance.all():
                related.archived = True
                related.save()
        instance.save()
        return Response({'details': 'archived'}, status=200)


    @action(detail=True, methods=['patch'])
    def unarchive(self, request, pk=None):
        instance = self.get_object()
        instance.archived = False
        #Retrieve all instance relying on the current instance
        for related_instance in instance._meta.related_objects:
            related_instance = getattr(instance, related_instance.get_accessor_name())
            for related in related_instance.all():
                related.archived = False
                related.save()
        instance.save()
        return Response({'details': 'unarchived'}, status=200)

class VehicleViewSet(ArchivableModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['brand', 'fleet_id', 'fuel_type', 'imat', 'kilometer', 'modele', 'status', 'transmission', 'type', 'year', 'color']
    filterset_class = VehicleFilter

    def get_serializer_class(self):
        if self.action in MUTATION_ACTION:
            return MutationVehicleSerializer

        return super().get_serializer_class()


class BeneficiaryViewSet(ArchivableModelViewSet):
    queryset = Beneficiary.objects.all()
    serializer_class = BeneficiarySerializer
    permission_classes = (permissions.DjangoModelPermissions,)

    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'postal_code']
    filterset_fields = {
        'id': ['in', 'exact'],
        'first_name': ['in', 'exact'],
        'last_name': ['in', 'exact'],
        'email': ['in', 'exact'],
        'phone': ['in', 'exact'],
        'address': ['in', 'exact'],
        'city': ['in', 'exact'],
        'postal_code': ['in', 'exact'],
    }


class ContractViewSet(ArchivableModelViewSet):
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

    def get_serializer_class(self):
        if self.action in MUTATION_ACTION:
            return MutationContractSerializer

        return super().get_serializer_class()


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
                contract.vehicle.status = 'available'
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


class ParkingViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.DjangoModelPermissions,)
    serializer_class = ParkingSerializer
    queryset = Parking.objects.all()


