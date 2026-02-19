import { z } from "zod";

/**
 * Authentication Validation Schemas
 *
 * Zod schemas for validating signup and login requests.
 * These schemas ensure data integrity before processing authentication.
 *
 * @module lib/schemas/auth
 */

/**
 * Signup schema for user registration
 *
 * Validation rules:
 * - name: Required, 1-100 characters, trimmed
 * - email: Valid email format, lowercase, trimmed
 * - password: Minimum 8 characters (will be hashed before storage)
 *
 * Note: This schema reuses the same validation rules as createUserSchema
 * for consistency across the application.
 */
export const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters")
    .trim(),

  email: z.string().email("Invalid email format").toLowerCase().trim(),

  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Login schema for user authentication
 *
 * Validation rules:
 * - email: Valid email format, lowercase, trimmed
 * - password: Required (no minimum length for login to allow existing passwords)
 *
 * Note: We don't validate password length on login since users may have
 * passwords created before validation rules were added.
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase().trim(),

  password: z.string().min(1, "Password is required"),
});

/**
 * TypeScript types inferred from schemas
 * These can be imported and used throughout the application
 */
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
