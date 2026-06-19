import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/util/cors';
import { AppConfigService } from './config/config.module';
import { buildOpenApiDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: resolveCorsOrigin(config.get('CORS_ORIGINS')),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-request-id', 'x-client-id'],
  });
  app.enableShutdownHooks();

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`Nexus Sentinel API listening on :${port} (provider=${config.get('PROVIDER')})`);
}

void bootstrap();
