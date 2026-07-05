import { describe, it, expect } from 'vitest';
import { computePartsSubtotal, buildTaskPickerRows, isWearLevelCritical, TaskCatalogItem } from '../components/garage/taskCardUtils';

describe('computePartsSubtotal', () => {
  it('returns 0 for an empty list', () => {
    expect(computePartsSubtotal([])).toBe(0);
  });

  it('computes the total for a single line', () => {
    expect(computePartsSubtotal([{ localId: '1', name: 'Plaquette', unitPrice: 25, quantity: 2 }])).toBe(50);
  });

  it('sums several lines with quantities > 1', () => {
    const parts = [
      { localId: '1', name: 'Plaquette', unitPrice: 25, quantity: 2 },
      { localId: '2', name: 'Disque', unitPrice: 40, quantity: 1 },
      { localId: '3', name: 'Liquide de frein', unitPrice: 10, quantity: 3 },
    ];
    expect(computePartsSubtotal(parts)).toBe(25 * 2 + 40 * 1 + 10 * 3);
  });
});

describe('buildTaskPickerRows', () => {
  const catalog: TaskCatalogItem[] = [
    { id: 1, name: 'Plaquettes de frein', vehicle_types: ['voiture'] },
    { id: 2, name: 'Vidange', vehicle_types: ['voiture', 'scouter'] },
  ] as TaskCatalogItem[];

  it('returns every catalog task plus the free task row when the query is empty', () => {
    const rows = buildTaskPickerRows(catalog, '');
    expect(rows).toHaveLength(3);
    expect(rows[rows.length - 1]).toEqual({ kind: 'free' });
  });

  it('filters catalog tasks by name, case-insensitively', () => {
    const rows = buildTaskPickerRows(catalog, 'PLAQUETTE');
    const catalogRows = rows.filter((row) => row.kind === 'catalog');
    expect(catalogRows).toHaveLength(1);
    expect(catalogRows[0]).toMatchObject({ kind: 'catalog', task: { name: 'Plaquettes de frein' } });
  });

  it('always keeps the free task row last, regardless of the search query', () => {
    const rows = buildTaskPickerRows(catalog, 'aucune tâche ne correspond');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ kind: 'free' });
  });
});

describe('isWearLevelCritical', () => {
  it('uses 3 as the default threshold', () => {
    expect(isWearLevelCritical(3)).toBe(true);
    expect(isWearLevelCritical(4)).toBe(false);
  });

  it('includes the threshold value itself (<=)', () => {
    expect(isWearLevelCritical(3, 3)).toBe(true);
  });

  it('accepts an explicit custom threshold', () => {
    expect(isWearLevelCritical(5, 6)).toBe(true);
    expect(isWearLevelCritical(7, 6)).toBe(false);
  });
});
