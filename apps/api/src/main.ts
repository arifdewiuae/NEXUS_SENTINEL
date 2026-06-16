import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-request-id'],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexus Sentinel')
    .setDescription('A self-hosted prompt firewall for any LLM. One endpoint: POST /v1/verify.')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`Nexus Sentinel API listening on :${port} (provider=${config.get('PROVIDER')})`);
}

void bootstrap();
