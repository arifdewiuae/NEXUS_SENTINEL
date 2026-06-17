import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/swagger';

/** Writes the committed OpenAPI spec from the live Nest metadata (no server). */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const document = buildOpenApiDocument(app);
  const out = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`Wrote ${out}\n`);
}

void main();
