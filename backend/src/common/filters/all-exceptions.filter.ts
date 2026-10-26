import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = HttpStatus[status] ?? String(status);
      } else if (res && typeof res === 'object') {
        const body = res as {
          code?: string;
          message?: string | string[];
          details?: unknown;
        };
        code = body.code ?? HttpStatus[status] ?? String(status);
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? exception.message);
        details = body.details;
      }
    } else if (exception instanceof QueryFailedError) {
      const driverCode = (exception as unknown as { code?: string }).code;
      if (driverCode === '23505' || driverCode === 'SQLITE_CONSTRAINT') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'A record with this value already exists.';
      } else if (driverCode === '23503') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'This record is in use and cannot be deleted.';
      } else {
        code = 'DATABASE_ERROR';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    });
  }
}