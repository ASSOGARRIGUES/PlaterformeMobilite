import re
from django.utils import timezone
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


# ── Lecture de l'audit par un responsable (admin Django) ──────────────────────

AUDIT_ACTION_LABELS = {
    'field_modified': 'Modification',
    'task_added': "Ajout d'une tâche",
    'task_deleted': "Suppression d'une tâche",
    'task_dismissed': "Écartement d'une tâche",
    'damage_added': "Ajout d'un dégât",
    'damage_deleted': "Suppression d'un dégât",
}

AUDIT_FIELD_LABELS = {
    'start_date': 'Date de début',
    'oil_ok': "Niveau d'huile",
    'coolant_ok': 'Niveau de refroidissement',
    'washer_ok': 'Niveau de lave-glace',
    'lights_ok': 'Éclairage',
    'lights_notes': "Notes d'éclairage",
    'road_test_done': 'Essai routier',
    'road_test_notes': "Observations de l'essai",
    'wear_measurements': 'Usure',
    'photos': 'Photos',
    'name': 'Nom',
    'description': 'Description',
    'wear_level': "Niveau d'usure",
    'parts': 'Pièces',
}

_OK_DEFECT = {'True': 'OK', 'False': 'Défaut', '': 'Non vérifié'}
_DONE_NOT_DONE = {'True': 'Réalisé', 'False': 'Non réalisé', '': 'Non renseigné'}
_BOOLEAN_FIELD_LABELS = {
    'oil_ok': _OK_DEFECT, 'coolant_ok': _OK_DEFECT, 'washer_ok': _OK_DEFECT, 'lights_ok': _OK_DEFECT,
    'road_test_done': _DONE_NOT_DONE,
}
_ISO_DATE = re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')


def format_audit_value(field_name, value):
    """Valeur brute stockée (texte) -> libellé clair : « OK », « Défaut », « 3 photos », « 03/10/2026 »…"""
    if field_name in _BOOLEAN_FIELD_LABELS:
        return _BOOLEAN_FIELD_LABELS[field_name].get(value, value)
    if field_name == 'photos':
        count = 0 if value in ('', 'Aucune photo') else len(value.split(','))
        return f"{count} photo{'s' if count > 1 else ''}"
    if field_name == 'wear_level':
        return f"{value}/10" if value != '' else 'Non renseigné'
    iso = _ISO_DATE.match(value)
    if iso:
        return f"{iso.group(3)}/{iso.group(2)}/{iso.group(1)}"
    return value if value != '' else 'vide'


def _sheet_of(obj):
    if isinstance(obj, (InterventionSheet, InspectionSheet)):
        return obj
    return getattr(obj, 'sheet', None)


def describe_audit_entry(entry):
    """Traduit une entrée d'AuditLog en champs lisibles ; ne lève jamais (objet supprimé -> « objet supprimé »).

    Renvoie un dict : date (heure locale), author, action, field, sheet_kind, sheet_label, sheet (la fiche ou None),
    before, after, change (« avant → après »).
    """
    obj = entry.content_object
    sheet = _sheet_of(obj) if obj is not None else None
    if sheet is not None:
        kind = 'Contrôle' if isinstance(sheet, InspectionSheet) else 'Intervention'
        label = f"{sheet.vehicle.imat} — {sheet.start_date:%d/%m/%Y}" if sheet.start_date else str(sheet.vehicle.imat)
    else:
        kind, label = '', 'objet supprimé'
    field = AUDIT_FIELD_LABELS.get(entry.field_name, entry.field_name)
    if entry.action == 'field_modified':
        before = format_audit_value(entry.field_name, entry.old_value)
        after = format_audit_value(entry.field_name, entry.new_value)
    else:  # ajout / suppression / écartement : str() de la tâche ou du dégât
        before, after = entry.old_value, entry.new_value
    parts = [p for p in (before, after) if p]
    return {
        'date': timezone.localtime(entry.created_at),
        'author': f"{entry.author.first_name} {entry.author.last_name}".strip() or entry.author.email,
        'action': AUDIT_ACTION_LABELS.get(entry.action, entry.action),
        'field': field,
        'sheet_kind': kind,
        'sheet_label': label,
        'sheet': sheet,
        'before': before,
        'after': after,
        'change': ' → '.join(parts) if entry.action == 'field_modified' else (parts[0] if parts else ''),
    }
