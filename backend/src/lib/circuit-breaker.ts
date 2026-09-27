/**
 * Production-Grade Circuit Breaker & Exponential Backoff Resilience Utility
 * Prevents cascading dependency failures and manages transient retry loops.
 */

import { AppError } from '../types/errors.js';
import { logger } from './logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;     // Number of failures before tripping (default: 5)
  recoveryTimeoutMs?: number;    // Time to wait in OPEN state before trying HALF_OPEN (default: 30000ms)
  halfOpenSuccessThreshold?: number; // Successes in HALF_OPEN before resetting to CLOSED (default: 2)
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCountInHalfOpen = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCountInHalfOpen = 0;
        logger.info(`Circuit breaker [${this.name}] transition OPEN -> HALF_OPEN (testing recovery)`);
      }
    }
    return this.state;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCountInHalfOpen++;
      if (this.successCountInHalfOpen >= this.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCountInHalfOpen = 0;
        logger.info(`Circuit breaker [${this.name}] transition HALF_OPEN -> CLOSED (recovered)`);
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  public recordFailure(err: unknown): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker [${this.name}] tripped to OPEN state (failures: ${this.failureCount})`, {
        provider: this.name,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        logger.warn(`Circuit breaker [${this.name}] is OPEN. Executing fallback.`);
        return await fallback();
      }
      throw AppError.circuitBreakerOpen(this.name);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err: unknown) {
      this.recordFailure(err);
      if (fallback) {
        logger.warn(`Execution failed for [${this.name}], falling back.`);
        return await fallback();
      }
      throw err;
    }
  }
}

/**
 * Exponential backoff with jitter for transient external errors (429, 503, 504).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 4000;
  const opName = options.operationName || 'Operation';

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      const isTransient = options.shouldRetry
        ? options.shouldRetry(err)
        : isTransientError(err);

      if (attempt > maxRetries || !isTransient) {
        throw err;
      }

      // Add full jitter: random value between 0 and delay
      const jitter = Math.random() * delay * 0.3;
      const totalDelay = Math.min(delay + jitter, maxDelayMs);

      logger.warn(`Transient error in [${opName}]. Retrying attempt ${attempt}/${maxRetries} after ${Math.round(totalDelay)}ms`, {
        error: err?.message || String(err)
      });

      await new Promise(resolve => setTimeout(resolve, totalDelay));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}

/**
 * Checks whether an error is transient (HTTP 429, 503, 504 or network timeout).
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if ([429, 503, 504].includes(status)) return true;

  const msg = String(error.message || '').toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('service unavailable') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

// Global Singleton Circuit Breakers
export const geminiCircuitBreaker = new CircuitBreaker({
  name: 'Gemini-AI',
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  halfOpenSuccessThreshold: 2
});

export const supabaseCircuitBreaker = new CircuitBreaker({
  name: 'Supabase-Postgres',
  failureThreshold: 5,
  recoveryTimeoutMs: 20000,
  halfOpenSuccessThreshold: 2
});
