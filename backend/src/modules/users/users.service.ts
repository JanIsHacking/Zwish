import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../domain/access';
import { hashPassword } from '../../common/auth/password';
import { AppEnv, ENV } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { dummyPlanCreate } from './dummy-plan.create';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { asHrZones, PublicUser } from './public-user';

interface UserRow {
  id: string;
  name: string;
  role: string;
  ftpWatts: number | null;
  hrZoneBounds: Prisma.JsonValue | null;
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.user.findFirst({ where: { role: 'admin' } });
    if (existing) {
      return;
    }
    if (!this.env.adminPassword) {
      throw new Error('ADMIN_PASSWORD is required to seed the initial admin');
    }
    await this.prisma.user.create({
      data: {
        name: this.env.adminUsername,
        passwordHash: await hashPassword(this.env.adminPassword),
        role: 'admin',
        setup: { create: {} },
        plans: { create: dummyPlanCreate() },
      },
    });
  }

  toPublic(user: UserRow): PublicUser {
    return {
      id: user.id,
      name: user.name,
      role: user.role === 'admin' ? 'admin' : 'rider',
      ftpWatts: user.ftpWatts,
      hrZoneBounds: asHrZones(user.hrZoneBounds),
    };
  }

  async list(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map((user) => this.toPublic(user));
  }

  async createRider(input: CreateUserDto): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          passwordHash: await hashPassword(input.password),
          role: 'rider',
          setup: { create: {} },
          plans: { create: dummyPlanCreate() },
        },
      });
      return this.toPublic(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('USER_NAME_TAKEN', 409, 'That name is already in use');
      }
      throw error;
    }
  }

  async deleteRider(actorId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new DomainError('USER_NOT_FOUND', 404, 'User not found');
    }
    if (user.role === 'admin' || user.id === actorId) {
      throw new DomainError('CANNOT_DELETE_ADMIN', 409, 'The admin account cannot be deleted');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async updateProfile(userId: string, input: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ftpWatts: input.ftpWatts === undefined ? undefined : input.ftpWatts,
        hrZoneBounds:
          input.hrZoneBounds === undefined
            ? undefined
            : (input.hrZoneBounds as unknown as Prisma.InputJsonValue),
      },
    });
    return this.toPublic(user);
  }
}
