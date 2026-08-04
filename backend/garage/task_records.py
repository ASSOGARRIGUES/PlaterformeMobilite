from django.db.models import DateTimeField
from django.db.models.functions import Coalesce
from .models import InterventionTask, VehicleTaskRecord


def sync_vehicle_task_record(vehicle, catalog_task):
    """Recalcule VehicleTaskRecord(vehicle, catalog_task) à partir de l'occurrence 'done' la plus
    récente parmi les fiches VALIDÉES du véhicule, triée par la même date que celle écrite
    ci-dessous (end_date, ou created_at à défaut) pour rester cohérent. Supprime l'enregistrement
    s'il n'existe plus aucune occurrence (ex: suppression de la seule tâche qui le renseignait).
    Ne concerne que les tâches ajoutées/retirées APRÈS validation (story 2.7) — la création
    initiale à la validation (InterventionSheetViewSet.validate) reste gérée séparément, inchangée."""
    if catalog_task.km_periodicity is None and catalog_task.month_periodicity is None:
        return
    latest = (
        InterventionTask.objects
        .filter(sheet__vehicle=vehicle, sheet__status='validated', type='done', catalog_task=catalog_task)
        .select_related('sheet')
        .annotate(sheet_reference_date=Coalesce('sheet__end_date', 'sheet__created_at', output_field=DateTimeField()))
        .order_by('-sheet_reference_date', '-sheet__id')
        .first()
    )
    if latest is None:
        VehicleTaskRecord.objects.filter(vehicle=vehicle, catalog_task=catalog_task).delete()
        return
    sheet = latest.sheet
    VehicleTaskRecord.objects.update_or_create(
        vehicle=vehicle, catalog_task=catalog_task,
        defaults={'date': sheet.end_date or sheet.created_at.date(), 'kilometer': sheet.start_mileage},
    )
