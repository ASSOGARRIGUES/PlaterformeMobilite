import { describe, it, expect, vi, afterEach } from 'vitest';
import { computePartsSubtotal, buildTaskPickerRows, newLocalId, TaskCatalogItem } from '../components/garage/taskCardUtils';

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

describe('newLocalId', () => {
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses crypto.randomUUID when available', () => {
    expect(newLocalId()).toMatch(uuidV4);
  });

  it('falls back to getRandomValues outside a secure context (no randomUUID)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const first = newLocalId();
    expect(first).toMatch(uuidV4);
    expect(newLocalId()).not.toBe(first);
  });
});
