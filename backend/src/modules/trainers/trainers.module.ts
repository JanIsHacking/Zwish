import { Module } from '@nestjs/common';
import { RidesModule } from '../rides/rides.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { TrainersController } from './trainers.controller';
import { TrainersService } from './trainers.service';

@Module({
  imports: [TelemetryModule, RidesModule],
  controllers: [TrainersController],
  providers: [TrainersService],
  exports: [TrainersService],
})
export class TrainersModule {}
