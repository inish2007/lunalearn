/**
 * Production-Grade Error Taxonomy & Standardized Error Types
 * Follows LunaLearn Production Architecture Specifications.
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  CONSTRAINT_CONFLICT = 'CONSTRAINT_CONFLICT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_PROVIDER_TIMEOUT = 'AI_PROVIDER_TIMEOUT',
  NO_RELEVANT_CONTEXT = 'NO_RELEVANT_CONTEXT',
  VECTOR_SEARCH_FAILED = 'VECTOR_SEARCH_FAILED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  PLANNER_FAILURE = 'PLANNER_FAILURE'
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ApiErrorDetail {
  code: ErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  requestId: string;
  issues?: ValidationIssue[];
}

export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
  message?: string;
  count?: number;
  issues?: ValidationIssue[];
}

/**
 * Sanitizes error messages to prevent sensitive leaks
 * (strips raw SQL, DB credentials, API keys, file paths).
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An error occurred';
  let sanitized = message;
  // Redact potential connection strings or URLs with passwords
  sanitized = sanitized.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1*****$2');
  // Redact JWT tokens or Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED]');
  // Redact API keys resembling AIza, sk-, etc.
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/sk-[0-9A-Za-z]{32,}/g, '[REDACTED_KEY]');
  // Redact PostgreSQL syntax dumps or internal column details if raw error
  if (sanitized.includes('syntax error at or near') || sanitized.includes('relation "') || sanitized.includes('column "')) {
    return 'Database query execution failed.';
  }
  return sanitized;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly issues?: ValidationIssue[];
  public readonly details?: unknown;
  public requestId?: string;

  constructor(options: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    userMessage?: string;
    retryable?: boolean;
    issues?: ValidationIssue[];
    details?: unknown;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode || AppError.defaultStatusCodeFor(options.code);
    this.userMessage = options.userMessage || AppError.defaultUserMessageFor(options.code, options.message);
    this.retryable = options.retryable ?? AppError.defaultRetryableFor(options.code);
    this.issues = options.issues;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  public static defaultStatusCodeFor(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR:
        return 400;
      case ErrorCode.UNAUTHORIZED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.PAYLOAD_TOO_LARGE:
        return 413;
      case ErrorCode.UNSUPPORTED_MEDIA_TYPE:
        return 415;
      case ErrorCode.RATE_LIMITED:
        return 429;
      case ErrorCode.INSUFFICIENT_DATA:
      case ErrorCode.CONSTRAINT_CONFLICT:
        return 422;
      case ErrorCode.SERVICE_UNAVAILABLE:
      case ErrorCode.CIRCUIT_BREAKER_OPEN:
      case ErrorCode.AI_PROVIDER_ERROR:
        return 503;
      case ErrorCode.AI_PROVIDER_TIMEOUT:
        return 504;
      case ErrorCode.VECTOR_SEARCH_FAILED:
      case ErrorCode.PLANNER_FAILURE:
      case ErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return 500;
    }
  }

  public static defaultRetryableFor(code: ErrorCode): boolean {
    switch (code) {
      case ErrorCode.RATE_LIMITED:
      case ErrorCode.AI_PROVIDER_TIMEOUT:
      case ErrorCode.SERVICE_UNAVAILABLE:
      case ErrorCode.AI_PROVIDER_ERROR:
        return true;
      default:
        return false;
    }
  }

  public static defaultUserMessageFor(code: ErrorCode, _rawMessage?: string): string {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR:
        return 'Please review the submitted information and try again.';
      case ErrorCode.UNAUTHORIZED:
        return 'Please sign in to continue.';
      case ErrorCode.FORBIDDEN:
        return 'You do not have permission to access or modify this resource.';
      case ErrorCode.NOT_FOUND:
        return 'The requested resource could not be found.';
      case ErrorCode.CONFLICT:
        return 'This action conflicts with an existing resource or stale data state.';
      case ErrorCode.CONSTRAINT_CONFLICT:
        return 'The requested plan does not fit the available study time. Increase availability or revise topic estimates.';
      case ErrorCode.PAYLOAD_TOO_LARGE:
        return 'The uploaded file or request payload is too large.';
      case ErrorCode.UNSUPPORTED_MEDIA_TYPE:
        return 'Unsupported file format. Please upload a valid PDF document.';
      case ErrorCode.RATE_LIMITED:
        return 'Too many requests. Please wait a moment before trying again.';
      case ErrorCode.CIRCUIT_BREAKER_OPEN:
        return 'This external service is temporarily resting due to high load. Please try again shortly.';
      case ErrorCode.AI_PROVIDER_TIMEOUT:
        return 'The AI service took too long to respond. Please try again.';
      case ErrorCode.AI_PROVIDER_ERROR:
        return 'The AI service encountered an error. A fallback answer or retry may be available.';
      case ErrorCode.NO_RELEVANT_CONTEXT:
        return 'No relevant study materials matched this topic or query.';
      case ErrorCode.VECTOR_SEARCH_FAILED:
        return 'Search engine could not retrieve vector embeddings at this time.';
      case ErrorCode.INSUFFICIENT_DATA:
        return 'Please add topics, assignments, or study materials before generating this.';
      case ErrorCode.PLANNER_FAILURE:
        return 'Adaptive planner encountered an error generating the study schedule.';
      case ErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return 'An unexpected server error occurred. Please try again later.';
    }
  }

  // Convenient Factory Methods
  public static validation(message: string, issues?: ValidationIssue[]): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message,
      issues,
      retryable: false
    });
  }

  public static unauthorized(message = 'Authentication required'): AppError {
    return new AppError({
      code: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
      message,
      retryable: false
    });
  }

  public static forbidden(message = 'Access forbidden'): AppError {
    return new AppError({
      code: ErrorCode.FORBIDDEN,
      statusCode: 403,
      message,
      retryable: false
    });
  }

  public static notFound(message = 'Resource not found'): AppError {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message,
      retryable: false
    });
  }

  public static conflict(message = 'Resource conflict'): AppError {
    return new AppError({
      code: ErrorCode.CONFLICT,
      statusCode: 409,
      message,
      retryable: false
    });
  }

  public static constraintConflict(message: string): AppError {
    return new AppError({
      code: ErrorCode.CONSTRAINT_CONFLICT,
      statusCode: 422,
      message,
      retryable: false
    });
  }

  public static payloadTooLarge(message = 'Payload too large'): AppError {
    return new AppError({
      code: ErrorCode.PAYLOAD_TOO_LARGE,
      statusCode: 413,
      message,
      retryable: false
    });
  }

  public static unsupportedMediaType(message = 'Unsupported media type'): AppError {
    return new AppError({
      code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      statusCode: 415,
      message,
      retryable: false
    });
  }

  public static rateLimited(message = 'Rate limit exceeded', retryAfterSec = 30): AppError {
    return new AppError({
      code: ErrorCode.RATE_LIMITED,
      statusCode: 429,
      message,
      userMessage: `Rate limit reached. Please wait ${retryAfterSec} seconds before retrying.`,
      retryable: true
    });
  }

  public static circuitBreakerOpen(serviceName = 'AI Provider'): AppError {
    return new AppError({
      code: ErrorCode.CIRCUIT_BREAKER_OPEN,
      statusCode: 503,
      message: `Circuit breaker is OPEN for ${serviceName}. Failing fast.`,
      userMessage: `${serviceName} is temporarily overloaded. Please try again in a few moments.`,
      retryable: true
    });
  }

  public static aiTimeout(message = 'AI Provider timed out'): AppError {
    return new AppError({
      code: ErrorCode.AI_PROVIDER_TIMEOUT,
      statusCode: 504,
      message,
      retryable: true
    });
  }

  public static aiError(message = 'AI Provider failure', retryable = true): AppError {
    return new AppError({
      code: ErrorCode.AI_PROVIDER_ERROR,
      statusCode: 503,
      message,
      retryable
    });
  }

  public static vectorSearchFailed(message = 'Vector search failed'): AppError {
    return new AppError({
      code: ErrorCode.VECTOR_SEARCH_FAILED,
      statusCode: 500,
      message,
      retryable: true
    });
  }

  public static noRelevantContext(message = 'No relevant context found'): AppError {
    return new AppError({
      code: ErrorCode.NO_RELEVANT_CONTEXT,
      statusCode: 404,
      message,
      userMessage: 'No matching study notes were found. Try another query or upload syllabus materials.',
      retryable: false
    });
  }

  public static insufficientData(message: string): AppError {
    return new AppError({
      code: ErrorCode.INSUFFICIENT_DATA,
      statusCode: 422,
      message,
      retryable: false
    });
  }

  public static internal(message = 'Internal server error', cause?: unknown): AppError {
    return new AppError({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: 500,
      message,
      cause,
      retryable: false
    });
  }
}
