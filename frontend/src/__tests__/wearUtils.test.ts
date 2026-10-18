import { describe, it, expect } from 'vitest';
import { wearZoneKey, wearSegmentValues, wearTrackBands, WEAR_ZONES } from '../components/garage/wearUtils';

const cfg = (critical: number, alert: number) => ({ wear_critical_threshold: critical, wear_alert_threshold: alert });

describe('wearZoneKey', () => {
  it('returns null when there is no measurement', () => {
    expect(wearZoneKey(null, cfg(2, 5))).toBeNull();
    expect(wearZoneKey(undefined, cfg(2, 5))).toBeNull();
  });

  it('classifies by zone with inclusive thresholds (<=)', () => {
    const c = cfg(2, 5);
    expect(wearZoneKey(0, c)).toBe('critical');
    expect(wearZoneKey(2, c)).toBe('critical');
    expect(wearZoneKey(3, c)).toBe('watch');
    expect(wearZoneKey(5, c)).toBe('watch');
    expect(wearZoneKey(6, c)).toBe('good');
    expect(wearZoneKey(10, c)).toBe('good');
  });

  it('follows a changed configuration (3/6): a level of 3 becomes critical, 6 stays watch', () => {
    const c = cfg(3, 6);
    expect(wearZoneKey(3, c)).toBe('critical');
    expect(wearZoneKey(6, c)).toBe('watch');
    expect(wearZoneKey(7, c)).toBe('good');
  });
});

describe('wearSegmentValues', () => {
  it('stores the middle of each zone: 1 / 4 / 8 for the default 2/5', () => {
    expect(wearSegmentValues(cfg(2, 5))).toEqual({ critical: 1, watch: 4, good: 8 });
  });

  it('handles other configurations', () => {
    expect(wearSegmentValues(cfg(3, 6))).toEqual({ critical: 1, watch: 5, good: 8 });
    expect(wearSegmentValues(cfg(0, 1))).toEqual({ critical: 0, watch: 1, good: 6 });
    expect(wearSegmentValues(cfg(4, 5))).toEqual({ critical: 2, watch: 5, good: 8 });
  });

  it('every value falls back into its own zone for any valid configuration (0 <= C < A < 10)', () => {
    for (let critical = 0; critical < 10; critical++) {
      for (let alert = critical + 1; alert < 10; alert++) {
        const c = cfg(critical, alert);
        const values = wearSegmentValues(c);
        expect(wearZoneKey(values.critical, c), `${critical}/${alert} critical`).toBe('critical');
        expect(wearZoneKey(values.watch, c), `${critical}/${alert} watch`).toBe('watch');
        expect(wearZoneKey(values.good, c), `${critical}/${alert} good`).toBe('good');
      }
    }
  });
});

describe('wearTrackBands', () => {
  it('places the borders at threshold + 0.5 as a share of the 0-10 track', () => {
    expect(wearTrackBands(cfg(2, 5))).toEqual([
      { zone: 'critical', from: 0, to: 25 },
      { zone: 'watch', from: 25, to: 55 },
      { zone: 'good', from: 55, to: 100 },
    ]);
  });

  it('moves with the configuration', () => {
    const bands = wearTrackBands(cfg(3, 6));
    expect(bands[0].to).toBe(35);
    expect(bands[1].to).toBe(65);
  });
});

describe('WEAR_ZONES', () => {
  it('has a label for each zone', () => {
    expect(WEAR_ZONES.critical.label).toBe('Critique');
    expect(WEAR_ZONES.watch.label).toBe('À surveiller');
    expect(WEAR_ZONES.good.label).toBe('Bon état');
  });
});
