import { describe, it, expect } from 'vitest';
import {
  groupMaintenanceTasks,
  sortedSignalements,
  clampProgress,
  formatDuration,
  axisPhrase,
  mainFigure,
  secondaryFigure,
  formatShortDate,
  sinceLabel,
  initials,
  sheetAuthor,
  maintenanceBadge,
  nextDueTask,
  showNothingToPlan,
  referentSummary,
  maintenanceInfo,
  filterOtherWork,
  toPlanReason,
} from '../components/garage/maintenance/maintenanceUtils';
import {
  MaintenanceSummary,
  MaintenanceTask,
  MaintenanceSignalement,
  MaintenanceSheet,
  MaintenanceOtherWork,
  MaintenanceCounts,
} from '../types/garage';
import {
  MaintenanceAxisEnum,
  MaintenanceSourceEnum,
  MaintenanceStatusEnum,
  InterventionSheetStatusEnum,
  IconEnum,
} from '../types/schema.d';
import { humanizeNumber } from '../constants';

function makeTask(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    catalog_task_id: 1,
    name: 'Vidange',
    icon: IconEnum.oil,
    periodicity: { km: 15000, months: null },
    is_critical: false,
    is_wear_task: false,
    status: MaintenanceStatusEnum.up_to_date,
    source: null,
    last_realization: { sheet_id: 41, task_id: 210, date: '2025-03-12', km: 62000, wear_level: null },
    km: { lifespan: 15000, due: 77000, remaining: 3000, progress: 0.8, soon: 2000 },
    months: null,
    main_axis: MaintenanceAxisEnum.km,
    signalements: [],
    ...overrides,
  };
}

function makeSignalement(overrides: Partial<MaintenanceSignalement> = {}): MaintenanceSignalement {
  return {
    task_id: 230,
    sheet_id: 44,
    sheet_date: '2026-09-12',
    catalog_task_id: null,
    name: 'Bruit train avant',
    description: '',
    source: MaintenanceSourceEnum.signalement,
    photos: [],
    ...overrides,
  };
}

function makeSheet(overrides: Partial<MaintenanceSheet> = {}): MaintenanceSheet {
  return {
    id: 44,
    status: InterventionSheetStatusEnum.validated,
    start_date: '2026-09-12',
    end_date: null,
    start_mileage: 84000,
    created_by_display: 'Jean Dupont',
    done_count: 3,
    planned_count: 1,
    ...overrides,
  };
}

function makeCounts(overrides: Partial<MaintenanceCounts> = {}): MaintenanceCounts {
  return { overdue: 0, to_plan: 0, up_to_date: 0, not_recorded: 0, other_work: 0, sheets: 0, ...overrides };
}

function makeSummary(overrides: Partial<MaintenanceSummary> = {}): MaintenanceSummary {
  return {
    vehicle_id: 12,
    current_km: 84200,
    today: '2026-10-01',
    tasks: [],
    signalements: [],
    other_work: [],
    sheets: [],
    counts: makeCounts(),
    ...overrides,
  };
}

const kmAxis = (remaining: number, progress: number) => ({ lifespan: 15000, due: 0, remaining, progress, soon: 2000 });
const monthsAxis = (remaining_days: number, progress: number) => ({
  lifespan: 12, due: '2027-01-01', remaining_days, progress, soon: 2,
});

describe('groupMaintenanceTasks', () => {
  it('groups tasks by status', () => {
    const summary = makeSummary({
      tasks: [
        makeTask({ name: 'A', status: MaintenanceStatusEnum.overdue }),
        makeTask({ name: 'B', status: MaintenanceStatusEnum.to_plan, source: MaintenanceSourceEnum.echeance }),
        makeTask({ name: 'C', status: MaintenanceStatusEnum.up_to_date }),
        makeTask({ name: 'D', status: MaintenanceStatusEnum.not_recorded, main_axis: null, km: null }),
      ],
    });
    const groups = groupMaintenanceTasks(summary);
    expect(groups.overdue.map((t) => t.name)).toEqual(['A']);
    expect(groups.toPlan.map((t) => t.name)).toEqual(['B']);
    expect(groups.upToDate.map((t) => t.name)).toEqual(['C']);
    expect(groups.notRecorded.map((t) => t.name)).toEqual(['D']);
  });

  it('sorts by raw (unclamped) progress of the main axis, most urgent first', () => {
    const summary = makeSummary({
      tasks: [
        makeTask({ name: 'Freins', status: MaintenanceStatusEnum.overdue, km: kmAxis(-500, 1.1) }),
        makeTask({ name: 'Courroie', status: MaintenanceStatusEnum.overdue, km: kmAxis(-4000, 1.3) }),
      ],
    });
    expect(groupMaintenanceTasks(summary).overdue.map((t) => t.name)).toEqual(['Courroie', 'Freins']);
  });

  it('uses the months axis progress when main_axis is months', () => {
    const summary = makeSummary({
      tasks: [
        makeTask({ name: 'A', km: kmAxis(100, 0.99), months: monthsAxis(100, 0.2), main_axis: MaintenanceAxisEnum.months }),
        makeTask({ name: 'B', km: kmAxis(5000, 0.5), main_axis: MaintenanceAxisEnum.km }),
      ],
    });
    expect(groupMaintenanceTasks(summary).upToDate.map((t) => t.name)).toEqual(['B', 'A']);
  });

  it('puts rows without progress last, then sorts by name ignoring accents', () => {
    const summary = makeSummary({
      tasks: [
        makeTask({ name: 'Freins', status: MaintenanceStatusEnum.to_plan, source: MaintenanceSourceEnum.signalement, km: null, main_axis: null }),
        makeTask({ name: 'Échappement', status: MaintenanceStatusEnum.to_plan, source: MaintenanceSourceEnum.signalement, km: null, main_axis: null }),
        makeTask({ name: 'Vidange', status: MaintenanceStatusEnum.to_plan, source: MaintenanceSourceEnum.echeance, km: kmAxis(1000, 0.9) }),
      ],
    });
    expect(groupMaintenanceTasks(summary).toPlan.map((t) => t.name)).toEqual(['Vidange', 'Échappement', 'Freins']);
  });

  it('sorts not recorded rows by name, accented names among the E', () => {
    const notRecorded = { status: MaintenanceStatusEnum.not_recorded, km: null, main_axis: null, last_realization: null };
    const summary = makeSummary({
      tasks: [
        makeTask({ ...notRecorded, name: 'Freins' }),
        makeTask({ ...notRecorded, name: 'Échappement' }),
        makeTask({ ...notRecorded, name: 'Amortisseurs' }),
      ],
    });
    expect(groupMaintenanceTasks(summary).notRecorded.map((t) => t.name)).toEqual(['Amortisseurs', 'Échappement', 'Freins']);
  });
});

describe('sortedSignalements', () => {
  it('sorts standalone signalements by sheet date, most recent first', () => {
    const summary = makeSummary({
      signalements: [
        makeSignalement({ task_id: 1, sheet_date: '2026-03-01' }),
        makeSignalement({ task_id: 2, sheet_date: '2026-09-12' }),
      ],
    });
    expect(sortedSignalements(summary).map((s) => s.task_id)).toEqual([2, 1]);
  });
});

describe('clampProgress', () => {
  it('clamps to [0, 1]', () => {
    expect(clampProgress(-0.2)).toBe(0);
    expect(clampProgress(1.4)).toBe(1);
    expect(clampProgress(0.5)).toBe(0.5);
  });
});

describe('formatDuration', () => {
  it('formats days, months below 730 days, then years', () => {
    expect(formatDuration(1)).toBe('1 jour');
    expect(formatDuration(10)).toBe('10 jours');
    expect(formatDuration(45)).toBe('1 mois');
    expect(formatDuration(100)).toBe('3 mois');
    expect(formatDuration(400)).toBe('13 mois');
    expect(formatDuration(729)).toBe('24 mois');
    expect(formatDuration(800)).toBe('2 ans');
    expect(formatDuration(1278)).toBe('3 ans');
  });

  it('formats the absolute value', () => {
    expect(formatDuration(-10)).toBe('10 jours');
  });
});

describe('sinceLabel', () => {
  it('says how long ago, from the server date', () => {
    expect(sinceLabel('2026-06-01', '2026-10-01')).toBe('il y a 4 mois');
    expect(sinceLabel('2026-10-01', '2026-10-01')).toBe("aujourd'hui");
  });
});

describe('initials / sheetAuthor', () => {
  it('builds initials', () => {
    expect(initials('Jean Dupont')).toBe('JD');
    expect(initials('karim')).toBe('K');
  });

  it('finds the author of a sheet', () => {
    const summary = makeSummary({ sheets: [makeSheet({ id: 44, created_by_display: 'Jean Dupont' })] });
    expect(sheetAuthor(summary, 44)).toBe('Jean Dupont');
    expect(sheetAuthor(summary, 1)).toBe('');
  });
});

describe('axisPhrase', () => {
  it('formats the km axis', () => {
    expect(axisPhrase(makeTask({ km: kmAxis(2000, 0.8) }), MaintenanceAxisEnum.km)).toBe(`dans ${humanizeNumber(2000)} km`);
    expect(axisPhrase(makeTask({ km: kmAxis(0, 1) }), MaintenanceAxisEnum.km)).toBe('échéance atteinte');
    expect(axisPhrase(makeTask({ km: kmAxis(-2000, 1.2) }), MaintenanceAxisEnum.km)).toBe(`${humanizeNumber(2000)} km de retard`);
  });

  it('formats the months axis', () => {
    expect(axisPhrase(makeTask({ months: monthsAxis(244, 0.3) }), MaintenanceAxisEnum.months)).toBe('dans 8 mois');
    expect(axisPhrase(makeTask({ months: monthsAxis(-91, 1.2) }), MaintenanceAxisEnum.months)).toBe('3 mois de retard');
    expect(axisPhrase(makeTask({ months: monthsAxis(0, 1) }), MaintenanceAxisEnum.months)).toBe('échéance atteinte');
  });

  it('returns null when the axis is missing', () => {
    expect(axisPhrase(makeTask({ months: null }), MaintenanceAxisEnum.months)).toBeNull();
  });
});

describe('mainFigure / secondaryFigure', () => {
  it('formats both axes', () => {
    const task = makeTask({ km: kmAxis(2000, 0.87), months: monthsAxis(244, 0.3), main_axis: MaintenanceAxisEnum.km });
    expect(mainFigure(task)).toBe(`dans ${humanizeNumber(2000)} km`);
    expect(secondaryFigure(task)).toBe('ou dans 8 mois');
  });

  it('uses « et » when both axes are overdue', () => {
    const task = makeTask({ km: kmAxis(-2000, 1.3), months: monthsAxis(-91, 1.2), main_axis: MaintenanceAxisEnum.km });
    expect(mainFigure(task)).toBe(`${humanizeNumber(2000)} km de retard`);
    expect(secondaryFigure(task)).toBe('et 3 mois');
    const byMonths = makeTask({ km: kmAxis(-2000, 1.1), months: monthsAxis(-91, 1.2), main_axis: MaintenanceAxisEnum.months });
    expect(secondaryFigure(byMonths)).toBe(`et ${humanizeNumber(2000)} km`);
  });

  it('says « échéance atteinte » when the secondary axis is exactly due', () => {
    const byKm = makeTask({ km: kmAxis(-800, 1.05), months: monthsAxis(0, 1), main_axis: MaintenanceAxisEnum.km });
    expect(secondaryFigure(byKm)).toBe('et échéance atteinte');
    const byMonths = makeTask({ km: kmAxis(0, 1), months: monthsAxis(-30, 1.1), main_axis: MaintenanceAxisEnum.months });
    expect(secondaryFigure(byMonths)).toBe('et échéance atteinte');
  });

  it('keeps the other axis as an alternative when only the main one is overdue', () => {
    const task = makeTask({ km: kmAxis(-800, 1.05), months: monthsAxis(244, 0.3), main_axis: MaintenanceAxisEnum.km });
    expect(secondaryFigure(task)).toBe('ou dans 8 mois');
  });

  it('has no secondary figure with a single axis', () => {
    const task = makeTask({ km: kmAxis(2000, 0.87), months: null });
    expect(mainFigure(task)).toBe(`dans ${humanizeNumber(2000)} km`);
    expect(secondaryFigure(task)).toBeNull();
  });

  it('returns null without main axis', () => {
    const task = makeTask({ km: null, main_axis: null });
    expect(mainFigure(task)).toBeNull();
    expect(secondaryFigure(task)).toBeNull();
  });
});

describe('formatShortDate', () => {
  it('omits the year when it is the current one', () => {
    expect(formatShortDate('2026-09-12', '2026-10-01')).toBe('12/09');
    expect(formatShortDate('2025-09-12', '2026-10-01')).toBe('12/09/2025');
  });
});

describe('maintenanceBadge', () => {
  it('returns null at 0', () => {
    expect(maintenanceBadge(makeCounts({ up_to_date: 4 }))).toBeNull();
  });

  it('is red with overdue', () => {
    expect(maintenanceBadge(makeCounts({ overdue: 2 }))).toEqual({ count: 2, color: 'red' });
    expect(maintenanceBadge(makeCounts({ overdue: 1, to_plan: 2 }))).toEqual({ count: 3, color: 'red' });
  });

  it('is orange with only to plan', () => {
    expect(maintenanceBadge(makeCounts({ to_plan: 3 }))).toEqual({ count: 3, color: 'orange' });
  });
});

describe('nextDueTask', () => {
  it('picks the up to date row with the highest progress', () => {
    const summary = makeSummary({
      tasks: [
        makeTask({ name: 'A', km: kmAxis(5000, 0.4) }),
        makeTask({ name: 'B', km: kmAxis(4000, 0.7) }),
        makeTask({ name: 'C', status: MaintenanceStatusEnum.overdue, km: kmAxis(-100, 1.1) }),
      ],
    });
    expect(nextDueTask(summary)?.name).toBe('B');
  });

  it('returns null without up to date rows', () => {
    expect(nextDueTask(makeSummary({ tasks: [makeTask({ status: MaintenanceStatusEnum.overdue })] }))).toBeNull();
  });
});

describe('showNothingToPlan', () => {
  it('is true when nothing is overdue or to plan and something is up to date', () => {
    expect(showNothingToPlan(makeSummary({ counts: makeCounts({ up_to_date: 3, sheets: 2 }) }))).toBe(true);
  });

  it('is false when every row is not recorded, even with sheets', () => {
    expect(showNothingToPlan(makeSummary({ sheets: [makeSheet()], counts: makeCounts({ not_recorded: 5, sheets: 1 }) }))).toBe(false);
  });

  it('is false with something to plan', () => {
    expect(showNothingToPlan(makeSummary({ counts: makeCounts({ up_to_date: 3, to_plan: 1 }) }))).toBe(false);
  });
});

describe('referentSummary', () => {
  it('is null when nothing is to do', () => {
    expect(referentSummary(makeSummary({ counts: makeCounts({ up_to_date: 3 }) }))).toBeNull();
  });

  it('is red with overdue tasks, mentioning critical ones and what is coming', () => {
    const summary = makeSummary({
      tasks: [makeTask({ name: 'Distribution', status: MaintenanceStatusEnum.overdue, is_critical: true })],
      signalements: [makeSignalement()],
      counts: makeCounts({ overdue: 2, to_plan: 3 }),
    });
    expect(referentSummary(summary)).toEqual({
      color: 'red',
      title: '2 entretiens en retard.',
      detail: 'Tâche critique : distribution · 2 à faire bientôt · 1 signalement à vérifier.',
    });
  });

  it('is orange when only things to plan', () => {
    expect(referentSummary(makeSummary({ counts: makeCounts({ to_plan: 1 }) }))).toEqual({
      color: 'orange', title: 'Entretien à prévoir prochainement.', detail: '1 à faire bientôt.',
    });
  });
});

describe('maintenanceInfo', () => {
  it('says there is no history without sheet', () => {
    expect(maintenanceInfo(makeSummary())).toEqual({ kind: 'noHistory' });
  });

  it('says up to date when nothing is to plan', () => {
    expect(maintenanceInfo(makeSummary({ sheets: [makeSheet()], counts: makeCounts({ up_to_date: 2 }) }))).toEqual({ kind: 'upToDate' });
  });

  it('says not recorded when nothing is overdue, to plan nor up to date', () => {
    expect(maintenanceInfo(makeSummary({ sheets: [makeSheet()], counts: makeCounts({ not_recorded: 3 }) }))).toEqual({ kind: 'notRecorded' });
  });

  it('lists coloured counts, omitting zeros', () => {
    expect(maintenanceInfo(makeSummary({ sheets: [makeSheet()], counts: makeCounts({ overdue: 2, to_plan: 1 }) }))).toEqual({
      kind: 'items', items: [{ color: 'red', label: '2 dépassés' }, { color: 'orange', label: '1 à prévoir' }],
    });
    expect(maintenanceInfo(makeSummary({ sheets: [makeSheet()], counts: makeCounts({ overdue: 1 }) }))).toEqual({
      kind: 'items', items: [{ color: 'red', label: '1 dépassé' }],
    });
  });
});

describe('filterOtherWork', () => {
  const items: MaintenanceOtherWork[] = [
    { key: 'free:echappement', catalog_task_id: null, icon: null, name: 'Échappement', sheet_id: 1, task_id: 1, date: '2026-02-02', km: 70000, wear_level: null },
    { key: 'free:pneus', catalog_task_id: null, icon: null, name: 'Pneus', sheet_id: 2, task_id: 2, date: '2026-01-02', km: 69000, wear_level: 8 },
  ];

  it('ignores case and accents', () => {
    expect(filterOtherWork(items, 'echappement').map((i) => i.name)).toEqual(['Échappement']);
    expect(filterOtherWork(items, 'PNEU').map((i) => i.name)).toEqual(['Pneus']);
  });

  it('returns everything for an empty query', () => {
    expect(filterOtherWork(items, '  ')).toHaveLength(2);
  });
});

describe('toPlanReason', () => {
  const toPlan = (overrides: Partial<MaintenanceTask>) => makeTask({ status: MaintenanceStatusEnum.to_plan, ...overrides });

  it('reads the source of a to_plan task', () => {
    expect(toPlanReason(toPlan({ source: MaintenanceSourceEnum.echeance }))).toBe('echeance');
    expect(toPlanReason(toPlan({ source: MaintenanceSourceEnum.signalement, signalements: [makeSignalement()] }))).toBe('signalement');
    expect(toPlanReason(toPlan({
      source: MaintenanceSourceEnum.usure,
      last_realization: { sheet_id: 41, task_id: 210, date: '2025-03-12', km: 62000, wear_level: 4 },
    }))).toBe('usure');
  });

  it('falls back to echeance for usure without wear level or signalement without signalement', () => {
    expect(toPlanReason(toPlan({ source: MaintenanceSourceEnum.usure }))).toBe('echeance');
    expect(toPlanReason(toPlan({ source: MaintenanceSourceEnum.signalement }))).toBe('echeance');
  });

  it('highlights nothing outside of to_plan', () => {
    expect(toPlanReason(makeTask({ status: MaintenanceStatusEnum.overdue }))).toBeNull();
    expect(toPlanReason(makeTask())).toBeNull();
  });
});
