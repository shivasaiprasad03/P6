import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,64}$/;

/**
 * Attaches a sanitized correlation ID (`X-Request-Id`) to every request/response
 * for traceability in production logs without trusting arbitrary client headers.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId =
    incoming && SAFE_REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : crypto.randomUUID();

  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
