import type { UserRole } from "@prisma/client";
import { verifyToken, extractTokenFromHeader } from "./jwt";
import { apiUnauthorized, apiForbidden } from "../api-response";
import type {
  AuthenticatedUser,
  RoleProtectedHandler,
  RolePermissions,
} from "@/types/rbac";

/**
 * Role-Based Access Control (RBAC) Utilities
 *
 * Provides utilities for implementing role-based authorization.
 * Works in conjunction with JWT authentication to enforce permissions.
 *
 * @module lib/auth/rbac
 */

/**
 * Role permission configuration
 *
 * Defines which roles have which permissions in the system.
 * This is the single source of truth for all authorization decisions.
 */
export const ROLE_PERMISSIONS: RolePermissions = {
  // Content management (lessons)
  manageContent: ["TEACHER", "ADMIN"],

  // Delete any resource
  deleteAny: ["ADMIN"],

  // View all users' progress and dashboards
  viewAllProgress: ["TEACHER", "ADMIN"],

  // Manage own progress (all authenticated users)
  manageOwnProgress: ["STUDENT", "TEACHER", "ADMIN"],

  // Update own profile (all authenticated users)
  updateOwnProfile: ["STUDENT", "TEACHER", "ADMIN"],

  // Manage all users
  manageUsers: ["ADMIN"],
};

/**
 * Role hierarchy for quick checks
 *
 * Higher index = more privileges
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  STUDENT: 0,
  TEACHER: 1,
  ADMIN: 2,
};

/**
 * Check if a user's role has permission
 *
 * @param userRole - User's current role
 * @param allowedRoles - Array of roles that are allowed
 * @returns True if user has permission, false otherwise
 *
 * @example
 * ```typescript
 * if (hasPermission(user.role, ['TEACHER', 'ADMIN'])) {
 *   // User can proceed
 * }
 * ```
 */
export function hasPermission(
  userRole: UserRole,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Check if a user's role has at least a certain level
 *
 * @param userRole - User's current role
 * @param minimumRole - Minimum required role
 * @returns True if user has at least the minimum role level
 *
 * @example
 * ```typescript
 * if (hasMinimumRole(user.role, 'TEACHER')) {
 *   // True for TEACHER and ADMIN
 * }
 * ```
 */
export function hasMinimumRole(
  userRole: UserRole,
  minimumRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Higher-Order Component for role-based authorization
 *
 * Wraps a route handler to require authentication AND specific roles.
 * Combines JWT validation with role checking in a single HOC.
 *
 * @param allowedRoles - Array of roles that can access this endpoint
 * @param handler - Route handler that requires specific roles
 * @returns Wrapped handler with auth + role checks
 *
 * @example
 * ```typescript
 * // Admin-only endpoint
 * export const DELETE = withRole(['ADMIN'], async (request, context, user) => {
 *   // user.role is guaranteed to be ADMIN
 *   await prisma.lesson.delete({ where: { id: lessonId } });
 *   return apiNoContent();
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Teacher or Admin endpoint
 * export const POST = withRole(['TEACHER', 'ADMIN'], async (request, context, user) => {
 *   // user.role is either TEACHER or ADMIN
 *   const lesson = await prisma.lesson.create({ data: body });
 *   return apiCreated(lesson);
 * });
 * ```
 */
export function withRole<T = unknown>(
  allowedRoles: UserRole[],
  handler: RoleProtectedHandler<T>
): (request: Request, context: { params: Promise<T> }) => Promise<Response> {
  return async (
    request: Request,
    context: { params: Promise<T> }
  ): Promise<Response> => {
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

    // 3. Verify token and extract payload
    const payload = verifyToken(token);

    if (!payload) {
      return apiUnauthorized(
        "Invalid or expired token. Please log in again.",
        "INVALID_TOKEN"
      );
    }

    // 4. Check if user has required role
    if (!hasPermission(payload.role, allowedRoles)) {
      return apiForbidden(
        `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${payload.role}`
      );
    }

    // 5. Create authenticated user object
    const user: AuthenticatedUser = {
      id: payload.userId,
      role: payload.role,
    };

    // 6. Token valid and role authorized - call handler
    return handler(request, context, user);
  };
}

/**
 * Check if user can modify a resource
 *
 * Users can modify their own resources, or if they have admin privileges.
 *
 * @param authenticatedUserId - ID of the authenticated user
 * @param resourceOwnerId - ID of the resource owner
 * @param userRole - Role of the authenticated user
 * @returns True if user can modify the resource
 *
 * @example
 * ```typescript
 * if (!canModifyResource(user.id, progress.userId, user.role)) {
 *   return apiForbidden("You can only modify your own progress");
 * }
 * ```
 */
export function canModifyResource(
  authenticatedUserId: string,
  resourceOwnerId: string,
  userRole: UserRole
): boolean {
  // User owns the resource
  if (authenticatedUserId === resourceOwnerId) {
    return true;
  }

  // Admin can modify any resource
  if (userRole === "ADMIN") {
    return true;
  }

  return false;
}

/**
 * Check if user can view a resource
 *
 * Users can view their own resources, or if they have teacher/admin privileges.
 *
 * @param authenticatedUserId - ID of the authenticated user
 * @param resourceOwnerId - ID of the resource owner
 * @param userRole - Role of the authenticated user
 * @returns True if user can view the resource
 *
 * @example
 * ```typescript
 * if (!canViewResource(user.id, dashboard.userId, user.role)) {
 *   return apiForbidden("You can only view your own dashboard");
 * }
 * ```
 */
export function canViewResource(
  authenticatedUserId: string,
  resourceOwnerId: string,
  userRole: UserRole
): boolean {
  // User owns the resource
  if (authenticatedUserId === resourceOwnerId) {
    return true;
  }

  // Teacher and Admin can view any resource
  if (hasPermission(userRole, ROLE_PERMISSIONS.viewAllProgress)) {
    return true;
  }

  return false;
}
