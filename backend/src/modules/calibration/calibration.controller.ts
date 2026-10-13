import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PublicUser } from '../users/public-user';
import { CalibrationService } from './calibration.service';
import { SelectFitDto, StartCalibrationDto } from './dto/calibration.dto';

@ApiTags('calibrations')
@Controller('calibrations')
export class CalibrationController {
  constructor(private readonly calibration: CalibrationService) {}

  @Post()
  start(@CurrentUser() user: PublicUser, @Body() body: StartCalibrationDto) {
    return this.calibration.start(user.id, body);
  }

  @Get('active/:trainerId')
  active(@CurrentUser() user: PublicUser, @Param('trainerId') trainerId: string) {
    return this.calibration.activeForTrainer(user.id, trainerId);
  }

  @Get(':id')
  get(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.calibration.get(user.id, id);
  }

  @Post(':id/coast')
  beginCoast(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.calibration.beginCoast(user.id, id);
  }

  @Post(':id/capture')
  capture(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.calibration.capture(user.id, id);
  }

  @Post(':id/fit')
  selectFit(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() body: SelectFitDto) {
    return this.calibration.selectFit(user.id, id, body.kind);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.calibration.confirm(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.calibration.cancel(user.id, id);
  }
}
