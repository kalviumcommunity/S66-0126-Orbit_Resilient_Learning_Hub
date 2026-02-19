/**
 * Authentication Type Definitions
 *
 * Provides TypeScript types for authentication system.
 * These types are used across JWT utilities, middleware, and route handlers.
 *
 * @module types/auth
 */

/**
 * JWT payload structure
 *
 * Contains the authenticated user's ID.
 * Additional claims (iat, exp) are added automatically by jsonwebtoken.
 */
export interface JWTPayload {
  userId: string;
  iat?: number; // Issued at timestamp (auto-added by JWT library)
  exp?: number; // Expiration timestamp (auto-added by JWT library)
}

/**
 * Authenticated user context
 *
 * Represents the authenticated user after JWT verification.
 * Injected into route handlers by withAuth middleware.
 */
export interface AuthenticatedUser {
  id: string; // User CUID from database
}

/**
 * Route handler with authentication
 *
 * Function signature for protected route handlers.
 * The userId parameter is guaranteed to be valid (token verified).
 * Note: params is a Promise in Next.js 15+ (async params pattern)
 */
export type AuthenticatedRouteHandler<T = unknown> = (
  request: Request,
  context: T,
  userId: string
) => Promise<Response>;
