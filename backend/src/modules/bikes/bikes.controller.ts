import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PublicUser } from '../users/public-user';
import { BikesService } from './bikes.service';
import { BikeDto } from './dto/bike.dto';

@ApiTags('bikes')
@Controller('bikes')
export class BikesController {
  constructor(private readonly bikes: BikesService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.bikes.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: PublicUser, @Body() body: BikeDto) {
    return this.bikes.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.bikes.get(user.id, id);
  }

  @Put(':id')
  update(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() body: BikeDto) {
    return this.bikes.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: PublicUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.bikes.remove(user.id, id);
    return { ok: true };
  }
}
