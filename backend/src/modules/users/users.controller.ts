import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PublicUser } from './public-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(AdminGuard)
  list(): Promise<PublicUser[]> {
    return this.users.list();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: CreateUserDto): Promise<PublicUser> {
    return this.users.createRider(body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() actor: PublicUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.users.deleteRider(actor.id, id);
    return { ok: true };
  }

  @Patch('me')
  updateMe(@CurrentUser() actor: PublicUser, @Body() body: UpdateProfileDto): Promise<PublicUser> {
    return this.users.updateProfile(actor.id, body);
  }
}
