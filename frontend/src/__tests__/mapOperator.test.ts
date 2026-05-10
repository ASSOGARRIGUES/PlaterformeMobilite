import { describe, it, expect } from 'vitest';
import { mapOperator } from '../providers/rest-data-provider/utils/mapOperator';

describe('mapOperator', () => {
  it.each([
    ['ne', '__ne'],
    ['gte', '__gte'],
    ['lte', '__lte'],
    ['lt', '__lt'],
    ['gt', '__gt'],
    ['in', '__in'],
  ] as const)('maps %s to %s', (op, expected) => {
    expect(mapOperator(op)).toBe(expected);
  });

  it('maps contains to _like', () => {
    expect(mapOperator('contains')).toBe('_like');
  });

  it('maps eq to empty string (default)', () => {
    expect(mapOperator('eq')).toBe('');
  });

  it('maps unrecognized operator to empty string', () => {
    expect(mapOperator('null' as any)).toBe('');
  });
});
