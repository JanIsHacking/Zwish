import { Module } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module';
import { ZoneTestsController } from './zone-tests.controller';

@Module({
  imports: [WorkoutsModule],
  controllers: [ZoneTestsController],
})
export class ZoneTestsModule {}
