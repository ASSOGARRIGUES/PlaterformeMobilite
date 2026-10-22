import { describe, it, expect } from 'vitest';
import { InspectionDamage, InspectionTask, LocalDamage, MaintenanceSummary } from '../types/garage';
import { TaskCatalogItem } from '../components/garage/taskCardUtils';
import {
  InspectionDraft,
  buildStepPatch,
  chunkWearTasks,
  fieldErrorStep,
  groupFieldErrors,
  WEAR_PER_PAGE,
  INSPECTION_STEP_LABELS,
  emptyDraft,
  damageToCreatePayload,
  damageToUpdatePayload,
  localDamageFromApi,
  localPlannedTaskFromApi,
  lastWearByTask,
  wearPerPageFor,
} from '../hooks/garage/inspectionStepperUtils';

const saved: InspectionDraft = { ...emptyDraft(), startMileage: 100000, oil: true };

describe('buildStepPatch', () => {
  it('sends only current_step when nothing changed on the left step', () => {
    expect(buildStepPatch(0, 1, saved, saved)).toEqual({ current_step: 2 });
  });

  it('sends only the changed field of the left step', () => {
    const draft = { ...saved, startMileage: 100250 };
    expect(buildStepPatch(0, 1, draft, saved)).toEqual({ start_mileage: 100250, current_step: 2 });
  });

  it('ignores edits that belong to other steps', () => {
    const draft = { ...saved, startMileage: 100250, oil: false };
    expect(buildStepPatch(0, 1, draft, saved)).toEqual({ start_mileage: 100250, current_step: 2 });
  });

  it('maps the levels of step 2 to oil_ok / coolant_ok / washer_ok', () => {
    const draft = { ...saved, oil: false, coolant: true, washer: null };
    expect(buildStepPatch(1, 2, draft, saved)).toEqual({ oil_ok: false, coolant_ok: true, current_step: 3 });
  });

  it('sends current_step = target step (1-based) when going back', () => {
    expect(buildStepPatch(3, 2, saved, saved)).toEqual({ current_step: 3 });
  });

  it('wear_measurements is always the full list of measured tasks, never only the displayed page', () => {
    const before = { ...saved, wear: { 1: 8, 2: 4 } };
    const draft = { ...before, wear: { 1: 8, 2: 4, 3: 1 } };
    expect(buildStepPatch(2, 3, draft, before)).toEqual({
      wear_measurements: [
        { catalog_task: 1, level: 8 },
        { catalog_task: 2, level: 4 },
        { catalog_task: 3, level: 1 },
      ],
      current_step: 4,
    });
  });

  it('a cleared measurement is removed from the list and an emptied list is still sent', () => {
    const before = { ...saved, wear: { 1: 8 } };
    const draft = { ...before, wear: {} };
    expect(buildStepPatch(2, 3, draft, before)).toEqual({ wear_measurements: [], current_step: 4 });
  });

  it('does not resend unchanged measurements', () => {
    const before = { ...saved, wear: { 1: 8 } };
    expect(buildStepPatch(2, 3, before, before)).toEqual({ current_step: 4 });
  });

  it('maps lights, road test and their notes to their own steps', () => {
    const draft = { ...saved, lightsOk: false, lightsNotes: 'Stop gauche', roadTestDone: true, roadTestNotes: 'RAS' };
    expect(buildStepPatch(3, 4, draft, saved)).toEqual({ lights_ok: false, lights_notes: 'Stop gauche', current_step: 5 });
    expect(buildStepPatch(5, 6, draft, saved)).toEqual({ road_test_done: true, road_test_notes: 'RAS', current_step: 7 });
  });

  it('sends nothing but current_step for the damages and planned steps (they use sub-resources)', () => {
    expect(buildStepPatch(4, 5, { ...saved, lightsOk: false }, saved)).toEqual({ current_step: 6 });
    expect(buildStepPatch(6, 7, saved, saved)).toEqual({ current_step: 8 });
  });
});

describe('chunkWearTasks', () => {
  const tasks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

  it('uses 2 tasks per page', () => {
    expect(WEAR_PER_PAGE).toBe(2);
  });

  it.each([
    [0, []],
    [1, [1]],
    [2, [2]],
    [3, [2, 1]],
    [5, [2, 2, 1]],
  ])('%i tasks -> pages of %j', (count, sizes) => {
    expect(chunkWearTasks(tasks(count), 2).map((page) => page.length)).toEqual(sizes);
  });

  it('falls back to one card per page when asked', () => {
    expect(chunkWearTasks(tasks(3), 1).map((page) => page.length)).toEqual([1, 1, 1]);
  });
});

describe('fieldErrorStep / groupFieldErrors', () => {
  it('maps API fields to their 0-based step', () => {
    expect(fieldErrorStep('start_mileage')).toBe(0);
    expect(fieldErrorStep('start_date')).toBe(0);
    expect(fieldErrorStep('oil_ok')).toBe(1);
    expect(fieldErrorStep('washer_ok')).toBe(1);
    expect(fieldErrorStep('wear_measurements')).toBe(2);
    expect(fieldErrorStep('lights_ok')).toBe(3);
    expect(fieldErrorStep('road_test_notes')).toBe(5);
  });

  it('returns null for fields without an own step (non_field_errors, detail, vehicle)', () => {
    expect(fieldErrorStep('non_field_errors')).toBeNull();
    expect(fieldErrorStep('detail')).toBeNull();
    expect(fieldErrorStep('vehicle')).toBeNull();
  });

  it('labels each field error and keeps the step to jump to', () => {
    expect(
      groupFieldErrors([
        { field: 'start_mileage', message: 'Inférieur au dernier relevé.' },
        { field: 'non_field_errors', message: 'Fiche expirée.' },
      ]),
    ).toEqual([
      { field: 'start_mileage', label: 'Kilométrage', message: 'Inférieur au dernier relevé.', step: 0 },
      { field: 'non_field_errors', label: null, message: 'Fiche expirée.', step: null },
    ]);
  });
});

describe('INSPECTION_STEP_LABELS', () => {
  it('has the 7 fixed steps in order', () => {
    expect(INSPECTION_STEP_LABELS).toEqual(['Kilométrage', 'Niveaux', 'Usure', 'Éclairage', 'Dégâts', 'Essai', 'À prévoir']);
  });
});

const localDamage = (overrides: Partial<LocalDamage> = {}): LocalDamage => ({ localId: 'd1', description: 'Rayure', photos: [], ...overrides });

describe('damages payloads', () => {
  it('creates with the description and the new base64 photos', () => {
    expect(damageToCreatePayload(localDamage({ photos: ['data:image/png;base64,AAA'] }))).toEqual({
      description: 'Rayure',
      photos: ['data:image/png;base64,AAA'],
    });
  });

  it('updates only what changed', () => {
    const previous = localDamage({ serverId: 5, photos: ['/media/a.jpg'], photoIds: [11] });
    expect(damageToUpdatePayload(previous, previous)).toEqual({});
    expect(damageToUpdatePayload({ ...previous, description: 'Rayure profonde' }, previous)).toEqual({ description: 'Rayure profonde' });
  });

  it('adds new photos and removes server photos by id', () => {
    const previous = localDamage({ serverId: 5, photos: ['/media/a.jpg', '/media/b.jpg'], photoIds: [11, 12] });
    const current = { ...previous, photos: ['/media/b.jpg', 'data:image/png;base64,ZZZ'], photoIds: [12, null] };
    expect(damageToUpdatePayload(current, previous)).toEqual({ add_photos: ['data:image/png;base64,ZZZ'], remove_photo_ids: [11] });
  });

  it('rebuilds a local damage from the API', () => {
    const api = { id: 5, sheet: 1, description: 'Rayure', photos: [{ id: 11, url: '/media/a.jpg' }] } as unknown as InspectionDamage;
    expect(localDamageFromApi(api)).toMatchObject({ serverId: 5, description: 'Rayure', photos: ['/media/a.jpg'], photoIds: [11] });
  });
});

describe('localPlannedTaskFromApi', () => {
  const catalog = new Map([[3, { id: 3, name: 'Vidange', icon: 'oil', periodicity: undefined } as unknown as TaskCatalogItem]]);

  it('maps a catalog task to a planned task without parts nor wear', () => {
    const api = { id: 9, sheet: 1, catalog_task: 3, name: '', description: 'À faire vite', photos: [{ id: 1, url: '/media/p.jpg' }] } as unknown as InspectionTask;
    expect(localPlannedTaskFromApi(api, catalog)).toMatchObject({
      serverId: 9, catalogTaskId: 3, name: 'Vidange', type: 'planned', icon: 'oil', isWearTask: false, parts: [],
      description: 'À faire vite', photos: ['/media/p.jpg'], photoIds: [1],
    });
  });

  it('keeps the free name of an operation outside the catalog', () => {
    const api = { id: 10, sheet: 1, catalog_task: null, name: 'Bruit essieu', description: '', photos: [] } as unknown as InspectionTask;
    expect(localPlannedTaskFromApi(api, catalog)).toMatchObject({ serverId: 10, catalogTaskId: undefined, name: 'Bruit essieu' });
  });
});

describe('lastWearByTask', () => {
  const summary = {
    tasks: [
      { catalog_task_id: 1, last_measurement: { level: 9, date: '2026-07-01', sheet_id: 1, km: null }, last_realization: { wear_level: 3, date: '2026-01-01' } },
      { catalog_task_id: 2, last_measurement: null, last_realization: { wear_level: 8, date: '2026-03-01' } },
      { catalog_task_id: 3, last_measurement: null, last_realization: { wear_level: null, date: '2026-03-01' } },
      { catalog_task_id: 4, last_measurement: null, last_realization: null },
    ],
  } as unknown as MaintenanceSummary;

  it('prefers the last measurement over the last realization', () => {
    expect(lastWearByTask(summary)[1]).toEqual({ level: 9, date: '2026-07-01' });
  });

  it('falls back to the wear level of the last realization', () => {
    expect(lastWearByTask(summary)[2]).toEqual({ level: 8, date: '2026-03-01' });
  });

  it('omits tasks without any known level, and an absent summary', () => {
    expect(Object.keys(lastWearByTask(summary))).toEqual(['1', '2']);
    expect(lastWearByTask(undefined)).toEqual({});
  });
});

describe('wearPerPageFor', () => {
  it('keeps two cards per page on a 640 px screen and falls back to one when the visible height shrinks', () => {
    expect(wearPerPageFor(667)).toBe(2);
    expect(wearPerPageFor(640)).toBe(2);
    expect(wearPerPageFor(599)).toBe(1);
    expect(wearPerPageFor(320)).toBe(1);
  });
});
