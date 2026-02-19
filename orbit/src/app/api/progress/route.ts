import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiPaginated,
  apiBadRequest,
  apiValidationError,
  apiForbidden,
  apiCreated,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";
import { createProgressSchema } from "@/lib/schemas";
import { withAuth } from "@/lib/auth/middleware";

/**
 * GET /api/progress
 *
 * Retrieves progress records with optional filtering.
 *
 * Query Parameters:
 * - userId: Filter by user ID (required for student view)
 * - lessonId: Filter by lesson ID
 * - completed: Filter by completion status (true/false)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 *
 * Response Format:
 * {
 *   data: Progress[],
 *   pagination: { page, limit, total, totalPages, hasMore }
 * }
 *
 * Status Codes:
 * - 200: Success
 * - 400: Bad Request (missing required parameters)
 * - 500: Internal Server Error
 */
export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const lessonId = searchParams.get("lessonId");
    const completed = searchParams.get("completed");

    // At least one filter is required for performance reasons
    if (!userId && !lessonId) {
      return apiBadRequest(
        "Either userId or lessonId parameter is required",
        undefined,
        requestId
      );
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      ...(userId && { userId }),
      ...(lessonId && { lessonId }),
      ...(completed !== null && { completed: completed === "true" }),
    };

    // Get total count
    const total = await prisma.progress.count({ where });

    // Fetch progress records with related data
    const progressRecords = await prisma.progress.findMany({
      where,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ lesson: { order: "asc" } }, { updatedAt: "desc" }],
      skip,
      take: limit,
    });

    return apiPaginated(
      progressRecords,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + progressRecords.length < total,
      },
      requestId
    );
  } catch (error) {
    console.error("[API] GET /api/progress failed:", error);
    return apiServerError(error, requestId);
  }
}

/**
 * POST /api/progress
 *
 * Creates or updates a progress record for a user-lesson pair (UPSERT).
 * Requires authentication - users can only update their own progress.
 *
 * Request Headers:
 * - Authorization: Bearer <token>
 *
 * Request Body:
 * {
 *   userId: string (CUID format),
 *   lessonId: string (CUID format),
 *   completed: boolean,
 *   score?: number | null (0-100 or null)
 * }
 *
 * Response: 201 Created with progress data
 * Error: 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden, 500 Internal Error
 *
 * UPSERT Behavior (Offline Sync Support):
 * - If progress record exists (userId + lessonId), it will be UPDATED
 * - If progress record doesn't exist, it will be CREATED
 * - This prevents 409 Conflict errors when syncing offline data
 * - Critical for rural students who may sync the same progress multiple times
 *
 * Note: Uses Prisma's composite unique constraint (userId_lessonId)
 * defined in the schema: @@unique([userId, lessonId])
 */
export const POST = withAuth(async (request, _context, authenticatedUserId) => {
  const requestId = generateRequestId();

  try {
    const body = await request.json();

    // Validate request body with Zod schema
    const validationResult = createProgressSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { userId, lessonId, completed, score = null } = validationResult.data;

    // Authorization check: users can only update their own progress
    if (userId !== authenticatedUserId) {
      return apiForbidden("You can only update your own progress", requestId);
    }

    // UPSERT progress record (create or update)
    // This is critical for offline sync - prevents 409 conflicts
    const progress = await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      update: {
        completed,
        score,
        updatedAt: new Date(),
      },
      create: {
        userId,
        lessonId,
        completed,
        score,
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            order: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return apiCreated(progress, "Progress synced successfully", requestId);
  } catch (error) {
    console.error("[API] POST /api/progress failed:", error);

    // Try Prisma error handler first (handles foreign key violations)
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    // Fallback to server error
    return apiServerError(error, requestId);
  }
});
