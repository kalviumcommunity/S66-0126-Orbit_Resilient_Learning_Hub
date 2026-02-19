/**
 * Role-Based Access Control (RBAC) Type Definitions
 *
 * Provides TypeScript types for RBAC system.
 * These types are used across authentication, authorization, and route handlers.
 *
 * @module types/rbac
 */

import type { UserRole } from "@prisma/client";

/**
 * Authenticated user with role information
 *
 * Represents the authenticated user after JWT verification.
 * Injected into route handlers by withAuth/withRole middleware.
 */
export interface AuthenticatedUser {
  id: string; // User CUID from database
  role: UserRole; // User's role (STUDENT, TEACHER, ADMIN)
}

/**
 * Route handler with role-based authorization
 *
 * Function signature for protected route handlers that require specific roles.
 * The user parameter is guaranteed to have one of the required roles.
 *
 * The context type matches Next.js App Router handler context structure.
 */
export type RoleProtectedHandler<T = unknown> = (
  request: Request,
  context: { params: Promise<T> },
  user: AuthenticatedUser
) => Promise<Response>;

/**
 * Role permission matrix
 *
 * Defines which roles have which permissions in the system.
 * Used for authorization checks throughout the application.
 */
export interface RolePermissions {
  /**
   * Can create, update, delete lessons
   */
  manageContent: UserRole[];

  /**
   * Can delete any resource (lessons, users, progress)
   */
  deleteAny: UserRole[];

  /**
   * Can view any user's progress and dashboard
   */
  viewAllProgress: UserRole[];

  /**
   * Can create and manage own progress
   */
  manageOwnProgress: UserRole[];

  /**
   * Can update own profile
   */
  updateOwnProfile: UserRole[];

  /**
   * Can view and manage all users
   */
  manageUsers: UserRole[];
}
