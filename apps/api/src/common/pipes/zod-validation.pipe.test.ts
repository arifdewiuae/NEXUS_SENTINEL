import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ a: z.string(), nested: z.object({ b: z.number() }) });

describe('ZodValidationPipe', () => {
  it('returns the parsed value for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ a: 'x', nested: { b: 1 } })).toEqual({ a: 'x', nested: { b: 1 } });
  });

  it('throws a BadRequestException for invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('reports dotted issue paths and a problem title', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ a: 'x', nested: { b: 'not-a-number' } });
      expect.unreachable('should have thrown');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        title: string;
        issues: { path: string; message: string }[];
      };
      expect(body.title).toBe('Validation failed');
      expect(body.issues[0]?.path).toBe('nested.b');
      expect(body.issues[0]?.message).toBeTruthy();
    }
  });
});
