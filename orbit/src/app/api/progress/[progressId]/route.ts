import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiNoContent,
  apiServerError,
  handlePrismaError,
  apiForbidden,
} from "@/lib/api-response";
import { updateProgressSchema } from "@/lib/schemas";
import { withRole } from "@/lib/auth/rbac";

/**
 * GET /api/progress/:progressId
 *
 * Retrieves a single progress record by its ID.
 *
 * Path Parameters:
 * - progressId: Progress record ID (CUID)
 *
 * Response: 200 OK with progress data
 * Error: 404 Not Found if progress doesn't exist
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ progressId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { progressId } = await params;

    const progress = await prisma.progress.findUnique({
      where: { id: progressId },
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

    if (!progress) {
      return apiNotFound("Progress record", progressId, requestId);
    }

    return apiSuccess(progress, requestId);
  } catch (error) {
    console.error("[API] GET /api/progress/:progressId failed:", error);
    return apiServerError(error, requestId);
  }
}

/**
 * PATCH /api/progress/:progressId
 *
 * Updates an existing progress record (partial update).
 *
 * Authentication: Required (JWT token via Authorization header)
 * Authorization: Users can update their own progress, TEACHER/ADMIN can update any progress
 *
 * Path Parameters:
 * - progressId: Progress record ID (CUID)
 *
 * Request Body (at least one field required):
 * {
 *   completed?: boolean,
 *   score?: number | null (0-100 or null)
 * }
 *
 * Response: 200 OK with updated progress data
 * Error: 400 Bad Request (validation), 401 Unauthorized (missing/invalid token),
 *        403 Forbidden (not owner), 404 Not Found, 500 Internal Error
 *
 * Security: Users can update their own progress, TEACHER/ADMIN can update any progress
 */
export const PATCH = withRole<{ progressId: string }>(
  ["STUDENT", "TEACHER", "ADMIN"],
  async (request, context, user) => {
    const requestId = generateRequestId();

    try {
      const { progressId } = await context.params;
      const body = await request.json();

      // Validate request body with Zod schema
      const validationResult = updateProgressSchema.safeParse(body);
      if (!validationResult.success) {
        return apiValidationError(validationResult.error, requestId);
      }

      const { completed, score } = validationResult.data;

      // Fetch existing progress record to verify ownership
      const existingProgress = await prisma.progress.findUnique({
        where: { id: progressId },
        select: { userId: true },
      });

      if (!existingProgress) {
        return apiNotFound("Progress record", progressId, requestId);
      }

      // Authorization: Verify user owns this progress record or is TEACHER/ADMIN
      if (
        existingProgress.userId !== user.id &&
        user.role !== "TEACHER" &&
        user.role !== "ADMIN"
      ) {
        return apiForbidden(
          "You can only update your own progress",
          "INSUFFICIENT_PERMISSIONS",
          requestId
        );
      }

      // Build update data object
      const updateData: { completed?: boolean; score?: number | null } = {};
      if (completed !== undefined) updateData.completed = completed;
      if (score !== undefined) updateData.score = score;

      // Update progress record
      const progress = await prisma.progress.update({
        where: { id: progressId },
        data: updateData,
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
              role: true,
            },
          },
        },
      });

      console.log(
        `[API] Progress ${progressId} updated by ${user.id} (${user.role})`
      );

      return apiSuccess(progress, requestId);
    } catch (error) {
      console.error("[API] PATCH /api/progress/:progressId failed:", error);

      // Try Prisma error handler first
      const prismaResponse = handlePrismaError(error, requestId);
      if (prismaResponse) return prismaResponse;

      return apiServerError(error, requestId);
    }
  }
);

/**
 * DELETE /api/progress/:progressId
 *
 * Deletes a progress record.
 *
 * Path Parameters:
 * - progressId: Progress record ID (CUID)
 *
 * Response: 204 No Content
 * Error: 404 Not Found, 500 Internal Error
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ progressId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { progressId } = await params;

    await prisma.progress.delete({
      where: { id: progressId },
    });

    // 204 No Content - successful deletion
    return apiNoContent(requestId);
  } catch (error) {
    console.error("[API] DELETE /api/progress/:progressId failed:", error);

    // Try Prisma error handler first
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    return apiServerError(error, requestId);
  }
}
