import { z } from "zod";

/**
 * Zod validation schema for creating a new lesson
 *
 * Validation rules:
 * - title: string, min 1 char, max 200 chars, trimmed
 * - slug: URL-safe string (lowercase letters, numbers, hyphens)
 * - order: positive integer for lesson ordering
 * - content: optional JSON content (flexible for future use)
 *
 * Note: This schema is prepared for future use when lesson creation
 * endpoints are implemented. Currently, lessons are seeded via database.
 */
export const createLessonSchema = z.object({
  title: z
    .string()
    .min(1, "Title must be at least 1 character")
    .max(200, "Title must not exceed 200 characters")
    .trim(),

  slug: z
    .string()
    .min(1, "Slug must be at least 1 character")
    .max(100, "Slug must not exceed 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be URL-safe (lowercase letters, numbers, hyphens only)"
    ),

  order: z
    .number()
    .int("Order must be an integer")
    .positive("Order must be a positive number"),

  content: z.string().optional().nullable(),
});

/**
 * Zod validation schema for updating an existing lesson
 *
 * All fields are optional, but at least one field must be provided.
 * This is enforced by the `.refine()` method.
 */
export const updateLessonSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title must be at least 1 character")
      .max(200, "Title must not exceed 200 characters")
      .trim()
      .optional(),

    slug: z
      .string()
      .min(1, "Slug must be at least 1 character")
      .max(100, "Slug must not exceed 100 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be URL-safe (lowercase letters, numbers, hyphens only)"
      )
      .optional(),

    order: z
      .number()
      .int("Order must be an integer")
      .positive("Order must be a positive number")
      .optional(),

    content: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      data.title ||
      data.slug ||
      data.order !== undefined ||
      data.content !== undefined,
    {
      message:
        "At least one field (title, slug, order, or content) must be provided",
    }
  );

/**
 * TypeScript types inferred from Zod schemas
 * These can be imported and used throughout the application
 */
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
