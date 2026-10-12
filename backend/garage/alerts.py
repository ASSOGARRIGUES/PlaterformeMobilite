import calendar
from dataclasses import dataclass
from datetime import date, datetime

from django.db.models import Count, Q


def get_config():
    from .models import MaintenanceConfig
    config = MaintenanceConfig.objects.first()
    if config is None:
        config = MaintenanceConfig.objects.create()
    return config


def get_vehicle_alert_level(vehicle) -> dict:
    raise NotImplementedError

def get_fleet_alerts(vehicles) -> list:
    raise NotImplementedError

def get_blocking_conditions(vehicle) -> list:
    raise NotImplementedError

def can_set_available(vehicle) -> bool:
    raise NotImplementedError


# ── Entretien par tâche (story 2.10) ─────────────────────────────────────────

TASK_STATUS_CHOICES = [
    ('overdue', 'En retard'),
    ('to_plan', 'À prévoir'),
    ('up_to_date', 'À jour'),
    ('not_recorded', 'Jamais enregistrée'),
]
# Origine d'un élément « à prévoir » : échéance proche, signalement ouvert, pièce d'usure posée au
# seuil d'alerte (D4) ou niveau mesuré en contrôle au seuil d'alerte (E7). Aucune autre source tant
# que la prédiction n'existe pas.
PLANNING_SOURCE_CHOICES = [
    ('echeance', 'Échéance'),
    ('signalement', 'Signalement'),
    ('usure', 'Usure'),
    ('mesure', 'Mesure'),
]
SHEET_KIND_CHOICES = [
    ('intervention', "Fiche d'intervention"),
    ('inspection', 'Fiche de contrôle'),
]
# À date égale, un contrôle précède une intervention (hypothèse métier : on contrôle avant de réparer).
# Les ids de fiches des deux tables ne se comparent jamais : le genre départage avant l'id.
KIND_RANK = {'inspection': 0, 'intervention': 1}
AXIS_CHOICES = [
    ('km', 'Kilométrage'),
    ('months', 'Durée'),
]


@dataclass(frozen=True)
class CatalogTask:
    """Copie de TaskCatalog."""
    id: int
    name: str
    vehicle_types: list
    km_periodicity: int | None
    month_periodicity: int | None
    soon_km: int | None
    soon_months: int | None
    is_critical: bool
    is_wear_task: bool
    icon: str = 'tool'


@dataclass(frozen=True)
class TaskOccurrence:
    """Une InterventionTask (ou InspectionTask « à prévoir ») d'une fiche VALIDÉE avec start_date non nulle."""
    task_id: int
    sheet_id: int
    vehicle_id: int
    type: str  # 'done' | 'planned'
    catalog_task_id: int | None
    name: str  # nom du catalogue pour une tâche du catalogue, nom saisi pour une tâche libre
    description: str
    wear_level: int | None
    sheet_start_date: date
    sheet_start_mileage: int | None
    catalog_icon: str | None = None  # icône de la tâche du catalogue, None pour une tâche libre
    photo_urls: tuple = ()  # chemins des photos (GaragePhoto.image.url), chargés pour les tâches « à prévoir »
    dismissed: bool = False  # signalement écarté (dismissed_at renseigné) : n'est plus ouvert
    sheet_kind: str = 'intervention'  # 'intervention' | 'inspection'


@dataclass(frozen=True)
class WearMeasurement:
    """Niveau d'usure mesuré (sur 10) pendant une fiche de contrôle VALIDÉE avec start_date non nulle."""
    catalog_task_id: int
    sheet_id: int
    vehicle_id: int
    level: int
    sheet_start_date: date
    sheet_start_mileage: int | None


@dataclass(frozen=True)
class SheetSummary:
    """Toute fiche du véhicule (ouverte ou validée)."""
    id: int
    vehicle_id: int
    status: str
    start_date: date | None
    end_date: date | None
    start_mileage: int | None
    created_by_display: str
    done_count: int
    planned_count: int
    created_at: datetime


def add_months(d: date, months: int) -> date:
    """Ajoute (ou retire, si négatif) des mois en ramenant le jour au dernier jour du mois si besoin."""
    year, month_index = divmod(d.year * 12 + d.month - 1 + months, 12)
    month = month_index + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def get_task_lifespan(vehicle, task, last_done) -> dict:
    """Durée de vie d'une tâche sur chaque axe ({'km': …, 'months': …}, None si l'axe n'existe pas).

    Seul endroit du calcul qui lit les périodicités du catalogue. `vehicle` et `last_done` sont
    inutilisés aujourd'hui : ils sont réservés à la prédiction (PRD Q6). Une périodicité à 0 est
    traitée comme absente.
    """
    return {'km': task.km_periodicity or None, 'months': task.month_periodicity or None}


def load_maintenance_data(vehicles) -> dict:
    """Charge en un nombre constant de requêtes les données nécessaires au calcul pur."""
    from .models import (
        TaskCatalog, InterventionTask, InterventionSheet, GaragePhoto, InspectionTask, InspectionWearMeasurement,
    )

    vehicle_ids = [vehicle.id for vehicle in vehicles]

    catalog = [
        CatalogTask(
            id=task.id, name=task.name, vehicle_types=list(task.vehicle_types or []),
            km_periodicity=task.km_periodicity, month_periodicity=task.month_periodicity,
            soon_km=task.soon_km, soon_months=task.soon_months,
            is_critical=task.is_critical, is_wear_task=task.is_wear_task, icon=task.icon,
        )
        for task in TaskCatalog.objects.filter(archived=False)
    ]

    occurrences_by_vehicle = {vehicle_id: [] for vehicle_id in vehicle_ids}
    tasks = (
        InterventionTask.objects
        .filter(sheet__vehicle_id__in=vehicle_ids, sheet__status='validated', sheet__start_date__isnull=False)
        .select_related('sheet', 'catalog_task')
    )
    tasks = list(tasks)

    inspection_tasks = list(
        InspectionTask.objects
        .filter(sheet__vehicle_id__in=vehicle_ids, sheet__status='validated', sheet__start_date__isnull=False)
        .select_related('sheet', 'catalog_task')
    )

    # Photos des signalements des deux genres de fiche, en une requête (jointure sur le content type
    # plutôt que get_for_model, pour ne pas dépendre du cache de ContentType)
    photo_urls = {}
    planned_ids = {
        'interventiontask': {task.id for task in tasks if task.type == 'planned'},
        'inspectiontask': {task.id for task in inspection_tasks},
    }
    photos = GaragePhoto.objects.filter(
        Q(content_type__model='interventiontask', object_id__in=planned_ids['interventiontask'])
        | Q(content_type__model='inspectiontask', object_id__in=planned_ids['inspectiontask']),
        content_type__app_label='garage',
    ).select_related('content_type').order_by('id')
    for photo in photos:
        photo_urls.setdefault((photo.content_type.model, photo.object_id), []).append(photo.image.url)

    for task in tasks:
        occurrences_by_vehicle[task.sheet.vehicle_id].append(TaskOccurrence(
            task_id=task.id, sheet_id=task.sheet_id, vehicle_id=task.sheet.vehicle_id, type=task.type,
            catalog_task_id=task.catalog_task_id,
            name=task.catalog_task.name if task.catalog_task else task.name,
            description=task.description, wear_level=task.wear_level,
            sheet_start_date=task.sheet.start_date, sheet_start_mileage=task.sheet.start_mileage,
            catalog_icon=task.catalog_task.icon if task.catalog_task else None,
            photo_urls=tuple(photo_urls.get(('interventiontask', task.id), ())),
            dismissed=task.dismissed_at is not None,
        ))
    for task in inspection_tasks:
        occurrences_by_vehicle[task.sheet.vehicle_id].append(TaskOccurrence(
            task_id=task.id, sheet_id=task.sheet_id, vehicle_id=task.sheet.vehicle_id, type='planned',
            catalog_task_id=task.catalog_task_id,
            name=task.catalog_task.name if task.catalog_task else task.name,
            description=task.description, wear_level=None,
            sheet_start_date=task.sheet.start_date, sheet_start_mileage=task.sheet.start_mileage,
            catalog_icon=task.catalog_task.icon if task.catalog_task else None,
            photo_urls=tuple(photo_urls.get(('inspectiontask', task.id), ())),
            dismissed=task.dismissed_at is not None, sheet_kind='inspection',
        ))

    measurements_by_vehicle = {vehicle_id: [] for vehicle_id in vehicle_ids}
    measurements = (
        InspectionWearMeasurement.objects
        .filter(sheet__vehicle_id__in=vehicle_ids, sheet__status='validated', sheet__start_date__isnull=False)
        .select_related('sheet')
    )
    for measurement in measurements:
        measurements_by_vehicle[measurement.sheet.vehicle_id].append(WearMeasurement(
            catalog_task_id=measurement.catalog_task_id, sheet_id=measurement.sheet_id,
            vehicle_id=measurement.sheet.vehicle_id, level=measurement.level,
            sheet_start_date=measurement.sheet.start_date, sheet_start_mileage=measurement.sheet.start_mileage,
        ))

    sheets_by_vehicle = {vehicle_id: [] for vehicle_id in vehicle_ids}
    sheets = (
        InterventionSheet.objects
        .filter(vehicle_id__in=vehicle_ids)
        .select_related('created_by')
        .annotate(
            done_count=Count('tasks', filter=Q(tasks__type='done')),
            planned_count=Count('tasks', filter=Q(tasks__type='planned')),
        )
    )
    for sheet in sheets:
        sheets_by_vehicle[sheet.vehicle_id].append(SheetSummary(
            id=sheet.id, vehicle_id=sheet.vehicle_id, status=sheet.status,
            start_date=sheet.start_date, end_date=sheet.end_date, start_mileage=sheet.start_mileage,
            created_by_display=f"{sheet.created_by.first_name} {sheet.created_by.last_name}".strip(),
            done_count=sheet.done_count, planned_count=sheet.planned_count, created_at=sheet.created_at,
        ))

    return {
        'catalog': catalog,
        'occurrences_by_vehicle': occurrences_by_vehicle,
        'sheets_by_vehicle': sheets_by_vehicle,
        'measurements_by_vehicle': measurements_by_vehicle,
    }


def _sheet_key(start_date, kind, sheet_id):
    """Ordre chronologique de deux fiches de genres différents : (date, rang du genre, id)."""
    return start_date, KIND_RANK[kind], sheet_id


def _occurrence_key(occurrence):
    """Ordre chronologique d'une occurrence : clé de sa fiche, puis id de la tâche."""
    return _sheet_key(occurrence.sheet_start_date, occurrence.sheet_kind, occurrence.sheet_id), occurrence.task_id


def _tracked_tasks(data, vehicle):
    """Tâches suivies du catalogue applicables au véhicule : [(tâche, dernière réalisation, durée de vie)].

    Une tâche est suivie si elle a une périodicité, ou si c'est une tâche d'usure (sa ligne existe
    alors même sans périodicité : son statut vient de la dernière pose et de la dernière mesure).
    """
    occurrences = data['occurrences_by_vehicle'].get(vehicle.id, [])
    result = []
    for task in data['catalog']:
        if vehicle.type not in task.vehicle_types:
            continue
        done = [o for o in occurrences if o.type == 'done' and o.catalog_task_id == task.id]
        last_done = max(done, key=_occurrence_key) if done else None
        lifespan = get_task_lifespan(vehicle, task, last_done)
        if lifespan['km'] or lifespan['months'] or task.is_wear_task:
            result.append((task, last_done, lifespan))
    return result


def compute_open_signalements(data, vehicle) -> dict:
    """Signalements (tâches « à prévoir » des fiches validées) encore ouverts.

    Un signalement sur une tâche du catalogue est clos par une réalisation (done) du même
    catalog_task dans la même fiche, ou dans une fiche validée postérieure selon (start_date, genre de fiche, id) : les ids des fiches
    d'intervention et de contrôle ne se comparent jamais.
    Un signalement libre n'est jamais clos par une réalisation (FR-4.9).

    Renvoie {'by_task': {catalog_task_id: [...]}, 'standalone': [...]} : les signalements
    rattachés à une ligne cyclique, et les autres (tâche libre, non cyclique, archivée ou non
    applicable).
    """
    occurrences = data['occurrences_by_vehicle'].get(vehicle.id, [])
    done_by_catalog = {}
    for occurrence in occurrences:
        if occurrence.type == 'done' and occurrence.catalog_task_id is not None:
            done_by_catalog.setdefault(occurrence.catalog_task_id, []).append(occurrence)
    cyclic_ids = {task.id for task, _, _ in _tracked_tasks(data, vehicle)}

    by_task, standalone = {}, []
    for planned in sorted((o for o in occurrences if o.type == 'planned'), key=_occurrence_key):
        if planned.dismissed:
            continue
        if planned.catalog_task_id is not None:
            planned_key = _sheet_key(planned.sheet_start_date, planned.sheet_kind, planned.sheet_id)
            closed = any(
                (done.sheet_kind, done.sheet_id) == (planned.sheet_kind, planned.sheet_id)
                or _sheet_key(done.sheet_start_date, done.sheet_kind, done.sheet_id) > planned_key
                for done in done_by_catalog.get(planned.catalog_task_id, [])
            )
            if closed:
                continue
        signalement = {
            'task_id': planned.task_id, 'sheet_id': planned.sheet_id, 'sheet_kind': planned.sheet_kind, 'sheet_date': planned.sheet_start_date,
            'catalog_task_id': planned.catalog_task_id, 'name': planned.name, 'description': planned.description,
            'source': 'signalement', 'photos': list(planned.photo_urls),
        }
        if planned.catalog_task_id in cyclic_ids:
            by_task.setdefault(planned.catalog_task_id, []).append(signalement)
        else:
            standalone.append(signalement)
    return {'by_task': by_task, 'standalone': standalone}


def compute_task_statuses(data, vehicle, today, config, signalements=None) -> list:
    """Une ligne par tâche suivie applicable au véhicule, triée par nom.

    Une tâche d'usure dont la pièce a été posée à `config.wear_alert_threshold` ou moins passe
    « à prévoir » (D4). Une mesure de contrôle validée plus récente que la dernière pose (strictement),
    ou sans aucune pose, prévaut sur la pose (E7) : ≤ seuil critique → en retard, ≤ seuil d'alerte →
    « à prévoir » (source `mesure`). Elle n'efface pas un dépassement d'échéance km/mois.
    `signalements` est le résultat de compute_open_signalements (recalculé s'il n'est pas fourni).
    """
    if signalements is None:
        signalements = compute_open_signalements(data, vehicle)

    measurements = data.get('measurements_by_vehicle', {}).get(vehicle.id, [])
    rows = []
    for task, last_done, lifespan in _tracked_tasks(data, vehicle):
        task_measurements = [m for m in measurements if m.catalog_task_id == task.id]
        last_measurement = (
            max(task_measurements, key=lambda m: (m.sheet_start_date, m.sheet_id)) if task_measurements else None
        )
        measure_prevails = last_measurement is not None and (
            last_done is None or last_measurement.sheet_start_date > last_done.sheet_start_date
        )
        attached = signalements['by_task'].get(task.id, [])
        km_axis = months_axis = last_realization = None
        status, source = 'not_recorded', None
        overdue = to_plan = False

        if last_done is not None:
            last_realization = {
                'sheet_id': last_done.sheet_id, 'task_id': last_done.task_id,
                'date': last_done.sheet_start_date, 'km': last_done.sheet_start_mileage,
                'wear_level': last_done.wear_level,
            }

            if lifespan['km']:
                due_km = last_done.sheet_start_mileage + lifespan['km']
                remaining_km = due_km - vehicle.kilometer
                soon_km = task.soon_km or None
                km_axis = {
                    'lifespan': lifespan['km'], 'due': due_km, 'remaining': remaining_km,
                    'progress': round((vehicle.kilometer - last_done.sheet_start_mileage) / lifespan['km'], 2),
                    'soon': soon_km,
                }
                overdue |= remaining_km <= 0
                to_plan |= soon_km is not None and remaining_km <= soon_km

            if lifespan['months']:
                last_date = last_done.sheet_start_date
                due_date = add_months(last_date, lifespan['months'])
                soon_months = task.soon_months or None
                months_axis = {
                    'lifespan': lifespan['months'], 'due': due_date, 'remaining_days': (due_date - today).days,
                    'progress': round((today - last_date).days / (due_date - last_date).days, 2),
                    'soon': soon_months,
                }
                overdue |= today >= due_date
                to_plan |= soon_months is not None and today >= add_months(due_date, -soon_months)

        measure_critical = measure_alert = False
        if measure_prevails:
            measure_critical = last_measurement.level <= config.wear_critical_threshold
            measure_alert = last_measurement.level <= config.wear_alert_threshold

        if overdue or measure_critical:
            status = 'overdue'
        elif to_plan:
            status, source = 'to_plan', 'echeance'
        elif measure_alert:
            status, source = 'to_plan', 'mesure'
        elif (
            not measure_prevails and last_done is not None
            and task.is_wear_task and last_done.wear_level is not None
            and last_done.wear_level <= config.wear_alert_threshold
        ):
            status, source = 'to_plan', 'usure'
        elif last_done is not None or measure_prevails:
            status = 'up_to_date'

        if status in ('up_to_date', 'not_recorded') and attached:
            status, source = 'to_plan', 'signalement'

        axes = [(name, axis['progress']) for name, axis in (('km', km_axis), ('months', months_axis)) if axis]
        main_axis = max(axes, key=lambda axis: axis[1])[0] if axes else None

        rows.append({
            'catalog_task_id': task.id, 'name': task.name, 'icon': task.icon,
            'is_critical': task.is_critical, 'is_wear_task': task.is_wear_task,
            'periodicity': {'km': lifespan['km'], 'months': lifespan['months']},
            'status': status, 'source': source, 'last_realization': last_realization,
            'km': km_axis, 'months': months_axis, 'main_axis': main_axis,
            'signalements': attached,
            'last_measurement': {
                'sheet_id': last_measurement.sheet_id, 'date': last_measurement.sheet_start_date,
                'km': last_measurement.sheet_start_mileage, 'level': last_measurement.level,
            } if last_measurement else None,
        })
    return sorted(rows, key=lambda row: row['name'])


def _normalize_name(name):
    return " ".join(name.split()).casefold()


def compute_other_work(data, vehicle) -> list:
    """Dernière occurrence réalisée de chaque tâche sans ligne cyclique, triée par date décroissante.

    Les tâches libres sont regroupées par nom normalisé (espaces et casse).
    """
    cyclic_ids = {task.id for task, _, _ in _tracked_tasks(data, vehicle)}
    latest = {}
    for occurrence in data['occurrences_by_vehicle'].get(vehicle.id, []):
        if occurrence.type != 'done' or occurrence.catalog_task_id in cyclic_ids:
            continue
        if occurrence.catalog_task_id is not None:
            key = f"cat:{occurrence.catalog_task_id}"
        else:
            key = f"free:{_normalize_name(occurrence.name)}"
        if key not in latest or _occurrence_key(occurrence) > _occurrence_key(latest[key]):
            latest[key] = occurrence

    items = sorted(latest.items(), key=lambda item: _occurrence_key(item[1]), reverse=True)
    return [
        {
            'key': key, 'catalog_task_id': occurrence.catalog_task_id, 'name': occurrence.name,
            'icon': occurrence.catalog_icon,
            'sheet_id': occurrence.sheet_id, 'task_id': occurrence.task_id,
            'date': occurrence.sheet_start_date, 'km': occurrence.sheet_start_mileage,
            'wear_level': occurrence.wear_level,
        }
        for key, occurrence in items
    ]


def compute_maintenance_summary(data, vehicle, today, config) -> dict:
    """Synthèse complète de l'entretien d'un véhicule (réponse de GET /api/garage/maintenance/{id}/)."""
    signalements = compute_open_signalements(data, vehicle)
    tasks = compute_task_statuses(data, vehicle, today, config, signalements)
    other_work = compute_other_work(data, vehicle)
    sheets = sorted(
        data['sheets_by_vehicle'].get(vehicle.id, []),
        key=lambda sheet: (sheet.start_date or sheet.created_at.date(), sheet.id),
        reverse=True,
    )

    def count(status):
        return sum(1 for row in tasks if row['status'] == status)

    return {
        'vehicle_id': vehicle.id,
        'current_km': vehicle.kilometer,
        'today': today,
        'tasks': tasks,
        'signalements': signalements['standalone'],
        'other_work': other_work,
        'sheets': [
            {
                'id': sheet.id, 'status': sheet.status, 'start_date': sheet.start_date, 'end_date': sheet.end_date,
                'start_mileage': sheet.start_mileage, 'created_by_display': sheet.created_by_display,
                'done_count': sheet.done_count, 'planned_count': sheet.planned_count,
            }
            for sheet in sheets
        ],
        'counts': {
            'overdue': count('overdue'),
            'to_plan': count('to_plan') + len(signalements['standalone']),
            'up_to_date': count('up_to_date'),
            'not_recorded': count('not_recorded'),
            'other_work': len(other_work),
            'sheets': len(sheets),
        },
    }


def is_signalement_open(vehicle, kind, task_id) -> bool:
    """Vrai si le signalement `task_id` du genre de fiche `kind` est encore ouvert (ni clos ni écarté)."""
    data = load_maintenance_data([vehicle])
    signalements = compute_open_signalements(data, vehicle)
    open_ones = [s for sigs in signalements['by_task'].values() for s in sigs] + signalements['standalone']
    return any(s['sheet_kind'] == kind and s['task_id'] == task_id for s in open_ones)
