import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const production = config.get<string>('nodeEnv') === 'production';

  // Sessions and authenticator secrets are signed/encrypted with this: a
  // missing or guessable value would let anyone mint a login
  const jwtSecret = config.get<string>('jwt.secret') ?? '';
  if (production && (jwtSecret.length < 32 || /change-me/.test(jwtSecret))) {
    throw new Error('JWT_SECRET must be a random value of at least 32 characters in production.');
  }

  // Nginx sits in front: take the visitor's address from its X-Forwarded-For,
  // so per-IP rate limits count real clients instead of the proxy
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));

  // Keep the raw bytes too: webhook signatures (e.g. Mobile Sasa) are computed over the exact body
  app.use(
    json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get<string[]>('corsOrigin'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kenya SME Platform API')
    .setDescription(
      'Business management API for Kenyan SMEs — sales, expenses, profit, customers, products, inventory.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  // The API map is for development; production keeps it private
  if (!production) {
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API listening on http://0.0.0.0:${port}${production ? '' : ` — Swagger: http://localhost:${port}/docs`}`,
    'Bootstrap',
  );
}

void bootstrap();
