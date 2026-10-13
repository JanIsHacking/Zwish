import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalibrationModule } from '../calibration/calibration.module';
import { RidesModule } from '../rides/rides.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { DevicePresence } from './device-presence';
import { DeviceTrace } from './device-trace';
import { ActivationBus } from './activation-bus';
import { ActivationLog } from './activation-log';
import { ActivationMetrics } from './activation-metrics';
import { RealtimeService } from './realtime.service';
import { SampleGate } from './sample-gate';

@Module({
  imports: [AuthModule, CalibrationModule, RidesModule, WorkoutsModule],
  providers: [DevicePresence, DeviceTrace, ActivationBus, SampleGate, ActivationLog, ActivationMetrics, RealtimeService],
  exports: [DevicePresence, DeviceTrace, RealtimeService],
})
export class TelemetryModule {}
