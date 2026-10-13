import { Module } from '@nestjs/common';
import { CalibrationModule } from '../calibration/calibration.module';
import { RidesModule } from '../rides/rides.module';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [RidesModule, CalibrationModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
