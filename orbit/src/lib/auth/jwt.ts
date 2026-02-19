import * as jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import type { UserRole } from "@prisma/client";

/**
 * JWT Utility for Token Generation and Verification
 *
 * Provides centralized JWT operations for authentication system.
 * Uses HS256 algorithm with configurable expiration.
 *
 * Security considerations:
 * - JWT_SECRET must be cryptographically secure (64+ characters)
 * - Tokens expire after JWT_EXPIRES_IN (default: 1 hour)
 * - Payload includes userId and role for RBAC
 * - Verification handles all error cases gracefully
 *
 * @module lib/auth/jwt
 */

/**
 * JWT payload structure
 * Contains user ID and role for authentication and authorization
 */
export interface JWTPayload {
  userId: string;
  role: UserRole;
  iat?: number; // Issued at (auto-added by jsonwebtoken)
  exp?: number; // Expiration (auto-added by jsonwebtoken)
}

/**
 * Gets JWT secret from environment variable
 * Throws error if not configured (fail-fast approach)
 *
 * @returns JWT_SECRET from environment
 * @throws Error if JWT_SECRET is not set
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured. Please add it to .env.local"
    );
  }

  return secret;
}

/**
 * Generates a JWT token for a user
 *
 * Uses HS256 algorithm and includes expiration time from environment.
 *
 * @param userId - User's CUID from database
 * @param role - User's role (STUDENT, TEACHER, ADMIN)
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generateToken(user.id, user.role);
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * ```
 */
export function generateToken(userId: string, role: UserRole): string {
  const secret = getJWTSecret();

  const payload: JWTPayload = {
    userId,
    role,
  };

  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "1h") as StringValue | number,
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Verifies and decodes a JWT token
 *
 * Returns the payload if valid, or null if invalid/expired.
 * Handles all error cases gracefully (no throwing).
 *
 * @param token - JWT token string to verify
 * @returns Decoded payload with userId and role, or null if invalid
 *
 * @example
 * ```typescript
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log("User ID:", payload.userId);
 *   console.log("Role:", payload.role);
 * } else {
 *   console.log("Invalid or expired token");
 * }
 * ```
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as JWTPayload;

    // Ensure userId and role exist in payload
    if (!decoded.userId || !decoded.role) {
      return null;
    }

    return decoded;
  } catch {
    // Handle all JWT errors gracefully
    // Possible errors: TokenExpiredError, JsonWebTokenError, NotBeforeError
    return null;
  }
}

/**
 * Extracts JWT token from Authorization header
 *
 * Expected format: "Bearer <token>"
 * Returns null if header is missing or malformed.
 *
 * @param authHeader - Value of Authorization header
 * @returns Extracted token string, or null if invalid format
 *
 * @example
 * ```typescript
 * const authHeader = request.headers.get("Authorization");
 * const token = extractTokenFromHeader(authHeader);
 * // authHeader = "Bearer eyJhbGciOi..." => returns "eyJhbGciOi..."
 * // authHeader = "eyJhbGciOi..." => returns null (missing "Bearer")
 * // authHeader = null => returns null
 * ```
 */
export function extractTokenFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader) {
    return null;
  }

  // Check for "Bearer " prefix (case-insensitive)
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}
