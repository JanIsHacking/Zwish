import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { SessionGuard } from './common/auth/session.guard';
import { AppConfigModule } from './config/config.module';
import { AppEnv, ENV } from './config/env';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BikesModule } from './modules/bikes/bikes.module';
import { CalibrationModule } from './modules/calibration/calibration.module';
import { HealthController } from './modules/health/health.controller';
import { PlansModule } from './modules/plans/plans.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { TrainersModule } from './modules/trainers/trainers.module';
import { UsersModule } from './modules/users/users.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { ZoneTestsModule } from './modules/zone-tests/zone-tests.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ENV],
      useFactory: (env: AppEnv) => ({
        pinoHttp: {
          redact: ['req.headers.cookie', 'req.body.password'],
          transport:
            env.nodeEnv === 'local'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BikesModule,
    TrainersModule,
    PlansModule,
    CalibrationModule,
    WorkoutsModule,
    ZoneTestsModule,
    TelemetryModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
