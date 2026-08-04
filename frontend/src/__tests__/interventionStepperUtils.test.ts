import { describe, it, expect } from 'vitest';
import {
  localTaskToCreatePayload,
  localTaskToUpdatePayload,
  localTaskFromApiTask,
  hasCriticalWear,
  unresolvedPlannedTasks,
} from '../hooks/garage/interventionStepperUtils';
import { LocalTask, InterventionTask } from '../types/garage';
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

describe('unresolvedPlannedTasks', () => {
  const catalogById = new Map<number, TaskCatalogItem>([
    [7, { id: 7, name: 'Vidange', vehicle_types: ['voiture'], km_periodicity: 10000, is_wear_task: false } as TaskCatalogItem],
  ]);

  function makeApiTask(overrides: Record<string, unknown> = {}): InterventionTask {
    return {
      id: 1, sheet: 1, type: 'planned', catalog_task: 7, name: '', description: '',
      wear_level: null, parts: [], photos: [],
      ...overrides,
    } as unknown as InterventionTask;
  }

  it('resolves a planned task when a later sheet has the matching done task (résolution rétroactive normale)', () => {
    const sheets = [
      { created_at: '2026-01-01T00:00:00Z', tasks: [makeApiTask({ id: 1, type: 'planned' })] },
      { created_at: '2026-01-05T00:00:00Z', tasks: [makeApiTask({ id: 2, type: 'done' })] },
    ];
    expect(unresolvedPlannedTasks(sheets, catalogById)).toEqual([]);
  });

  it('does not resolve a planned task when the done task is on an earlier sheet (pas de résolution dans le passé)', () => {
    const sheets = [
      { created_at: '2026-01-01T00:00:00Z', tasks: [makeApiTask({ id: 2, type: 'done' })] },
      { created_at: '2026-01-05T00:00:00Z', tasks: [makeApiTask({ id: 1, type: 'planned' })] },
    ];
    const pending = unresolvedPlannedTasks(sheets, catalogById);
    expect(pending).toHaveLength(1);
    expect(pending[0].catalogTaskId).toBe(7);
  });

  it('resolves a planned task added done in the same sheet (auto-résolution intra-fiche)', () => {
    const sheets = [
      {
        created_at: '2026-01-01T00:00:00Z',
        tasks: [makeApiTask({ id: 1, type: 'planned' }), makeApiTask({ id: 2, type: 'done' })],
      },
    ];
    expect(unresolvedPlannedTasks(sheets, catalogById)).toEqual([]);
  });

  it('makes a resolved suggestion reappear when the resolving done task is removed', () => {
    const sheetsWithDone = [
      { created_at: '2026-01-01T00:00:00Z', tasks: [makeApiTask({ id: 1, type: 'planned' })] },
      { created_at: '2026-01-05T00:00:00Z', tasks: [makeApiTask({ id: 2, type: 'done' })] },
    ];
    expect(unresolvedPlannedTasks(sheetsWithDone, catalogById)).toEqual([]);

    const sheetsWithoutDone = [
      { created_at: '2026-01-01T00:00:00Z', tasks: [makeApiTask({ id: 1, type: 'planned' })] },
      { created_at: '2026-01-05T00:00:00Z', tasks: [] },
    ];
    expect(unresolvedPlannedTasks(sheetsWithoutDone, catalogById)).toHaveLength(1);
  });
});

describe('hasCriticalWear', () => {
  it('returns false when no wear task is critical', () => {
    expect(hasCriticalWear([makeLocalTask({ isWearTask: true, wearLevel: 8 })])).toBe(false);
    expect(hasCriticalWear([makeLocalTask({ isWearTask: false })])).toBe(false);
  });

  it('returns true when a wear task is at or below the default threshold', () => {
    expect(hasCriticalWear([makeLocalTask({ isWearTask: true, wearLevel: 3 })])).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(hasCriticalWear([makeLocalTask({ isWearTask: true, wearLevel: 5 })], 6)).toBe(true);
  });
});
