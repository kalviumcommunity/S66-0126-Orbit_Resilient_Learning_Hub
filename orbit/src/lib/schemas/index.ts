/**
 * Centralized schema exports for Orbit API validation
 *
 * This module provides Zod validation schemas for all API endpoints.
 * Schemas can be used on both server-side (API routes) and client-side
 * (form validation) for consistent validation logic.
 *
 * Usage example (server-side):
 * ```typescript
 * import { createUserSchema } from "@/lib/schemas";
 *
 * const result = createUserSchema.safeParse(body);
 * if (!result.success) {
 *   return apiValidationError(result.error);
 * }
 * ```
 *
 * Usage example (client-side - future):
 * ```typescript
 * import { createUserSchema, type CreateUserInput } from "@/lib/schemas";
 *
 * const formData: CreateUserInput = { name, email, password };
 * const result = createUserSchema.safeParse(formData);
 * ```
 */

// User schemas
export {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "./user.schema";

// Progress schemas
export {
  createProgressSchema,
  updateProgressSchema,
  type CreateProgressInput,
  type UpdateProgressInput,
} from "./progress.schema";

// Lesson schemas (prepared for future use)
export {
  createLessonSchema,
  updateLessonSchema,
  type CreateLessonInput,
  type UpdateLessonInput,
} from "./lesson.schema";
