import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

/** The single OpenAPI definition, shared by the live `/docs` route and the
 *  `openapi` export script so the committed spec can never drift from runtime. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Nexus Sentinel')
    .setDescription('A self-hosted prompt firewall for any LLM. One endpoint: POST /v1/verify.')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  return SwaggerModule.createDocument(app, config);
}
