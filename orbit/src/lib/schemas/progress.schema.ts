import { z } from "zod";

/**
 * CUID format regex: starts with 'c' followed by 24 lowercase alphanumeric characters
 * Example: c12345678901234567890123
 *
 * This strict validation catches malformed IDs early before database queries.
 */
const cuidRegex = /^c[a-z0-9]{24}$/;

/**
 * Zod validation schema for creating new progress record
 *
 * Validation rules:
 * - userId: Must be valid CUID format (c + 24 alphanumeric chars)
 * - lessonId: Must be valid CUID format (c + 24 alphanumeric chars)
 * - completed: Boolean flag indicating if lesson is completed
 * - score: Optional integer between 0-100, or null for lessons without scores
 */
export const createProgressSchema = z.object({
  userId: z
    .string()
    .regex(
      cuidRegex,
      "Invalid user ID format. Must be a valid CUID (e.g., c12345678901234567890123)"
    ),

  lessonId: z
    .string()
    .regex(
      cuidRegex,
      "Invalid lesson ID format. Must be a valid CUID (e.g., c12345678901234567890123)"
    ),

  completed: z.boolean(),

  score: z
    .number()
    .int("Score must be an integer")
    .min(0, "Score must be at least 0")
    .max(100, "Score must not exceed 100")
    .nullable()
    .optional(),
});

/**
 * Zod validation schema for updating existing progress record
 *
 * All fields are optional, but at least one field must be provided.
 * This is enforced by the `.refine()` method.
 *
 * Note: userId and lessonId cannot be updated (they form the composite unique key)
 */
export const updateProgressSchema = z
  .object({
    completed: z.boolean().optional(),

    score: z
      .number()
      .int("Score must be an integer")
      .min(0, "Score must be at least 0")
      .max(100, "Score must not exceed 100")
      .nullable()
      .optional(),
  })
  .refine((data) => data.completed !== undefined || data.score !== undefined, {
    message: "At least one field (completed or score) must be provided",
  });

/**
 * TypeScript types inferred from Zod schemas
 * These can be imported and used throughout the application
 */
export type CreateProgressInput = z.infer<typeof createProgressSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
