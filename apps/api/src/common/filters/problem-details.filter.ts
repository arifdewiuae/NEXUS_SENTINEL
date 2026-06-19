import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuditRecordNotFoundError,
  GuardrailUnavailableError,
  PolicyNotFoundError,
  RateLimitExceededError,
} from '../errors/domain-errors';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Maps every thrown error onto an RFC-9457 `application/problem+json` response.
 * Domain errors map to their HTTP status here, so the application core stays
 * free of HTTP concerns. SDK internals are never leaked to clients.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id ?? (req.headers['x-request-id'] as string | undefined);

    const problem = this.toProblem(exception);
    problem.requestId = requestId;

    if (problem.status >= 500) {
      this.logger.error(
        `${problem.status} ${problem.title}: ${problem.detail ?? ''}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (problem.status === 429 && typeof problem.retryAfterSeconds === 'number') {
      res.setHeader('Retry-After', String(problem.retryAfterSeconds));
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof PolicyNotFoundError || exception instanceof AuditRecordNotFoundError) {
      return { type: 'about:blank', title: 'Not Found', status: 404, detail: exception.message };
    }
    if (exception instanceof GuardrailUnavailableError) {
      return {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: exception.message,
      };
    }
    if (exception instanceof RateLimitExceededError) {
      return {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: `${exception.message}. Retry after ${exception.retryAfterSeconds}s.`,
        retryAfterSeconds: exception.retryAfterSeconds,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const base: ProblemDetails = {
        type: 'about:blank',
        title: HttpStatus[status] ?? 'Error',
        status,
      };
      if (typeof body === 'string') {
        base.detail = body;
      } else if (typeof body === 'object' && body !== null) {
        const {
          statusCode: _sc,
          error: _e,
          message,
          title,
          ...rest
        } = body as Record<string, unknown>;
        if (typeof title === 'string') base.title = title;
        base.detail = Array.isArray(message) ? message.join('; ') : (message as string | undefined);
        Object.assign(base, rest); // carry through extras like validation `issues`
      }
      return base;
    }
    // Unknown error → never leak internals.
    return { type: 'about:blank', title: 'Internal Server Error', status: 500 };
  }
}
