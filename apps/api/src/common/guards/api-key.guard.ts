import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.module';

/**
 * Constant-time string equality. Hashing both sides to a fixed-width digest
 * first means we compare equal-length buffers (so `timingSafeEqual` never
 * throws) and the length of the secret doesn't leak through the comparison.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Optional API-key auth. When `API_KEY` is unset the endpoint is open (the
 * public demo); when set, every guarded route requires a matching `x-api-key`
 * header. Health checks are intentionally left open (see their controller).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('API_KEY');
    if (!expected) return true; // auth disabled

    const req = context.switchToHttp().getRequest<Request>();
    // Only the public API is guarded; health/docs stay open.
    if (!req.path.startsWith('/v1')) return true;

    // A repeated header arrives as string[]; only a single, matching value passes.
    const header = req.headers['x-api-key'];
    const provided = typeof header === 'string' ? header : undefined;
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException({
        title: 'Unauthorized',
        message: 'A valid x-api-key header is required.',
      });
    }
    return true;
  }
}
