/**
 * Module 2.22: Centralized Logging with Pino
 *
 * Structured JSON logging with automatic redaction of sensitive fields.
 * Configured for production deployment in Docker/Kubernetes environments.
 *
 * Features:
 * - Fast, low-overhead JSON logging
 * - Automatic redaction of passwords, tokens, authorization headers
 * - Pretty-printing in development mode
 * - Structured logs for aggregation tools (ELK, Datadog, etc.)
 * - Request ID tracking for distributed tracing
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info({ userId: '123', action: 'login' }, 'User logged in');
 * logger.error({ error: err, userId: '123' }, 'Failed to process request');
 * logger.warn({ requestId: 'xyz' }, 'Rate limit approaching');
 * ```
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Pino logger configuration
 *
 * Production:
 * - JSON output to stdout (for Docker/K8s log collection)
 * - Redacts sensitive fields
 * - Error stack traces included but sanitized
 *
 * Development:
 * - Pretty-printed colorized output
 * - Full stack traces
 * - Human-readable timestamps
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Redact sensitive fields from logs
  redact: {
    paths: [
      // Password fields (any depth)
      "*.password",
      "*.*.password",
      "*.*.*.password",
      "password",
      "req.body.password",
      "body.password",

      // Token fields
      "*.token",
      "*.*.token",
      "token",
      "req.headers.authorization",
      "headers.authorization",
      "req.headers.cookie",
      "headers.cookie",

      // API keys and secrets
      "*.apiKey",
      "*.secret",
      "*.privateKey",
      "apiKey",
      "secret",
      "privateKey",

      // Credit card and sensitive data
      "*.creditCard",
      "*.ssn",
      "creditCard",
      "ssn",
    ],
    // Replace redacted values with [REDACTED]
    censor: "[REDACTED]",
  },

  // Base fields included in every log entry
  base: {
    env: process.env.NODE_ENV || "development",
    pid: process.pid,
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Format error objects properly
  formatters: {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
      };
    },
  },

  // Development: pretty print with colors
  // Production: JSON output
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
          messageFormat: "{msg} {requestId}",
          singleLine: false,
        },
      }
    : undefined,

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Don't log full headers in production (may contain sensitive data)
      headers: isProduction ? undefined : req.headers,
      remoteAddress: req.socket?.remoteAddress,
      remotePort: req.socket?.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Helper function to create a child logger with request context
 *
 * Usage:
 * ```typescript
 * const requestLogger = createRequestLogger(requestId, userId);
 * requestLogger.info('Processing user request');
 * ```
 */
export function createRequestLogger(
  requestId: string,
  userId?: string,
  userRole?: string
) {
  return logger.child({
    requestId,
    ...(userId && { userId }),
    ...(userRole && { userRole }),
  });
}

/**
 * Log levels:
 * - trace (10): Very detailed debug information
 * - debug (20): Detailed debug information
 * - info (30): Informational messages (default in production)
 * - warn (40): Warning messages
 * - error (50): Error messages
 * - fatal (60): Fatal errors (app crash)
 *
 * Set LOG_LEVEL environment variable to control verbosity:
 * LOG_LEVEL=debug npm run dev
 * LOG_LEVEL=warn npm run start
 */

export default logger;
