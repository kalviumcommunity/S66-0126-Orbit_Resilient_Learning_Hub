import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiPaginated,
  apiCreated,
  apiValidationError,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";
import { createUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";

/**
 * GET /api/users
 *
 * Retrieves a list of users with pagination.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - email: Filter by email (exact match)
 *
 * Response Format:
 * {
 *   data: User[],
 *   pagination: { page, limit, total, totalPages, hasMore }
 * }
 *
 * Note: Password field is excluded for security.
 */
export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50, // Lower max for user queries
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const skip = (page - 1) * limit;

    const email = searchParams.get("email");

    // Build where clause
    const where = email ? { email } : {};

    // Get total count
    const total = await prisma.user.count({ where });

    // Fetch users (exclude password field)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            progress: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    return apiPaginated(
      users,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
      },
      requestId
    );
  } catch (error) {
    console.error("[API] GET /api/users failed:", error);
    return apiServerError(error, requestId);
  }
}

/**
 * POST /api/users
 *
 * Creates a new user account.
 *
 * Request Body:
 * {
 *   name: string (1-100 chars),
 *   email: string (valid email, unique),
 *   password: string (min 8 chars)
 * }
 *
 * Response: 201 Created with user data
 * Error: 400 Bad Request (validation), 409 Conflict (duplicate email), 500 Internal Error
 *
 * Security: Passwords are hashed with bcrypt (10 rounds) before storage.
 *
 * Note: This is a basic user creation endpoint.
 * The enrollment endpoint (/api/users/enroll) includes
 * automatic progress initialization for all lessons.
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();

    // Validate request body with Zod schema
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { name, email, password } = validationResult.data;

    // Hash password before storage
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

    return apiCreated(user, "User created successfully", requestId);
  } catch (error) {
    console.error("[API] POST /api/users failed:", error);

    // Try Prisma error handler first (handles P2002 duplicate email)
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    return apiServerError(error, requestId);
  }
}
