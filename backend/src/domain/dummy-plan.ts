export interface DummySegment {
  sortOrder: number;
  durationSeconds: number;
  targetKind: 'power' | 'heart_rate';
  zone: number;
  notes: string | null;
}

export interface DummySession {
  weekIndex: number;
  dayOfWeek: number;
  name: string;
  segments: DummySegment[];
}

export interface DummyPlan {
  name: string;
  sessions: DummySession[];
}

function segment(
  sortOrder: number,
  durationSeconds: number,
  zone: number,
  notes: string | null = null,
): DummySegment {
  return { sortOrder, durationSeconds, targetKind: 'power', zone, notes };
}

const intervalBlock: DummySegment[] = [
  segment(0, 10 * 60, 2, 'Stay seated'),
  ...Array.from({ length: 5 }, (_, index) => [
    segment(1 + index * 2, 3 * 60, 4, index === 0 ? 'Hard, stay smooth' : null),
    segment(2 + index * 2, 2 * 60, 1, 'Easy spin'),
  ]).flat(),
  segment(11, 10 * 60, 2, null),
];

export const DUMMY_PLAN: DummyPlan = {
  name: 'Base (dummy)',
  sessions: [
    {
      weekIndex: 1,
      dayOfWeek: 2,
      name: 'Endurance',
      segments: [segment(0, 45 * 60, 2, 'Stay seated')],
    },
    {
      weekIndex: 1,
      dayOfWeek: 4,
      name: 'Intervals',
      segments: intervalBlock,
    },
    {
      weekIndex: 2,
      dayOfWeek: 2,
      name: 'Endurance',
      segments: [segment(0, 40 * 60, 2, 'Stay seated')],
    },
    {
      weekIndex: 2,
      dayOfWeek: 6,
      name: 'Steady with standing',
      segments: [segment(0, 30 * 60, 2, 'Ride standing for the last minute of each 10')],
    },
  ],
};
