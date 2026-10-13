import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PublicUser } from '../users/public-user';
import { StartWorkoutDto } from '../workouts/dto/workout.dto';
import { WorkoutsService } from '../workouts/workouts.service';
import { Body, Post } from '@nestjs/common';

@ApiTags('zone-tests')
@Controller('zone-tests')
export class ZoneTestsController {
  constructor(
    private readonly workouts: WorkoutsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.prisma.zoneTest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { workout: { select: { startedAt: true, avgPowerW: true, endedAt: true } } },
    });
  }

  @Post()
  start(@CurrentUser() user: PublicUser, @Body() body: StartWorkoutDto) {
    return this.workouts.start(user.id, { ...body, kind: 'zone_test' });
  }
}
