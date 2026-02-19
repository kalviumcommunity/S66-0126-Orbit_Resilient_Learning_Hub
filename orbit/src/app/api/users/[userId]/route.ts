import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiNoContent,
  apiForbidden,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";
import { updateUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { withAuth } from "@/lib/auth/middleware";

/**
 * GET /api/users/:userId
 *
 * Retrieves a single user by ID.
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Query Parameters:
 * - includeProgress: Include progress summary (true/false)
 *
 * Response: 200 OK with user data
 * Error: 404 Not Found if user doesn't exist
 *
 * Note: Password field is always excluded for security.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const includeProgress = searchParams.get("includeProgress") === "true";

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        ...(includeProgress && {
          progress: {
            select: {
              id: true,
              completed: true,
              score: true,
              updatedAt: true,
              lesson: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  order: true,
                },
              },
            },
            orderBy: {
              lesson: {
                order: "asc",
              },
            },
          },
        }),
        _count: {
          select: {
            progress: true,
          },
        },
      },
    });

    if (!user) {
      return apiNotFound("User", userId, requestId);
    }

    return apiSuccess(user, requestId);
  } catch (error) {
    console.error("[API] GET /api/users/:userId failed:", error);
    return apiServerError(error, requestId);
  }
}

/**
 * PATCH /api/users/:userId
 *
 * Updates an existing user (partial update).
 * Requires authentication - users can only update their own profile.
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Request Headers:
 * - Authorization: Bearer <token>
 *
 * Request Body (at least one field required):
 * {
 *   name?: string (1-100 chars),
 *   email?: string (valid email),
 *   password?: string (min 8 chars, will be hashed)
 * }
 *
 * Response: 200 OK with updated user data
 * Error: 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Error
 *
 * Note: Password updates are allowed but should ideally be handled through
 * a dedicated password change endpoint with proper authentication in production.
 */
export const PATCH = withAuth(async (request, context, authenticatedUserId) => {
  const requestId = generateRequestId();

  try {
    const { userId } = await context.params;

    // Authorization check: users can only update their own profile
    if (userId !== authenticatedUserId) {
      return apiForbidden("You can only update your own profile", requestId);
    }

    const body = await request.json();

    // Validate request body with Zod schema
    const validationResult = updateUserSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { name, email, password } = validationResult.data;

    // Build update data object
    const updateData: { name?: string; email?: string; password?: string } = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      // Hash password if provided
      updateData.password = await hashPassword(password);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return apiSuccess(user, requestId);
  } catch (error) {
    console.error("[API] PATCH /api/users/:userId failed:", error);

    // Try Prisma error handler first (handles P2025 and P2002)
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    return apiServerError(error, requestId);
  }
});

/**
 * DELETE /api/users/:userId
 *
 * Deletes a user account.
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Response: 204 No Content
 * Error: 404 Not Found, 500 Internal Error
 *
 * Note: Due to ON DELETE CASCADE in schema,
 * all related progress records will be automatically deleted.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { userId } = await params;

    await prisma.user.delete({
      where: { id: userId },
    });

    // 204 No Content - successful deletion
    return apiNoContent(requestId);
  } catch (error) {
    console.error("[API] DELETE /api/users/:userId failed:", error);

    // Try Prisma error handler first
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    return apiServerError(error, requestId);
  }
}
