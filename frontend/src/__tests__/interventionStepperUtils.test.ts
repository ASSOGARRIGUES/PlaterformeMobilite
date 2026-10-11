import { describe, it, expect } from 'vitest';
import {
  localTaskToCreatePayload,
  localTaskToUpdatePayload,
  localTaskFromApiTask,
  suggestionsFromMaintenance,
  sidePanelCardVisibility,
  dedupedHistorySummaries,
} from '../hooks/garage/interventionStepperUtils';
import { LocalTask, InterventionTask, InterventionSheet, MaintenanceSummary, MaintenanceTask, MaintenanceSignalement } from '../types/garage';
import { IconEnum, MaintenanceSourceEnum, MaintenanceStatusEnum } from '../types/schema.d';
import { humanizeNumber } from '../constants';
import { TaskCatalogItem } from '../components/garage/taskCardUtils';

function makeLocalTask(overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    localId: 'local-1',
    name: 'Tâche libre',
    type: 'done',
    isWearTask: false,
    parts: [],
    photos: [],
    ...overrides,
  };
}

describe('localTaskToCreatePayload', () => {
  it('sends catalog_task and no name for a catalog task', () => {
    const task = makeLocalTask({ catalogTaskId: 42, name: 'Vidange', isWearTask: true, wearLevel: 5 });
    expect(localTaskToCreatePayload(task)).toEqual({
      type: 'done',
      catalog_task: 42,
      name: undefined,
      wear_level: 5,
    });
  });

  it('sends name and no catalog_task for a free task', () => {
    const task = makeLocalTask({ name: 'Vérifier les freins', type: 'planned' });
    expect(localTaskToCreatePayload(task)).toEqual({
      type: 'planned',
      catalog_task: undefined,
      name: 'Vérifier les freins',
      wear_level: undefined,
    });
  });
});

describe('localTaskToUpdatePayload', () => {
  it('returns {} when nothing changed', () => {
    const task = makeLocalTask({ description: 'Idem', photos: ['http://s/a.png'], photoIds: [1] });
    expect(localTaskToUpdatePayload(task, task)).toEqual({});
  });

  it('includes only the changed description', () => {
    const previous = makeLocalTask({ description: 'Avant' });
    const current = makeLocalTask({ description: 'Après' });
    expect(localTaskToUpdatePayload(current, previous)).toEqual({ description: 'Après' });
  });

  it('detects a newly added base64 photo', () => {
    const previous = makeLocalTask({ photos: ['http://s/a.png'], photoIds: [1] });
    const current = makeLocalTask({ photos: ['http://s/a.png', 'data:image/png;base64,XXX'], photoIds: [1, null] });
    expect(localTaskToUpdatePayload(current, previous)).toEqual({ add_photos: ['data:image/png;base64,XXX'] });
  });

  it('detects a removed server photo via its id', () => {
    const previous = makeLocalTask({ photos: ['http://s/a.png', 'http://s/b.png'], photoIds: [1, 2] });
    const current = makeLocalTask({ photos: ['http://s/a.png'], photoIds: [1] });
    expect(localTaskToUpdatePayload(current, previous)).toEqual({ remove_photo_ids: [2] });
  });

  it('includes the full parts array when parts changed', () => {
    const previous = makeLocalTask({ parts: [{ localId: 'p1', name: 'Ancien', unitPrice: 5, quantity: 1 }] });
    const current = makeLocalTask({ parts: [{ localId: 'p1', name: 'Nouveau', unitPrice: 9.9, quantity: 2 }] });
    expect(localTaskToUpdatePayload(current, previous)).toEqual({
      parts: [{ name: 'Nouveau', unit_price: 9.9, quantity: 2 }],
    });
  });
});

describe('localTaskFromApiTask', () => {
  const catalogById = new Map<number, TaskCatalogItem>([
    [7, { id: 7, name: 'Vidange', vehicle_types: ['voiture'], km_periodicity: 10000, is_wear_task: true } as TaskCatalogItem],
  ]);

  it('reconstructs a catalog task with denormalized name and wear flag', () => {
    const apiTask = {
      id: 100, sheet: 1, type: 'done', catalog_task: 7, name: '', description: 'RAS',
      wear_level: 4, parts: [], photos: [],
    } as unknown as InterventionTask;
    const local = localTaskFromApiTask(apiTask, catalogById);
    expect(local.catalogTaskId).toBe(7);
    expect(local.name).toBe('Vidange');
    expect(local.isWearTask).toBe(true);
    expect(local.wearLevel).toBe(4);
    expect(local.serverId).toBe(100);
    expect(local.periodicityLabel).toBeDefined();
    expect(local.sheetId).toBe(1);
  });

  it('reconstructs a free task from its name', () => {
    const apiTask = {
      id: 101, sheet: 1, type: 'planned', catalog_task: null, name: 'Contrôle libre', description: '',
      wear_level: null, parts: [], photos: [],
    } as unknown as InterventionTask;
    const local = localTaskFromApiTask(apiTask, catalogById);
    expect(local.catalogTaskId).toBeUndefined();
    expect(local.name).toBe('Contrôle libre');
    expect(local.isWearTask).toBe(false);
    expect(local.type).toBe('planned');
  });

  it('maps photos to parallel photos/photoIds arrays', () => {
    const apiTask = {
      id: 102, sheet: 1, type: 'done', catalog_task: null, name: 'Photo', description: '',
      wear_level: null, parts: [],
      photos: [{ id: 55, url: 'http://s/x.png' }, { id: 56, url: 'http://s/y.png' }],
    } as unknown as InterventionTask;
    const local = localTaskFromApiTask(apiTask, catalogById);
    expect(local.photos).toEqual(['http://s/x.png', 'http://s/y.png']);
    expect(local.photoIds).toEqual([55, 56]);
  });
});

describe('suggestionsFromMaintenance', () => {
  const catalogById = new Map<number, TaskCatalogItem>([
    [1, { id: 1, name: 'Vidange', vehicle_types: ['voiture'], km_periodicity: 10000, is_wear_task: true } as TaskCatalogItem],
    [2, { id: 2, name: 'Nettoyage', vehicle_types: ['voiture'], is_wear_task: false } as TaskCatalogItem],
  ]);

  function makeSig(overrides: Partial<MaintenanceSignalement> = {}): MaintenanceSignalement {
    return {
      task_id: 230, sheet_id: 44, sheet_date: '2026-09-12', catalog_task_id: null, name: 'Bruit train avant',
      description: '', source: MaintenanceSourceEnum.signalement, photos: [],
      ...overrides,
    };
  }

  function makeRow(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
    return {
      catalog_task_id: 1, name: 'Vidange', icon: IconEnum.oil, periodicity: { km: 10000, months: null },
      is_critical: false, is_wear_task: false, status: MaintenanceStatusEnum.to_plan, source: null,
      last_realization: null, km: null, months: null, main_axis: null, signalements: [],
      ...overrides,
    };
  }

  function makeSummary(overrides: Partial<MaintenanceSummary> = {}): MaintenanceSummary {
    return {
      vehicle_id: 12, current_km: 84200, today: '2026-10-01', tasks: [], signalements: [], other_work: [], sheets: [],
      counts: { overdue: 0, to_plan: 0, up_to_date: 0, not_recorded: 0, other_work: 0, sheets: 0 },
      ...overrides,
    };
  }

  it('returns no suggestion without summary', () => {
    expect(suggestionsFromMaintenance(undefined, catalogById)).toEqual([]);
  });

  it('orders overdue, to_plan, then standalone signalements', () => {
    const summary = makeSummary({
      tasks: [
        makeRow({ catalog_task_id: 1, name: 'A à prévoir', status: MaintenanceStatusEnum.to_plan }),
        makeRow({ catalog_task_id: 2, name: 'B dépassée', status: MaintenanceStatusEnum.overdue }),
        makeRow({ catalog_task_id: 3, name: 'C à prévoir', status: MaintenanceStatusEnum.to_plan }),
      ],
      signalements: [makeSig({ name: 'Libre' })],
    });
    expect(suggestionsFromMaintenance(summary, catalogById).map((task) => task.name)).toEqual([
      'B dépassée', 'A à prévoir', 'C à prévoir', 'Libre',
    ]);
  });

  it('never keeps up_to_date or not_recorded rows', () => {
    const summary = makeSummary({
      tasks: [
        makeRow({ status: MaintenanceStatusEnum.up_to_date }),
        makeRow({ catalog_task_id: 2, status: MaintenanceStatusEnum.not_recorded }),
      ],
    });
    expect(suggestionsFromMaintenance(summary, catalogById)).toEqual([]);
  });

  it('takes description and photos from the attached signalements', () => {
    const summary = makeSummary({
      tasks: [makeRow({
        signalements: [
          makeSig({ description: 'Fuite', photos: ['/p1.png'] }),
          makeSig({ task_id: 231, description: 'Bruit', photos: ['/p2.png'] }),
        ],
      })],
    });
    const [suggestion] = suggestionsFromMaintenance(summary, catalogById);
    expect(suggestion).toMatchObject({
      catalogTaskId: 1, type: 'planned', description: 'Fuite\nBruit', photos: ['/p1.png', '/p2.png'],
      periodicityLabel: `${humanizeNumber(10000)} km`, parts: [],
    });
  });

  it('leaves catalogTaskId undefined for a free standalone signalement', () => {
    const [suggestion] = suggestionsFromMaintenance(makeSummary({ signalements: [makeSig({ description: 'Bruit' })] }), catalogById);
    expect(suggestion).toMatchObject({ catalogTaskId: undefined, name: 'Bruit train avant', description: 'Bruit', isWearTask: false });
    expect(suggestion.periodicityLabel).toBeUndefined();
  });

  it('sets catalogTaskId for a standalone signalement on a non-cyclic catalog task', () => {
    const [suggestion] = suggestionsFromMaintenance(
      makeSummary({ signalements: [makeSig({ catalog_task_id: 2, name: 'Nettoyage' })] }),
      catalogById,
    );
    expect(suggestion.catalogTaskId).toBe(2);
  });
});

describe('sidePanelCardVisibility', () => {
  it('always shows the vehicle card', () => {
    [0, 1, 2, 3, 4].forEach((step) => expect(sidePanelCardVisibility(step).vehicle).toBe(true));
  });

  it('shows upcoming and history only on Kilométrage (0) and Tâches réalisées (1)', () => {
    [0, 1].forEach((step) => {
      expect(sidePanelCardVisibility(step).upcoming).toBe(true);
      expect(sidePanelCardVisibility(step).history).toBe(true);
    });
    [2, 3, 4].forEach((step) => {
      expect(sidePanelCardVisibility(step).upcoming).toBe(false);
      expect(sidePanelCardVisibility(step).history).toBe(false);
    });
  });

  it('shows only the vehicle card on À prévoir (2) and Dates (3)', () => {
    [2, 3].forEach((step) => {
      const visibility = sidePanelCardVisibility(step);
      expect(visibility).toEqual({ vehicle: true, upcoming: false, history: false });
    });
  });
});

describe('dedupedHistorySummaries', () => {
  const catalogById = new Map<number, TaskCatalogItem>([
    [7, { id: 7, name: 'Bougies', vehicle_types: ['voiture'], km_periodicity: 30000, is_wear_task: false } as TaskCatalogItem],
    [8, { id: 8, name: 'Vidange', vehicle_types: ['voiture'], km_periodicity: 10000, is_wear_task: false } as TaskCatalogItem],
  ]);

  function makeSheet(overrides: Partial<InterventionSheet> & { id: number; created_at: string }): InterventionSheet {
    return {
      vehicle: {} as InterventionSheet['vehicle'],
      created_by: {} as InterventionSheet['created_by'],
      updated_at: overrides.created_at,
      tasks: [],
      ...overrides,
    } as InterventionSheet;
  }

  function makeDoneTask(id: number, catalogTaskId: number): InterventionTask {
    return { id, sheet: 1, type: 'done', catalog_task: catalogTaskId, name: '', description: '', wear_level: null, parts: [], photos: [] } as unknown as InterventionTask;
  }

  it('keeps a single occurrence of a task done on several sheets, on the most recent one', () => {
    const sheets = [
      makeSheet({ id: 2, created_at: '2026-02-01T00:00:00Z', tasks: [makeDoneTask(1, 7)] }),
      makeSheet({ id: 1, created_at: '2026-01-01T00:00:00Z', tasks: [makeDoneTask(2, 7)] }),
    ];
    const summaries = dedupedHistorySummaries(sheets, catalogById);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(2);
    expect(summaries[0].taskNames).toBe('Bougies');
  });

  it('drops a sheet entirely when all its done tasks are superseded by a more recent sheet', () => {
    const sheets = [
      makeSheet({ id: 2, created_at: '2026-02-01T00:00:00Z', tasks: [makeDoneTask(1, 7), makeDoneTask(2, 8)] }),
      makeSheet({ id: 1, created_at: '2026-01-01T00:00:00Z', tasks: [makeDoneTask(3, 7)] }),
    ];
    const summaries = dedupedHistorySummaries(sheets, catalogById);
    expect(summaries.map((s) => s.id)).toEqual([2]);
  });

  it('keeps a sheet if at least one of its done tasks is not superseded', () => {
    const sheets = [
      makeSheet({ id: 2, created_at: '2026-02-01T00:00:00Z', tasks: [makeDoneTask(1, 7)] }),
      makeSheet({ id: 1, created_at: '2026-01-01T00:00:00Z', tasks: [makeDoneTask(2, 7), makeDoneTask(3, 8)] }),
    ];
    const summaries = dedupedHistorySummaries(sheets, catalogById);
    expect(summaries.map((s) => s.id)).toEqual([2, 1]);
    expect(summaries[1].taskNames).toBe('Vidange');
  });

  it('keeps a sheet with no done tasks at all', () => {
    const sheets = [makeSheet({ id: 1, created_at: '2026-01-01T00:00:00Z', tasks: [] })];
    const summaries = dedupedHistorySummaries(sheets, catalogById);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].taskNames).toBe('Aucune tâche réalisée');
  });
});
