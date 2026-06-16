import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.module';

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

    const provided = req.headers['x-api-key'];
    if (provided !== expected) {
      throw new UnauthorizedException({
        title: 'Unauthorized',
        message: 'A valid x-api-key header is required.',
      });
    }
    return true;
  }
}
