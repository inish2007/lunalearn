/**
 * Centralized API Response & Standardized Error Handler
 * Enforces strict shape:
 * { success: boolean, data?: T, error?: { code, message, userMessage, retryable, requestId, issues? } }
 */

import http from 'http';
import crypto from 'crypto';
import { AppError, sanitizeErrorMessage, StandardApiResponse } from '../types/errors.js';
import { logger } from './logger.js';

export function getOrCreateRequestId(req: http.IncomingMessage): string {
  const existing = req.headers['x-request-id'];
  if (typeof existing === 'string' && existing.trim()) {
    return existing.trim();
  }
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

export function sendStandardSuccess<T>(
  res: http.ServerResponse,
  data: T,
  statusCode = 200,
  options?: { message?: string; count?: number; requestId?: string; headers?: Record<string, string> }
): void {
  const reqId = options?.requestId || `req_${crypto.randomBytes(8).toString('hex')}`;
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('Content-Type', 'application/json');

  if (options?.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      res.setHeader(k, v);
    }
  }

  const payload: any = {
    success: true,
    data
  };

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(payload, data);
    payload.success = true;
    payload.data = data;
  }

  if (options?.message) {
    payload.message = options.message;
  }
  if (typeof options?.count === 'number') {
    payload.count = options.count;
  }

  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

export function sendStandardError(
  res: http.ServerResponse,
  err: unknown,
  requestId?: string,
  extra?: { req?: http.IncomingMessage; statusCodeOverride?: number }
): void {
  const reqId = requestId || (extra?.req ? getOrCreateRequestId(extra.req) : `req_${crypto.randomBytes(8).toString('hex')}`);
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('Content-Type', 'application/json');

  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof Error) {
    // Check for common error signatures
    const msg = err.message || '';
    if (msg.includes('JWT') || msg.includes('token') || msg.includes('Unauthorized') || msg.includes('session')) {
      appError = AppError.unauthorized(msg);
    } else if (msg.includes('not found') || msg.includes('NotFound')) {
      appError = AppError.notFound(msg);
    } else if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('conflict')) {
      appError = AppError.conflict(msg);
    } else if (msg.includes('Payload too large') || msg.includes('exceeds')) {
      appError = AppError.payloadTooLarge(msg);
    } else {
      appError = AppError.internal(msg, err);
    }
  } else {
    appError = AppError.internal('An unexpected error occurred');
  }

  appError.requestId = reqId;
  const statusCode = extra?.statusCodeOverride || appError.statusCode;
  const safeMessage = sanitizeErrorMessage(appError.message);
  const safeUserMessage = sanitizeErrorMessage(appError.userMessage);

  // Structured Logging of error (full diagnostic retained on server)
  logger.error(safeMessage, {
    requestId: reqId,
    statusCode,
    errorCode: appError.code,
    error: err instanceof Error ? err : undefined,
    path: extra?.req?.url,
    method: extra?.req?.method
  });

  const responseBody: StandardApiResponse = {
    success: false,
    error: {
      code: appError.code,
      message: safeMessage,
      userMessage: safeUserMessage,
      retryable: appError.retryable,
      requestId: reqId,
      issues: appError.issues
    },
    // Backwards compatibility for existing clients expecting top-level message & issues
    message: safeMessage,
    issues: appError.issues
  };

  res.writeHead(statusCode);
  res.end(JSON.stringify(responseBody));
}
