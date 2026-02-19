import { z } from "zod";

/**
 * Zod validation schema for creating a new user
 *
 * Validation rules:
 * - name: string, min 1 char, max 100 chars, trimmed
 * - email: valid email format, lowercase, trimmed
 * - password: string, min 8 chars (will be hashed before storage)
 */
export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(100, "Name must not exceed 100 characters")
    .trim(),

  email: z.string().email("Invalid email format").toLowerCase().trim(),

  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Zod validation schema for updating an existing user
 *
 * All fields are optional, but at least one field must be provided.
 * This is enforced by the `.refine()` method.
 *
 * Note: Password updates should be handled by a separate endpoint
 * in production systems (e.g., /api/users/:userId/password)
 */
export const updateUserSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name must be at least 1 character")
      .max(100, "Name must not exceed 100 characters")
      .trim()
      .optional(),

    email: z
      .string()
      .email("Invalid email format")
      .toLowerCase()
      .trim()
      .optional(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  })
  .refine((data) => data.name || data.email || data.password, {
    message: "At least one field (name, email, or password) must be provided",
  });

/**
 * TypeScript types inferred from Zod schemas
 * These can be imported and used throughout the application
 */
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
