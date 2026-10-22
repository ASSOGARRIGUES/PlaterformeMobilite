import { describe, it, expect } from 'vitest';
import {
  localTaskToCreatePayload,
  localTaskToUpdatePayload,
  localTaskFromApiTask,
  pendingSuggestions,
  localTaskFromSuggestion,
  sidePanelCardVisibility,
  dedupedHistorySummaries,
  extractStepError,
  extractFieldErrors,
  isRetryableError,
} from '../hooks/garage/interventionStepperUtils';
import { LocalTask, InterventionTask, InterventionSheet, MaintenanceSummary, MaintenanceTask, MaintenanceSignalement } from '../types/garage';
import { IconEnum, MaintenanceAxisEnum, MaintenanceSheetKindEnum, MaintenanceSourceEnum, MaintenanceStatusEnum } from '../types/schema.d';
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
    [7, { id: 7, name: 'Vidange', vehicle_types: ['voiture'], km_periodicity: 10000, is_wear_task: true, icon: 'oil' } as TaskCatalogItem],
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
    expect(local.periodicityLabel).toBe(`Tous les ${humanizeNumber(10000)} km`);
    expect(local.icon).toBe('oil');
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
    expect(local.icon).toBeUndefined();
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

describe('pendingSuggestions', () => {
  function makeSig(overrides: Partial<MaintenanceSignalement> = {}): MaintenanceSignalement {
    return {
      task_id: 230, sheet_id: 44, sheet_kind: MaintenanceSheetKindEnum.intervention, sheet_date: '2026-09-12', catalog_task_id: null, name: 'Bruit train avant',
      description: '', source: MaintenanceSourceEnum.signalement, photos: [],
      ...overrides,
    };
  }

  function makeRow(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
    return {
      catalog_task_id: 1, name: 'Vidange', icon: IconEnum.oil, periodicity: { km: 10000, months: null },
      is_critical: false, is_wear_task: false, status: MaintenanceStatusEnum.to_plan, source: null,
      last_realization: null, last_measurement: null, measure_prevails: false, km: null, months: null, main_axis: null, signalements: [],
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

  const done = (catalogTaskId?: number) => makeLocalTask({ catalogTaskId });

  it('returns three empty lists without summary', () => {
    expect(pendingSuggestions(undefined, [])).toEqual({ overdue: [], toPlan: [], signalements: [] });
  });

  it('splits overdue and toPlan, most urgent first, like the maintenance tab', () => {
    const summary = makeSummary({
      tasks: [
        makeRow({ catalog_task_id: 1, name: 'A', status: MaintenanceStatusEnum.to_plan, main_axis: MaintenanceAxisEnum.km, km: { remaining: 100, progress: 0.9 } as MaintenanceTask['km'] }),
        makeRow({ catalog_task_id: 2, name: 'B', status: MaintenanceStatusEnum.overdue }),
        makeRow({ catalog_task_id: 3, name: 'C', status: MaintenanceStatusEnum.to_plan, main_axis: MaintenanceAxisEnum.km, km: { remaining: 10, progress: 0.99 } as MaintenanceTask['km'] }),
      ],
    });
    const { overdue, toPlan } = pendingSuggestions(summary, []);
    expect(overdue.map((task) => task.name)).toEqual(['B']);
    expect(toPlan.map((task) => task.name)).toEqual(['C', 'A']);
  });

  it('never suggests up_to_date or not_recorded rows', () => {
    const summary = makeSummary({
      tasks: [
        makeRow({ status: MaintenanceStatusEnum.up_to_date }),
        makeRow({ catalog_task_id: 2, status: MaintenanceStatusEnum.not_recorded }),
      ],
    });
    expect(pendingSuggestions(summary, [])).toEqual({ overdue: [], toPlan: [], signalements: [] });
  });

  it('drops a task already added to the done tasks', () => {
    const summary = makeSummary({
      tasks: [
        makeRow({ catalog_task_id: 1, status: MaintenanceStatusEnum.overdue }),
        makeRow({ catalog_task_id: 2, status: MaintenanceStatusEnum.to_plan }),
      ],
    });
    const { overdue, toPlan } = pendingSuggestions(summary, [done(1)]);
    expect(overdue).toEqual([]);
    expect(toPlan.map((task) => task.catalog_task_id)).toEqual([2]);
  });

  it('filters a standalone signalement on its catalog task, never a free one', () => {
    const summary = makeSummary({
      signalements: [makeSig({ task_id: 1, catalog_task_id: 2 }), makeSig({ task_id: 2, catalog_task_id: null })],
    });
    expect(pendingSuggestions(summary, [done(2)]).signalements.map((signalement) => signalement.task_id)).toEqual([2]);
    expect(pendingSuggestions(summary, [done(undefined)]).signalements).toHaveLength(2);
  });

  it('consumes a free signalement through the task it created, and suggests it again once that task is gone', () => {
    const summary = makeSummary({ signalements: [makeSig({ task_id: 7, catalog_task_id: null })] });
    const created = makeLocalTask({ sourceSignalementId: 7 });
    expect(pendingSuggestions(summary, [created]).signalements).toEqual([]);
    expect(pendingSuggestions(summary, []).signalements.map((signalement) => signalement.task_id)).toEqual([7]);
  });

  it('lists standalone signalements most recent first', () => {
    const summary = makeSummary({
      signalements: [makeSig({ task_id: 1, sheet_date: '2026-08-01' }), makeSig({ task_id: 2, sheet_date: '2026-09-01' })],
    });
    expect(pendingSuggestions(summary, []).signalements.map((signalement) => signalement.task_id)).toEqual([2, 1]);
  });
});

describe('localTaskFromSuggestion', () => {
  function makeSig(overrides: Partial<MaintenanceSignalement> = {}): MaintenanceSignalement {
    return {
      task_id: 230, sheet_id: 44, sheet_kind: MaintenanceSheetKindEnum.intervention, sheet_date: '2026-09-12', catalog_task_id: null, name: 'Bruit train avant',
      description: '', source: MaintenanceSourceEnum.signalement, photos: [],
      ...overrides,
    };
  }

  function makeRow(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
    return {
      catalog_task_id: 1, name: 'Vidange', icon: IconEnum.oil, periodicity: { km: 10000, months: null },
      is_critical: false, is_wear_task: false, status: MaintenanceStatusEnum.to_plan, source: null,
      last_realization: null, last_measurement: null, measure_prevails: false, km: null, months: null, main_axis: null, signalements: [],
      ...overrides,
    };
  }

  const catalogById = new Map<number, TaskCatalogItem>([
    [2, { id: 2, name: 'Nettoyage', vehicle_types: ['voiture'], is_wear_task: false, icon: 'body' } as TaskCatalogItem],
  ]);

  it('creates a done task from a row, without anything from the attached signalements', () => {
    const row = makeRow({
      icon: IconEnum.oil, is_wear_task: true,
      signalements: [makeSig({ description: 'Fuite', photos: ['/p1.png'] })],
    });
    const local = localTaskFromSuggestion(row, catalogById);
    expect(local).toMatchObject({
      catalogTaskId: 1, name: 'Vidange', icon: 'oil', isWearTask: true, type: 'done', description: '', parts: [], photos: [],
      periodicityLabel: `Tous les ${humanizeNumber(10000)} km`,
    });
  });

  it('creates a done task from a standalone signalement on a catalog task', () => {
    const local = localTaskFromSuggestion(makeSig({ catalog_task_id: 2, name: 'Nettoyage', description: 'Sale', photos: ['/p.png'] }), catalogById);
    expect(local).toMatchObject({ catalogTaskId: 2, icon: 'body', isWearTask: false, description: '', photos: [], type: 'done' });
  });

  it('leaves catalogTaskId undefined for a free signalement', () => {
    const local = localTaskFromSuggestion(makeSig({ description: 'Bruit' }), catalogById);
    expect(local).toMatchObject({ catalogTaskId: undefined, name: 'Bruit train avant', description: '', isWearTask: false });
    expect(local.icon).toBeUndefined();
    expect(local.periodicityLabel).toBeUndefined();
  });

  it('defaults wearLevel to 10 for wear tasks only', () => {
    const wearCatalog = new Map([[2, { ...catalogById.get(2)!, is_wear_task: true }]]);
    expect(localTaskFromSuggestion(makeSig({ catalog_task_id: 2 }), wearCatalog).wearLevel).toBe(10);
    expect(localTaskFromSuggestion(makeSig({ catalog_task_id: 2 }), catalogById).wearLevel).toBeUndefined();
  });

  it('remembers the originating signalement', () => {
    expect(localTaskFromSuggestion(makeSig({ task_id: 7 }), catalogById).sourceSignalementId).toBe(7);
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

  it('sums the parts cost of every done task, a missing quantity counting for one', () => {
    const withParts = (id: number, catalogTaskId: number, parts: unknown[]) => ({ ...makeDoneTask(id, catalogTaskId), parts }) as unknown as InterventionTask;
    const sheet = makeSheet({
      id: 1,
      created_at: '2026-01-01T00:00:00Z',
      tasks: [
        withParts(1, 7, [{ id: 1, name: 'Bougie', unit_price: '12.50', quantity: 4 }]),
        withParts(2, 8, [{ id: 2, name: 'Filtre', unit_price: '8.00', quantity: null }]),
      ],
    });
    expect(dedupedHistorySummaries([sheet], catalogById)[0].partsCost).toBe(58);
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

const httpError = (status: number, data: unknown) => ({ response: { status, data }, message: `Request failed with status code ${status}` });

describe('extractStepError', () => {
  it('reads a single-field error', () => {
    expect(extractStepError(httpError(400, { start_mileage: ['Inférieur au dernier relevé.'] }))).toBe('Inférieur au dernier relevé.');
  });

  it('reads a plain string value and the DRF detail key', () => {
    expect(extractStepError(httpError(400, { detail: 'Non autorisé.' }))).toBe('Non autorisé.');
  });

  it('joins several fields instead of keeping only the first one', () => {
    const message = extractStepError(httpError(400, { start_mileage: ['Trop bas.'], start_date: ['Date dans le futur.'] }));
    expect(message).toContain('Trop bas.');
    expect(message).toContain('Date dans le futur.');
  });

  it('flattens nested errors (wear_measurements: [{level: [...]}]) without [object Object]', () => {
    const message = extractStepError(httpError(400, { wear_measurements: [{}, { level: ['Doit être entre 0 et 10.'] }] }));
    expect(message).toBe('Doit être entre 0 et 10.');
  });

  it('never leaks HTML for a 5xx page', () => {
    const message = extractStepError(httpError(500, '<!doctype html><html><body>Server Error</body></html>'));
    expect(message).not.toContain('<');
    expect(message).toBe('Le serveur a rencontré un problème. Réessayez dans un instant.');
  });

  it('describes a network failure (no response)', () => {
    expect(extractStepError({ message: 'Network Error' })).toBe('La connexion a échoué. Vos saisies sont gardées sur cet écran.');
    expect(extractStepError({ statusCode: 'ERR_NETWORK', message: 'Network Error' })).toBe('La connexion a échoué. Vos saisies sont gardées sur cet écran.');
  });

  it('keeps the message of a plain Error that is not an HTTP failure', () => {
    expect(extractStepError(new Error('Échec de la synchronisation de "Vidange" : Trop bas.'))).toBe('Échec de la synchronisation de "Vidange" : Trop bas.');
  });

  it('falls back to a generic message for an empty 400 body', () => {
    expect(extractStepError(httpError(400, {}))).toBe('Une erreur est survenue.');
  });
});

describe('extractFieldErrors', () => {
  it('returns one entry per field with a flattened message', () => {
    expect(extractFieldErrors(httpError(400, { start_mileage: ['Trop bas.'], wear_measurements: [{ level: ['Hors plage.'] }] }))).toEqual([
      { field: 'start_mileage', message: 'Trop bas.' },
      { field: 'wear_measurements', message: 'Hors plage.' },
    ]);
  });

  it('returns nothing for a network or 5xx error', () => {
    expect(extractFieldErrors({ message: 'Network Error' })).toEqual([]);
    expect(extractFieldErrors(httpError(500, '<html></html>'))).toEqual([]);
  });
});

describe('isRetryableError', () => {
  it('is true for network and 5xx failures, false for validation errors', () => {
    expect(isRetryableError({ message: 'Network Error' })).toBe(true);
    expect(isRetryableError(new Error('boom'))).toBe(false);
    expect(isRetryableError(httpError(503, ''))).toBe(true);
    expect(isRetryableError(httpError(400, { a: ['b'] }))).toBe(false);
  });
});
