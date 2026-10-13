import { Injectable } from '@nestjs/common';
import { DomainError } from '../../domain/access';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BikeDto } from './dto/bike.dto';

const bikeCount = { _count: { select: { workouts: true } } } as const;

@Injectable()
export class BikesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const bikes = await this.prisma.bike.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: bikeCount,
    });
    return bikes.map((bike) => this.view(bike));
  }

  async get(userId: string, id: string) {
    return this.view(await this.findOwned(userId, id));
  }

  async create(userId: string, input: BikeDto) {
    const bike = await this.prisma.bike.create({
      data: { userId, ...input, name: input.name.trim() },
      include: bikeCount,
    });
    return this.view(bike);
  }

  async update(userId: string, id: string, input: BikeDto) {
    await this.findOwned(userId, id);
    const bike = await this.prisma.bike.update({
      where: { id },
      data: { ...input, name: input.name.trim() },
      include: bikeCount,
    });
    return this.view(bike);
  }

  async remove(userId: string, id: string): Promise<void> {
    const bike = await this.findOwned(userId, id);
    if (bike._count.workouts > 0) {
      throw new DomainError('BIKE_IN_USE', 409, 'This bike has recorded rides and cannot be deleted');
    }
    await this.prisma.bike.delete({ where: { id } });
  }

  private async findOwned(userId: string, id: string) {
    const bike = await this.prisma.bike.findUnique({ where: { id }, include: bikeCount });
    if (!bike || bike.userId !== userId) {
      throw new DomainError('BIKE_NOT_FOUND', 404, 'Bike not found');
    }
    return bike;
  }

  private view(bike: {
    id: string;
    name: string;
    wheelCircumferenceMm: number;
    chainringTeeth: number[];
    cogTeeth: number[];
    _count: { workouts: number };
  }) {
    return {
      id: bike.id,
      name: bike.name,
      wheelCircumferenceMm: bike.wheelCircumferenceMm,
      chainringTeeth: bike.chainringTeeth,
      cogTeeth: bike.cogTeeth,
      rideCount: bike._count.workouts,
    };
  }
}
