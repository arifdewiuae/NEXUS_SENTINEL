import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/swagger';

/** Writes the committed OpenAPI spec from the live Nest metadata (no server).
 *  Emits two copies kept in lockstep: the canonical one beside the API, and a
 *  published copy under docs/ that GitHub Pages serves to the Redoc page. */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const document = buildOpenApiDocument(app);
  const json = `${JSON.stringify(document, null, 2)}\n`;
  const targets = [
    resolve(__dirname, '..', 'openapi.json'),
    resolve(__dirname, '..', '..', '..', 'docs', 'openapi.json'),
  ];
  for (const out of targets) {
    writeFileSync(out, json);
    process.stdout.write(`Wrote ${out}\n`);
  }
  await app.close();
}

void main();
