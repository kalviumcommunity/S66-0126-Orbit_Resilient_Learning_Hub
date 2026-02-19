import bcrypt from "bcrypt";

/**
 * Password hashing utility using bcrypt
 *
 * IMPORTANT SECURITY NOTE:
 * - This module addresses a critical security vulnerability where passwords
 *   were previously stored in plaintext in the database.
 * - All new user registrations now hash passwords before storage.
 * - Existing plaintext passwords should be migrated separately.
 *
 * Cost factor: 10 rounds
 * - Provides strong security (2^10 = 1,024 iterations)
 * - ~100ms hashing time on modern hardware
 * - Balances security vs. performance for user registration
 */

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt
 *
 * @param plainPassword - The plaintext password to hash
 * @returns Promise<string> - The hashed password (includes salt)
 *
 * @example
 * ```typescript
 * const hashedPassword = await hashPassword('mySecurePassword123');
 * // Result: "$2b$10$abcd1234..."
 * ```
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plaintext password with a hashed password
 *
 * Use this for login/authentication flows.
 *
 * @param plainPassword - The plaintext password to verify
 * @param hashedPassword - The hashed password from database
 * @returns Promise<boolean> - True if passwords match
 *
 * @example
 * ```typescript
 * const user = await prisma.user.findUnique({ where: { email } });
 * const isValid = await verifyPassword(inputPassword, user.password);
 * if (!isValid) {
 *   return apiUnauthorized('Invalid credentials');
 * }
 * ```
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
