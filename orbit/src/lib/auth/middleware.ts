import { verifyToken, extractTokenFromHeader } from "./jwt";
import { apiUnauthorized } from "../api-response";

/**
 * Authentication Middleware for Protected Routes
 *
 * Provides a Higher-Order Component (HOC) pattern for protecting API routes.
 * Validates JWT tokens and injects authenticated user ID into route handlers.
 *
 * Flow:
 * 1. Extract token from Authorization header
 * 2. Verify token signature and expiration
 * 3. If valid: inject userId into handler and proceed
 * 4. If invalid: return 401 Unauthorized
 *
 * @module lib/auth/middleware
 */

/**
 * Authenticated route handler signature
 * Handler receives the authenticated userId as third parameter
 * Note: Context type is generic to support Next.js 15+ async params pattern
 */
export type AuthenticatedRouteHandler<T = unknown> = (
  request: Request,
  context: T,
  userId: string
) => Promise<Response>;

/**
 * Higher-Order Component for route protection
 *
 * Wraps a route handler to require JWT authentication.
 * Validates token and injects userId into handler.
 *
 * @param handler - Route handler that requires authentication
 * @returns Wrapped handler with authentication check
 *
 * @example
 * ```typescript
 * // Protected route - only authenticated users
 * export const GET = withAuth(async (request, context, userId) => {
 *   // userId is guaranteed to be valid here
 *   const user = await prisma.user.findUnique({ where: { id: userId } });
 *   return apiSuccess(user);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Protected route with authorization check (Next.js 15+ async params)
 * export const GET = withAuth(async (request, context, authenticatedUserId) => {
 *   const { userId } = await context.params; // Await params in Next.js 15+
 *
 *   // Check if user is accessing their own resource
 *   if (userId !== authenticatedUserId) {
 *     return apiForbidden("You can only access your own data");
 *   }
 *
 *   // Proceed with handler logic
 *   const user = await prisma.user.findUnique({ where: { id: userId } });
 *   return apiSuccess(user);
 * });
 * ```
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedRouteHandler<T>
): (request: Request, context: T) => Promise<Response> {
  return async (request: Request, context: T): Promise<Response> => {
    // 1. Extract Authorization header
    const authHeader = request.headers.get("Authorization");

    // 2. Extract token from header
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return apiUnauthorized(
        "Missing authentication token. Please include 'Authorization: Bearer <token>' header.",
        "MISSING_TOKEN"
      );
    }

    // 3. Verify token
    const payload = verifyToken(token);

    if (!payload) {
      return apiUnauthorized(
        "Invalid or expired token. Please log in again.",
        "INVALID_TOKEN"
      );
    }

    // 4. Token valid - inject userId and call handler
    return handler(request, context, payload.userId);
  };
}
