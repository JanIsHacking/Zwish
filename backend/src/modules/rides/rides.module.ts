import { Module } from '@nestjs/common';
import { RideRegistry } from './ride-registry';
import { ChartWriter } from './chart-writer';

@Module({
  providers: [RideRegistry, ChartWriter],
  exports: [RideRegistry, ChartWriter],
})
export class RidesModule {}
