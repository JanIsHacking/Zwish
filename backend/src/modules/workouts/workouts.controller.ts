import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PublicUser } from '../users/public-user';
import { SetupDto, StartWorkoutDto } from './dto/workout.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@Controller()
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get('setup')
  setup(@CurrentUser() user: PublicUser) {
    return this.workouts.setup(user.id);
  }

  @Put('setup')
  saveSetup(@CurrentUser() user: PublicUser, @Body() body: SetupDto) {
    return this.workouts.saveSetup(user.id, body);
  }

  @Get('workouts')
  list(@CurrentUser() user: PublicUser) {
    return this.workouts.list(user.id);
  }

  @Post('workouts')
  start(@CurrentUser() user: PublicUser, @Body() body: StartWorkoutDto) {
    return this.workouts.start(user.id, body);
  }

  @Get('workouts/:id')
  get(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.workouts.get(user.id, id);
  }

  @Post('workouts/:id/stop')
  stop(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.workouts.stop(user.id, id);
  }

  @Patch('workouts/:id/setup')
  patchSetup(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() body: SetupDto) {
    return this.workouts.saveSetup(user.id, body).then(async (setup) => {
      const workout = await this.workouts.get(user.id, id);
      return { setup, workoutId: workout.id };
    });
  }
}
