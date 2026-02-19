/**
 * Module 2.22: Enhanced Error Handler
 *
 * Centralized error handling with production-safe error redaction.
 * Integrates with Pino logger for structured error logging.
 *
 * Features:
 * - Stack trace redaction in production
 * - Structured error logging with context
 * - Error classification (operational vs programmer errors)
 * - Integration with request logging
 *
 * Usage:
 * ```typescript
 * import { handleError, AppError } from '@/lib/error-handler';
 *
 * // In route handlers
 * try {
 *   // ... code
 * } catch (error) {
 *   return handleError(error, requestId, { userId, action: 'createLesson' });
 * }
 *
 * // Throwing custom errors
 * throw new AppError('Resource not found', 404, 'NOT_FOUND');
 * ```
 */

import { logger } from "./logger";
import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Custom application error class
 * Use this for operational errors (expected errors that can be handled)
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error context for logging
 */
interface ErrorContext {
  userId?: string;
  userRole?: string;
  action?: string;
  resource?: string;
  [key: string]: unknown;
}

/**
 * Sanitize error for production response
 * Removes stack traces and internal details
 */
function sanitizeError(error: Error): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (isProduction) {
    // In production, only return generic error message
    if (error instanceof AppError && error.isOperational) {
      // Operational errors are safe to expose
      return {
        message: error.message,
        code: error.code,
      };
    }

    // Programmer errors or unknown errors - hide details
    return {
      message: "An internal server error occurred. Please try again later.",
      code: "INTERNAL_ERROR",
    };
  }

  // In development, return full error details
  return {
    message: error.message,
    code: error instanceof AppError ? error.code : "UNKNOWN_ERROR",
    stack: error.stack,
  };
}

/**
 * Central error handler
 * Logs error with context and returns appropriate HTTP response
 */
export function handleError(
  error: unknown,
  requestId: string,
  context?: ErrorContext
): NextResponse {
  // Convert unknown error to Error object
  const err = error instanceof Error ? error : new Error(String(error));

  // Determine status code
  const statusCode = error instanceof AppError ? error.statusCode : 500;

  // Determine if error is operational
  const isOperational = error instanceof AppError ? error.isOperational : false;

  // Log error with full context
  const logContext = {
    requestId,
    error: {
      name: err.name,
      message: err.message,
      code: error instanceof AppError ? error.code : "UNKNOWN_ERROR",
      stack: isProduction ? undefined : err.stack, // Hide stack in production logs
      isOperational,
    },
    ...context,
  };

  if (isOperational) {
    // Operational errors are expected - log as warning
    logger.warn(logContext, `Operational error: ${err.message}`);
  } else {
    // Programmer errors or unknown errors - log as error
    logger.error(logContext, `Unexpected error: ${err.message}`);
  }

  // Sanitize error for response
  const sanitized = sanitizeError(err);

  // Return error response
  return NextResponse.json(
    {
      success: false,
      error: {
        message: sanitized.message,
        code: sanitized.code,
        ...(sanitized.stack && { stack: sanitized.stack }),
      },
      requestId,
    },
    { status: statusCode }
  );
}

/**
 * Common application errors
 * Use these factory functions for consistent error handling
 */

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR", true);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR", true);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR", true);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, "NOT_FOUND", true);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT", true);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true);
    this.name = "RateLimitError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE", true);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Error type guards
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
