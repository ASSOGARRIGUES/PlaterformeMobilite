import { describe, it, expect } from 'vitest';
import { generateFilter } from '../providers/rest-data-provider/utils/generateFilter';

describe('generateFilter', () => {
  it('returns empty object when filters is undefined', () => {
    expect(generateFilter(undefined)).toEqual({});
  });

  it('returns empty object for empty array', () => {
    expect(generateFilter([])).toEqual({});
  });

  it('skips filter with falsy value', () => {
    const result = generateFilter([{ field: 'name', operator: 'eq', value: '' }]);
    expect(result).toEqual({});
  });

  it('handles eq operator (no suffix)', () => {
    const result = generateFilter([{ field: 'status', operator: 'eq', value: 'active' }]);
    expect(result).toEqual({ status: 'active' });
  });

  it('handles gte operator', () => {
    const result = generateFilter([{ field: 'price', operator: 'gte', value: '100' }]);
    expect(result).toEqual({ price__gte: '100' });
  });

  it('handles lte operator', () => {
    const result = generateFilter([{ field: 'price', operator: 'lte', value: '500' }]);
    expect(result).toEqual({ price__lte: '500' });
  });

  it('handles in operator with array', () => {
    const result = generateFilter([{ field: 'id', operator: 'in', value: [1, 2, 3] }]);
    expect(result).toEqual({ id__in: '1,2,3' });
  });

  it('throws for in operator with non-array value', () => {
    expect(() =>
      generateFilter([{ field: 'id', operator: 'in', value: '1,2,3' as any }])
    ).toThrow();
  });

  it('maps q field directly without operator suffix', () => {
    const result = generateFilter([{ field: 'q', operator: 'eq', value: 'search term' }]);
    expect(result).toEqual({ q: 'search term' });
  });

  it('handles or operator with eq sub-filters', () => {
    const result = generateFilter([
      {
        operator: 'or',
        value: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'type', operator: 'eq', value: 'car' },
        ],
      },
    ]);
    expect(result).toEqual({ status__or: 'active', type__or: 'car' });
  });

  it('throws for or operator with non-eq sub-filter', () => {
    expect(() =>
      generateFilter([
        {
          operator: 'or',
          value: [{ field: 'status', operator: 'ne', value: 'active' }],
        },
      ])
    ).toThrow('Only eq operator is supported for or operator');
  });

  it('throws for and operator', () => {
    expect(() => generateFilter([{ operator: 'and', value: [] }])).toThrow();
  });

  it('handles multiple filters', () => {
    const result = generateFilter([
      { field: 'status', operator: 'eq', value: 'active' },
      { field: 'price', operator: 'gte', value: '100' },
    ]);
    expect(result).toEqual({ status: 'active', price__gte: '100' });
  });
});
