import { HttpException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/http-exception.filter';
import { AppEnv, ENV } from './config/env';
import { RealtimeService } from './modules/telemetry/realtime.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get<AppEnv>(ENV);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({ origin: env.webOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const message = errors.flatMap((error) => Object.values(error.constraints ?? {})).join(', ');
        return new HttpException(message || 'Invalid request', 422);
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  if (env.nodeEnv === 'local') {
    const config = new DocumentBuilder().setTitle('Zwish').setVersion('1').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
  await app.listen(env.port);
  const server = app.getHttpServer() as Server;
  app.get(RealtimeService).attach(server);
}

void bootstrap();
