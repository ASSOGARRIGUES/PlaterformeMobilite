from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from .models import AuditLog, InterventionSheet, InterventionTask, InspectionSheet, InspectionTask, InspectionDamage


def format_parts(parts):
    """Rendu lisible d'une liste de pièces pour l'historique (au lieu du repr Python brut)."""
    if not parts:
        return 'Aucune pièce'
    return ', '.join(f"{part['name']} ({part['quantity']} × {part['unit_price']} €)" for part in parts)


def format_photo_ids(photo_ids):
    if not photo_ids:
        return 'Aucune photo'
    return ', '.join(f'#{pid}' for pid in sorted(photo_ids))


def log_field_change(instance, field_name, old_value, new_value, user):
    """Ne crée une entrée que si la valeur a réellement changé (idempotent, pas de bruit)."""
    if old_value == new_value:
        return
    AuditLog.objects.create(
        author=user,
        action='field_modified',
        field_name=field_name,
        old_value='' if old_value is None else str(old_value),
        new_value='' if new_value is None else str(new_value),
        content_type=ContentType.objects.get_for_model(instance),
        object_id=instance.pk,
    )


def log_task_added(task, user):
    AuditLog.objects.create(
        author=user,
        action='task_added',
        new_value=str(task),
        content_type=ContentType.objects.get_for_model(task),
        object_id=task.pk,
    )


def log_task_deleted(task, user):
    AuditLog.objects.create(
        author=user,
        action='task_deleted',
        old_value=str(task),
        content_type=ContentType.objects.get_for_model(task),
        object_id=task.pk,
    )


def log_task_dismissed(task, user):
    AuditLog.objects.create(
        author=user,
        action='task_dismissed',
        new_value=task.catalog_task.name if task.catalog_task else task.name,
        content_type=ContentType.objects.get_for_model(task),
        object_id=task.pk,
    )


def get_audit_logs_for_sheet(sheet):
    """Union des logs de la fiche elle-même et de ses tâches actuelles (y compris tâches éditées ;
    une tâche supprimée sort de sheet.tasks, donc ses logs — y compris son propre task_deleted —
    ne remontent plus ici, cf. Dev Notes)."""
    task_ids = list(sheet.tasks.values_list('id', flat=True))
    return AuditLog.objects.filter(
        Q(content_type=ContentType.objects.get_for_model(InterventionSheet), object_id=sheet.id) |
        Q(content_type=ContentType.objects.get_for_model(InterventionTask), object_id__in=task_ids)
    ).select_related('author').order_by('-created_at')


def log_damage_added(damage, user):
    AuditLog.objects.create(
        author=user,
        action='damage_added',
        new_value=str(damage),
        content_type=ContentType.objects.get_for_model(damage),
        object_id=damage.pk,
    )


def log_damage_deleted(damage, user):
    AuditLog.objects.create(
        author=user,
        action='damage_deleted',
        old_value=str(damage),
        content_type=ContentType.objects.get_for_model(damage),
        object_id=damage.pk,
    )


def format_measurements(measurements):
    """Rendu lisible des mesures d'usure d'une fiche de contrôle pour l'historique."""
    if not measurements:
        return 'Aucune mesure'
    return ', '.join(f"{name} : {level}/10" for name, level in sorted(measurements))


def get_audit_logs_for_inspection(sheet):
    """Union des logs de la fiche de contrôle, de ses tâches et de ses dégâts actuels."""
    task_ids = list(sheet.tasks.values_list('id', flat=True))
    damage_ids = list(sheet.damages.values_list('id', flat=True))
    return AuditLog.objects.filter(
        Q(content_type=ContentType.objects.get_for_model(InspectionSheet), object_id=sheet.id) |
        Q(content_type=ContentType.objects.get_for_model(InspectionTask), object_id__in=task_ids) |
        Q(content_type=ContentType.objects.get_for_model(InspectionDamage), object_id__in=damage_ids)
    ).select_related('author').order_by('-created_at')
