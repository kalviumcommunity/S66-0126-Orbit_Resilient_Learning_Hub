import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiCreated,
  apiValidationError,
  apiConflict,
  apiServerError,
  apiForbidden,
  handlePrismaError,
} from "@/lib/api-response";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, verifyToken } from "@/lib/auth/jwt";
import { UserRole } from "@prisma/client";

/**
 * POST /api/auth/signup
 *
 * Register a new user and return JWT token
 *
 * Request Body:
 * {
 *   "name": "Student Name",
 *   "email": "student@example.com",
 *   "password": "securePassword123",
 *   "role": "STUDENT" // Optional: STUDENT (default), TEACHER, ADMIN
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
 *       "role": "STUDENT",
 *       "createdAt": "2026-02-19T10:00:00.000Z"
 *     }
 *   },
 *   "message": "User registered successfully"
 * }
 *
 * Error Responses:
 * - 400: Validation error (invalid email, short password, etc.)
 * - 403: Privilege escalation attempt (creating TEACHER/ADMIN without admin rights)
 * - 409: Email already exists
 * - 500: Server error
 *
 * Security Note:
 * - Only ADMIN users can create TEACHER or ADMIN accounts
 * - Public signups default to STUDENT role
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

    const { name, email, password, role } = validationResult.data;

    // Security: Privilege escalation check
    // Only ADMIN users can create TEACHER or ADMIN accounts
    const requestedRole = role || UserRole.STUDENT;

    if (requestedRole !== UserRole.STUDENT) {
      // Extract token from Authorization header
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

      if (!token) {
        return apiForbidden(
          "Only administrators can create TEACHER or ADMIN accounts",
          "PRIVILEGE_ESCALATION",
          requestId
        );
      }

      // Verify the requesting user is an ADMIN
      const payload = verifyToken(token);
      if (!payload || payload.role !== UserRole.ADMIN) {
        return apiForbidden(
          "Only administrators can create TEACHER or ADMIN accounts",
          "PRIVILEGE_ESCALATION",
          requestId
        );
      }
    }

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
        role: requestedRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate JWT token with role
    const jwtToken = generateToken(user.id, user.role);

    // Return user data and token
    return apiCreated(
      {
        token: jwtToken,
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
