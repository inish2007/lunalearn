/**
 * Production-Grade In-Memory Sliding-Window Rate Limiter
 * Protects sensitive endpoints (Auth, Chat, Quiz Gen, Uploads).
 */

import http from 'http';
import { AppError } from '../types/errors.js';
import { sendStandardError } from '../lib/response.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RequestRecord {
  timestamps: number[];
}

class RateLimiter {
  private store: Map<string, RequestRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically clean up stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        record.timestamps = record.timestamps.filter(t => now - t < 300000);
        if (record.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }, 300000);
    this.cleanupInterval.unref();
  }

  public checkLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter(t => t > windowStart);

    if (record.timestamps.length >= config.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterMs = oldest + config.windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: config.maxRequests - record.timestamps.length,
      retryAfterSec: 0
    };
  }
}

export const rateLimiter = new RateLimiter();

// Endpoint rate limit configurations
const ROUTE_LIMITS: { pattern: RegExp; config: RateLimitConfig }[] = [
  { pattern: /^\/api\/auth\/(login|signup)$/, config: { windowMs: 60000, maxRequests: 15 } },
  { pattern: /^\/api\/assistant\/chat$/, config: { windowMs: 60000, maxRequests: 30 } },
  { pattern: /^\/api\/quiz\/generate$/, config: { windowMs: 60000, maxRequests: 20 } },
  { pattern: /^\/api\/rag\/upload$/, config: { windowMs: 60000, maxRequests: 15 } }
];

export function applyRateLimiter(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  for (const route of ROUTE_LIMITS) {
    if (route.pattern.test(pathname)) {
      // Key on IP or Authorization token
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown-ip';
      const authHeader = req.headers['authorization'] || '';
      const key = `${pathname}:${authHeader ? authHeader.slice(-16) : clientIp}`;

      const { allowed, remaining, retryAfterSec } = rateLimiter.checkLimit(key, route.config);

      res.setHeader('X-RateLimit-Limit', route.config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());

      if (!allowed) {
        res.setHeader('Retry-After', retryAfterSec.toString());
        sendStandardError(
          res,
          AppError.rateLimited(`Rate limit exceeded on ${pathname}`, retryAfterSec),
          undefined,
          { req, statusCodeOverride: 429 }
        );
        return false; // Request blocked
      }
    }
  }

  return true; // Request allowed
}
