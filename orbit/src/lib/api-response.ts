import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Global API Response Utility
 *
 * Provides centralized response formatting for all API endpoints.
 * Enforces consistent envelope structure across the application.
 *
 * Standard Envelope:
 * - Success: { success: true, timestamp, requestId, data, pagination? }
 * - Error: { success: false, timestamp, requestId, error: { code, message, details? } }
 * - Delete: 204 No Content with custom headers
 *
 * Benefits:
 * - Frontend predictability (consistent structure)
 * - Production observability (request IDs for tracing)
 * - Debugging (timestamps for timing issues)
 * - Error handling (standardized error codes)
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Standard success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  timestamp: string;
  requestId: string;
  data: T;
}

/**
 * Paginated response structure
 */
export interface ApiPaginatedResponse<T = unknown> {
  success: true;
  timestamp: string;
  requestId: string;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  success: false;
  timestamp: string;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Error Code Constants
// ============================================================================

/**
 * Standardized error codes following UPPER_SNAKE_CASE convention
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  OUT_OF_RANGE: "OUT_OF_RANGE",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // Prisma-specific errors
  PRISMA_RECORD_NOT_FOUND: "PRISMA_RECORD_NOT_FOUND", // P2025
  PRISMA_UNIQUE_VIOLATION: "PRISMA_UNIQUE_VIOLATION", // P2002
  PRISMA_FOREIGN_KEY_VIOLATION: "PRISMA_FOREIGN_KEY_VIOLATION", // P2003
} as const;

// ============================================================================
// Request ID Generator
// ============================================================================

/**
 * Generates a UUIDv4 request ID for request tracing
 *
 * Uses native crypto.randomUUID() for performance (~0.1ms overhead)
 *
 * @returns UUIDv4 string (e.g., "a7f3d9e2-4b1c-4a3f-9d7e-2c8f1a3b5e6d")
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Success Response Builders
// ============================================================================

/**
 * Returns 200 OK with data
 *
 * Use for successful GET, PATCH operations that return data.
 *
 * @param data - Response payload
 * @param requestId - Optional request ID (auto-generated if not provided)
 * @returns NextResponse with 200 status
 *
 * @example
 * ```typescript
 * const user = await prisma.user.findUnique({ where: { id: userId } });
 * return apiSuccess(user, requestId);
 * ```
 */
export function apiSuccess<T>(
  data: T,
  requestId?: string
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    data,
  });
}

/**
 * Returns 201 Created with data
 *
 * Use for successful POST operations that create new resources.
 *
 * @param data - Created resource data
 * @param message - Optional success message for backward compatibility
 * @param requestId - Optional request ID
 * @returns NextResponse with 201 status
 *
 * @example
 * ```typescript
 * const user = await prisma.user.create({ data: { name, email, password } });
 * return apiCreated(user, 'User created successfully', requestId);
 * ```
 */
export function apiCreated<T>(
  data: T,
  message?: string,
  requestId?: string
): NextResponse {
  const response: Record<string, unknown> = {
    success: true,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    data,
  };

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status: 201 });
}

/**
 * Returns 204 No Content with custom headers
 *
 * Use for successful DELETE operations.
 * Body is empty but includes tracing headers.
 *
 * @param requestId - Optional request ID
 * @returns NextResponse with 204 status and custom headers
 *
 * @example
 * ```typescript
 * await prisma.user.delete({ where: { id: userId } });
 * return apiNoContent(requestId);
 * ```
 */
export function apiNoContent(requestId?: string): NextResponse {
  const id = requestId || generateRequestId();
  const timestamp = new Date().toISOString();

  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-Request-Id": id,
      "X-Success": "true",
      "X-Timestamp": timestamp,
    },
  });
}

/**
 * Returns paginated response with 200 OK
 *
 * Use for GET operations that return lists with pagination.
 *
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param requestId - Optional request ID
 * @returns NextResponse with 200 status
 *
 * @example
 * ```typescript
 * const lessons = await prisma.lesson.findMany({ skip, take: limit });
 * const total = await prisma.lesson.count();
 * return apiPaginated(lessons, {
 *   page, limit, total,
 *   totalPages: Math.ceil(total / limit),
 *   hasMore: skip + lessons.length < total
 * }, requestId);
 * ```
 */
export function apiPaginated<T>(
  data: T[],
  pagination: PaginationMeta,
  requestId?: string
): NextResponse<ApiPaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    data,
    pagination,
  });
}

// ============================================================================
// Error Response Builders
// ============================================================================

/**
 * Generic error handler
 *
 * Use when you need a custom status code or error code.
 *
 * @param error - Error object or message
 * @param status - HTTP status code
 * @param code - Error code (UPPER_SNAKE_CASE)
 * @param requestId - Optional request ID
 * @returns NextResponse with specified status
 */
export function apiError(
  error: unknown,
  status: number,
  code: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : String(error);

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

/**
 * Returns 400 Bad Request
 *
 * Use for validation errors, missing fields, invalid parameters.
 *
 * @param message - Error message
 * @param details - Optional additional context
 * @param requestId - Optional request ID
 * @returns NextResponse with 400 status
 *
 * @example
 * ```typescript
 * if (!userId || !lessonId) {
 *   return apiBadRequest('userId and lessonId are required', undefined, requestId);
 * }
 * ```
 */
export function apiBadRequest(
  message: string,
  details?: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code: ErrorCodes.BAD_REQUEST,
    message,
  };

  if (details !== undefined) {
    errorObj.details = details;
  }

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: errorObj,
    },
    { status: 400 }
  );
}

/**
 * Returns 404 Not Found
 *
 * Use when a requested resource doesn't exist.
 *
 * @param resource - Resource type (e.g., "User", "Lesson")
 * @param identifier - Optional resource identifier
 * @param requestId - Optional request ID
 * @returns NextResponse with 404 status
 *
 * @example
 * ```typescript
 * const user = await prisma.user.findUnique({ where: { id: userId } });
 * if (!user) {
 *   return apiNotFound('User', userId, requestId);
 * }
 * ```
 */
export function apiNotFound(
  resource: string,
  identifier?: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const message = identifier
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.NOT_FOUND,
        message,
      },
    },
    { status: 404 }
  );
}

/**
 * Returns 409 Conflict
 *
 * Use for duplicate entries, unique constraint violations.
 *
 * @param message - Error message
 * @param details - Optional additional context
 * @param requestId - Optional request ID
 * @returns NextResponse with 409 status
 *
 * @example
 * ```typescript
 * // Prisma P2002 error (unique constraint)
 * if (error.code === 'P2002') {
 *   return apiConflict('Email already exists', undefined, requestId);
 * }
 * ```
 */
export function apiConflict(
  message: string,
  details?: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code: ErrorCodes.CONFLICT,
    message,
  };

  if (details !== undefined) {
    errorObj.details = details;
  }

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: errorObj,
    },
    { status: 409 }
  );
}

/**
 * Returns 500 Internal Server Error
 *
 * Use as a catch-all for unexpected errors.
 * Logs the full error for debugging.
 *
 * @param error - Error object
 * @param requestId - Optional request ID
 * @returns NextResponse with 500 status
 *
 * @example
 * ```typescript
 * try {
 *   // ... database operation
 * } catch (error) {
 *   return apiServerError(error, requestId);
 * }
 * ```
 */
export function apiServerError(
  error: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : "Unknown error";

  // Log the full error for debugging
  console.error("[API Server Error]", error);

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message,
      },
    },
    { status: 500 }
  );
}

// ============================================================================
// Validation Error Helpers
// ============================================================================

/**
 * Returns 400 Bad Request for missing required field
 *
 * @param fieldName - Name of the missing field
 * @param requestId - Optional request ID
 * @returns NextResponse with 400 status
 *
 * @example
 * ```typescript
 * if (!email) {
 *   return apiMissingField('email', requestId);
 * }
 * ```
 */
export function apiMissingField(
  fieldName: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.MISSING_REQUIRED_FIELD,
        message: `Missing required field: ${fieldName}`,
      },
    },
    { status: 400 }
  );
}

/**
 * Returns 400 Bad Request for invalid format
 *
 * Use for email format, date format, etc.
 *
 * @param fieldName - Name of the field with invalid format
 * @param expectedFormat - Description of expected format
 * @param requestId - Optional request ID
 * @returns NextResponse with 400 status
 *
 * @example
 * ```typescript
 * if (!emailRegex.test(email)) {
 *   return apiInvalidFormat('email', 'valid email address', requestId);
 * }
 * ```
 */
export function apiInvalidFormat(
  fieldName: string,
  expectedFormat: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.INVALID_FORMAT,
        message: `Invalid format for field '${fieldName}'. Expected: ${expectedFormat}`,
      },
    },
    { status: 400 }
  );
}

/**
 * Returns 400 Bad Request for out of range value
 *
 * Use for numeric validation (e.g., score 0-100).
 *
 * @param fieldName - Name of the field
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param requestId - Optional request ID
 * @returns NextResponse with 400 status
 *
 * @example
 * ```typescript
 * if (score < 0 || score > 100) {
 *   return apiOutOfRange('score', 0, 100, requestId);
 * }
 * ```
 */
export function apiOutOfRange(
  fieldName: string,
  min: number,
  max: number,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.OUT_OF_RANGE,
        message: `Field '${fieldName}' must be between ${min} and ${max}`,
      },
    },
    { status: 400 }
  );
}

/**
 * Returns 400 Bad Request for Zod validation errors
 *
 * Groups all validation errors into a single response with field-level details.
 * This provides better UX than returning errors one-by-one.
 *
 * @param zodError - ZodError object from safeParse()
 * @param requestId - Optional request ID
 * @returns NextResponse with 400 status
 *
 * @example
 * ```typescript
 * const result = createUserSchema.safeParse(body);
 * if (!result.success) {
 *   return apiValidationError(result.error, requestId);
 * }
 * // Returns:
 * // {
 * //   "success": false,
 * //   "error": {
 * //     "code": "VALIDATION_ERROR",
 * //     "message": "Request validation failed",
 * //     "details": {
 * //       "fields": {
 * //         "email": "Invalid email format",
 * //         "score": "Number must be between 0 and 100"
 * //       }
 * //     }
 * //   }
 * // }
 * ```
 */
export function apiValidationError(
  zodError: ZodError<unknown>,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  // Parse Zod errors into field-level map
  const fields: Record<string, string> = {};

  zodError.issues.forEach((issue) => {
    const fieldPath = issue.path.join(".");
    fields[fieldPath] = issue.message;
  });

  return NextResponse.json(
    {
      success: false,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Request validation failed",
        details: {
          fields,
        },
      },
    },
    { status: 400 }
  );
}

// ============================================================================
// Prisma Error Handler
// ============================================================================

/**
 * Handles Prisma-specific errors and returns appropriate API response
 *
 * Returns null if not a Prisma error (allows fallback to generic handler).
 *
 * @param error - Error object
 * @param requestId - Optional request ID
 * @returns NextResponse or null if not a Prisma error
 *
 * @example
 * ```typescript
 * try {
 *   await prisma.user.delete({ where: { id: userId } });
 * } catch (error) {
 *   const prismaResponse = handlePrismaError(error, requestId);
 *   if (prismaResponse) return prismaResponse;
 *   return apiServerError(error, requestId);
 * }
 * ```
 */
export function handlePrismaError(
  error: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null; // Not a Prisma error
  }

  const prismaError = error as { code: string; meta?: unknown };

  switch (prismaError.code) {
    case "P2025": // Record not found
      return apiError(
        error,
        404,
        ErrorCodes.PRISMA_RECORD_NOT_FOUND,
        requestId
      );

    case "P2002": // Unique constraint violation
      return apiConflict(
        "Duplicate entry detected",
        prismaError.meta,
        requestId
      );

    case "P2003": // Foreign key constraint violation
      return apiBadRequest(
        "Invalid reference to related record",
        prismaError.meta,
        requestId
      );

    default:
      return null; // Let generic handler deal with it
  }
}
