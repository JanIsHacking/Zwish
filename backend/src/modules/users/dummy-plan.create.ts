import { Prisma } from '@prisma/client';
import { DUMMY_PLAN } from '../../domain/dummy-plan';

export function dummyPlanCreate(): Prisma.TrainingPlanCreateWithoutUserInput {
  return {
    name: DUMMY_PLAN.name,
    sessions: {
      create: DUMMY_PLAN.sessions.map((session) => ({
        weekIndex: session.weekIndex,
        dayOfWeek: session.dayOfWeek,
        name: session.name,
        segments: {
          create: session.segments.map((segment) => ({
            sortOrder: segment.sortOrder,
            durationSeconds: segment.durationSeconds,
            targetKind: segment.targetKind,
            zone: segment.zone,
            notes: segment.notes,
          })),
        },
      })),
    },
  };
}
