"""Règles communes aux fiches d'intervention et de contrôle (kilométrage de départ, date, relevé km)."""
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from api.models import Vehicle
from .models import MileageEntry


def check_start_mileage(vehicle, start_mileage, effective_start_date):
    """Refuse un kilométrage de départ inférieur à la référence connue à cette date (story 2.9)."""
    reference = None
    if effective_start_date is not None:
        reference = (
            MileageEntry.objects
            .filter(vehicle=vehicle, date__lte=effective_start_date)
            .order_by('-date', '-id')
            .first()
        )
    if reference is not None:
        reference_km = reference.value
        reference_label = f"au kilométrage relevé le {reference.date:%d/%m/%Y}"
    else:
        reference_km = vehicle.kilometer
        reference_label = "au kilométrage actuel du véhicule"
    if start_mileage < reference_km:
        raise serializers.ValidationError({
            'start_mileage': f"Le kilométrage ({start_mileage}) ne peut pas être inférieur "
                              f"{reference_label} ({reference_km})."
        })


def check_start_date_not_future(start_date):
    if start_date is not None and start_date > timezone.localdate():
        raise serializers.ValidationError({
            'start_date': "La date de début ne peut pas être postérieure à aujourd'hui."
        })


def create_sheet_mileage_entry(sheet, source, user):
    """Crée le relevé km d'une fiche validée et renvoie la liste d'avertissements (non bloquants).

    Le kilométrage saisi est celui à l'entrée du véhicule : le relevé est daté à la date de début
    (et non de fin), sans quoi une fiche antidatée serait datée d'aujourd'hui et ferait reculer
    Vehicle.kilometer.
    """
    mileage_date = sheet.start_date
    mileage_entry = MileageEntry.objects.create(
        vehicle=sheet.vehicle,
        value=sheet.start_mileage,
        date=mileage_date,
        source=source,
        source_id=sheet.id,
        author=user,
    )

    more_recent_entry = (
        MileageEntry.objects
        .filter(vehicle=sheet.vehicle)
        .exclude(pk=mileage_entry.pk)
        .order_by('-date', '-id')
        .first()
    )
    warnings = []
    if more_recent_entry and (more_recent_entry.date, more_recent_entry.id) > (mileage_date, mileage_entry.id):
        warnings.append({
            'code': 'mileage_not_applied',
            'message': f"Le kilométrage du véhicule n'a pas été mis à jour : une saisie plus récente "
                       f"({more_recent_entry.value} km au {more_recent_entry.date:%d/%m/%Y}) existe déjà. "
                       f"Si l'une des deux valeurs est erronée, corrigez-la depuis l'historique kilométrique "
                       f"du véhicule.",
            'more_recent_entry': {
                'value': more_recent_entry.value,
                'date': more_recent_entry.date.isoformat(),
            },
        })
    return warnings


def sync_sheet_mileage_date(sheet, source):
    """Reporte un changement de `start_date` d'une fiche validée sur son relevé km (et ses corrections)."""
    with transaction.atomic():
        entry = MileageEntry.objects.filter(source=source, source_id=sheet.id, corrects__isnull=True).first()
        if entry is None:
            return
        chain = [entry]
        while True:
            correction = MileageEntry.objects.filter(corrects=chain[-1]).first()
            if correction is None:
                break
            chain.append(correction)
        MileageEntry.objects.filter(pk__in=[e.pk for e in chain]).update(date=sheet.start_date)
        latest = MileageEntry.objects.filter(
            vehicle=sheet.vehicle, is_corrected=False
        ).order_by('-date', '-id').first()
        if latest:
            Vehicle.objects.filter(pk=sheet.vehicle_id).update(kilometer=latest.value)
