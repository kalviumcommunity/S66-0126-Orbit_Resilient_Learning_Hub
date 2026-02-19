import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiCreated,
  apiValidationError,
  apiConflict,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { generateToken } from "@/lib/auth/jwt";

/**
 * POST /api/auth/signup
 *
 * Register a new user and return JWT token
 *
 * Request Body:
 * {
 *   "name": "Student Name",
 *   "email": "student@example.com",
 *   "password": "securePassword123"
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "user": {
 *       "id": "cmlt...",
 *       "name": "Student Name",
 *       "email": "student@example.com",
 *       "createdAt": "2026-02-19T10:00:00.000Z"
 *     }
 *   },
 *   "message": "User registered successfully"
 * }
 *
 * Error Responses:
 * - 400: Validation error (invalid email, short password, etc.)
 * - 409: Email already exists
 * - 500: Server error
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();

    // Validate request body
    const validationResult = signupSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { name, email, password } = validationResult.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiConflict(
        "An account with this email already exists",
        undefined,
        requestId
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data and token
    return apiCreated(
      {
        token,
        user,
      },
      "User registered successfully",
      requestId
    );
  } catch (error) {
    // Handle Prisma errors (e.g., unique constraint violation)
    const prismaError = handlePrismaError(error, requestId);
    if (prismaError) {
      return prismaError;
    }

    // Handle other errors
    return apiServerError(error, requestId);
  }
}
