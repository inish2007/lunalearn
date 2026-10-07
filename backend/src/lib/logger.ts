/**
 * Production-Grade Structured Observability Logger
 * Formats logs with requestId, safeUserId, provider, latencyMs, and error tracking.
 */

import crypto from 'crypto';

export interface LogFields {
  requestId?: string;
  userId?: string;
  safeUserId?: string;
  provider?: string;
  latencyMs?: number;
  method?: string;
  path?: string;
  statusCode?: number;
  error?: string | Error;
  [key: string]: unknown;
}

/**
 * Creates an anonymized safe identifier from a user ID or token
 * to prevent PII exposure in centralized logging systems.
 */
export function getSafeUserId(userId?: string | null): string {
  if (!userId) return 'anonymous';
  
  // Anonymized deterministic hash prefix
  const hash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 10);
  return `usr_${hash}`;
}

export class Logger {
  private formatLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: LogFields) {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    if (fields) {
      if (fields.requestId) entry.requestId = fields.requestId;
      if (fields.userId || fields.safeUserId) {
        entry.safeUserId = fields.safeUserId || getSafeUserId(fields.userId);
      }
      if (fields.provider) entry.provider = fields.provider;
      if (typeof fields.latencyMs === 'number') entry.latencyMs = fields.latencyMs;
      if (fields.method) entry.method = fields.method;
      if (fields.path) entry.path = fields.path.split('?')[0];
      if (fields.statusCode) entry.statusCode = fields.statusCode;

      if (fields.error) {
        if (fields.error instanceof Error) {
          entry.error = {
            name: fields.error.name,
            message: process.env.NODE_ENV === 'production' ? 'Operation failed' : fields.error.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : fields.error.stack
          };
        } else {
          entry.error = String(fields.error);
        }
      }

      // Allow only operational metadata, never arbitrary request payloads.
      for (const key of ['errorCode', 'attempt', 'maxRetries', 'retryAfterSec']) {
        if (fields[key] !== undefined) entry[key] = fields[key];
      }
    }

    const jsonStr = JSON.stringify(entry);

    if (level === 'error') {
      console.error(jsonStr);
    } else if (level === 'warn') {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  }

  public info(message: string, fields?: LogFields) {
    this.formatLog('info', message, fields);
  }

  public warn(message: string, fields?: LogFields) {
    this.formatLog('warn', message, fields);
  }

  public error(message: string, fields?: LogFields) {
    this.formatLog('error', message, fields);
  }

  public debug(message: string, fields?: LogFields) {
    if (process.env.NODE_ENV !== 'production') {
      this.formatLog('debug', message, fields);
    }
  }
}

export const logger = new Logger();
