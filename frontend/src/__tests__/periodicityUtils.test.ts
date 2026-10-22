import { describe, it, expect } from 'vitest';
import { periodicityLabel, catalogPeriodicityLabel } from '../components/garage/periodicityUtils';
import { TaskCatalogItem } from '../components/garage/taskCardUtils';
import { humanizeNumber } from '../constants';

describe('periodicityLabel', () => {
  it('formats km alone', () => {
    expect(periodicityLabel({ km: 15000, months: null })).toBe(`Tous les ${humanizeNumber(15000)} km`);
  });

  it('uses months below a full year and years for multiples of 12', () => {
    expect(periodicityLabel({ km: null, months: 6 })).toBe('Tous les 6 mois');
    expect(periodicityLabel({ km: null, months: 12 })).toBe('Tous les ans');
    expect(periodicityLabel({ km: null, months: 1 })).toBe('Tous les mois');
    expect(periodicityLabel({ km: null, months: 18 })).toBe('Tous les 18 mois');
    expect(periodicityLabel({ km: null, months: 24 })).toBe('Tous les 2 ans');
  });

  it('joins both axes with « ou »', () => {
    expect(periodicityLabel({ km: 15000, months: 12 })).toBe(`Tous les ${humanizeNumber(15000)} km ou 1 an`);
    expect(periodicityLabel({ km: 120000, months: 60 })).toBe(`Tous les ${humanizeNumber(120000)} km ou 5 ans`);
  });

  it('returns null without periodicity', () => {
    expect(periodicityLabel({ km: null, months: null })).toBeNull();
    expect(periodicityLabel({})).toBeNull();
  });
});

describe('catalogPeriodicityLabel', () => {
  it('reads the catalog periodicity fields', () => {
    const task = { id: 1, name: 'Vidange', km_periodicity: 10000, month_periodicity: 12 } as TaskCatalogItem;
    expect(catalogPeriodicityLabel(task)).toBe(`Tous les ${humanizeNumber(10000)} km ou 1 an`);
    expect(catalogPeriodicityLabel({ id: 2, name: 'x' } as TaskCatalogItem)).toBeUndefined();
  });
});
