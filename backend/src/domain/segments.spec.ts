import { segmentAt } from './segments';

describe('segments', () => {
  const segments = [
    { durationSeconds: 10, targetKind: 'power' as const, zone: 2, notes: 'seated' },
    { durationSeconds: 5, targetKind: 'power' as const, zone: 4, notes: null },
  ];

  it('walks the plan clock', () => {
    const current = segmentAt(segments, 12);
    expect(current?.index).toBe(1);
    expect(current?.zone).toBe(4);
    expect(current?.finished).toBe(false);
  });

  it('marks the workout finished after the last segment', () => {
    expect(segmentAt(segments, 20)?.finished).toBe(true);
  });
});
