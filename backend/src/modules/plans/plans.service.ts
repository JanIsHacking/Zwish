import { Injectable } from '@nestjs/common';
import { DomainError } from '../../domain/access';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.trainingPlan.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { sessions: { orderBy: [{ weekIndex: 'asc' }, { dayOfWeek: 'asc' }] } },
    });
  }

  async get(userId: string, id: string) {
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: [{ weekIndex: 'asc' }, { dayOfWeek: 'asc' }],
          include: { segments: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!plan || plan.userId !== userId) {
      throw new DomainError('PLAN_NOT_FOUND', 404, 'Plan not found');
    }
    return plan;
  }
}
