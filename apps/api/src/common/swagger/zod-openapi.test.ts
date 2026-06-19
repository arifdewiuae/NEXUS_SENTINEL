import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { openApiSchema } from './zod-openapi';

describe('openApiSchema', () => {
  it('converts a zod object into an inlined OpenAPI schema', () => {
    const schema = openApiSchema(z.object({ name: z.string(), age: z.number().optional() })) as {
      type: string;
      properties: Record<string, { type: string }>;
      required?: string[];
    };

    expect(schema.type).toBe('object');
    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.age.type).toBe('number');
    // Optional fields are not required.
    expect(schema.required).toEqual(['name']);
  });

  it('inlines schemas instead of emitting $ref ($refStrategy: none)', () => {
    const reused = z.object({ id: z.string() });
    const schema = openApiSchema(z.object({ a: reused, b: reused }));
    expect(JSON.stringify(schema)).not.toContain('$ref');
  });
});
