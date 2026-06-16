import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// zod-to-json-schema's generic return type triggers TS2589 (excessively deep)
// when handed a broad `ZodType`; call it through a simplified signature.
const toJsonSchema = zodToJsonSchema as (schema: unknown, options: unknown) => unknown;

/**
 * Convert a zod schema into an inlined OpenAPI 3 schema object, so Swagger docs
 * are generated from the same schemas used for runtime validation.
 */
export function openApiSchema(schema: ZodType): SchemaObject {
  return toJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as SchemaObject;
}
