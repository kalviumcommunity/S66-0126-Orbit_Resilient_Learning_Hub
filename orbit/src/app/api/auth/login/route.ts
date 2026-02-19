import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiValidationError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api-response";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { generateToken } from "@/lib/auth/jwt";

/**
 * POST /api/auth/login
 *
 * Authenticate user and return JWT token
 *
 * Request Body:
 * {
 *   "email": "student@example.com",
 *   "password": "securePassword123"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "user": {
 *       "id": "cmlt...",
 *       "name": "Student Name",
 *       "email": "student@example.com",
 *       "role": "STUDENT"
 *     }
 *   },
 *   "message": "Login successful"
 * }
 *
 * Error Responses:
 * - 400: Validation error (invalid email format, missing password)
 * - 401: Invalid credentials (wrong email or password)
 * - 500: Server error
 *
 * Security Note:
 * - Uses same error message for "user not found" and "wrong password"
 *   to prevent email enumeration attacks
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();

    // Validate request body
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true, // Need password for verification
      },
    });

    // Security: Don't reveal if email exists
    if (!user) {
      return apiUnauthorized(
        "Invalid email or password",
        "UNAUTHORIZED",
        requestId
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);

    // Security: Same error message as above
    if (!isPasswordValid) {
      return apiUnauthorized(
        "Invalid email or password",
        "UNAUTHORIZED",
        requestId
      );
    }

    // Generate JWT token with role
    const token = generateToken(user.id, user.role);

    // Return user data and token (exclude password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return apiSuccess(
      {
        token,
        user: userWithoutPassword,
      },
      requestId
    );
  } catch (error) {
    return apiServerError(error, requestId);
  }
}
