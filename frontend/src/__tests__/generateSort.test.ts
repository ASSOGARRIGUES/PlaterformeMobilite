import { describe, it, expect } from 'vitest';
import { generateSort } from '../providers/rest-data-provider/utils/generateSort';

describe('generateSort', () => {
  it('returns undefined when sorters is undefined', () => {
    expect(generateSort(undefined)).toBeUndefined();
  });

  it('returns undefined when sorters is empty', () => {
    expect(generateSort([])).toBeUndefined();
  });

  it('generates ascending sort without prefix', () => {
    const result = generateSort([{ field: 'name', order: 'asc' }]);
    expect(result).toEqual({ ordering: ['name'] });
  });

  it('generates descending sort with - prefix', () => {
    const result = generateSort([{ field: 'name', order: 'desc' }]);
    expect(result).toEqual({ ordering: ['-name'] });
  });

  it('handles multiple sorters', () => {
    const result = generateSort([
      { field: 'name', order: 'asc' },
      { field: 'created_at', order: 'desc' },
    ]);
    expect(result).toEqual({ ordering: ['name', '-created_at'] });
  });
});
