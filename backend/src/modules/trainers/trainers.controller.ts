import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PublicUser } from '../users/public-user';
import { CreateTrainerDto, SetInertiaDto, UpdateTrainerDto } from './dto/trainer.dto';
import { TrainersService } from './trainers.service';

@ApiTags('trainers')
@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainers: TrainersService) {}

  @Get()
  list() {
    return this.trainers.list();
  }

  @Post()
  create(@Body() body: CreateTrainerDto) {
    return this.trainers.create(body);
  }

  @Get(':id/trace')
  trace(@Param('id') id: string) {
    return this.trainers.trace(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.trainers.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTrainerDto) {
    return this.trainers.update(id, body);
  }

  @Put(':id/inertia')
  setInertia(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() body: SetInertiaDto,
  ) {
    return this.trainers.setInertia(user.id, id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.trainers.remove(id);
    return { ok: true };
  }
}
