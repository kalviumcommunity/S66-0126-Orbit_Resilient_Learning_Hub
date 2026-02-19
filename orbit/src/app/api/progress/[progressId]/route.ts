import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiBadRequest,
  apiOutOfRange,
  apiNoContent,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";

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
 * Path Parameters:
 * - progressId: Progress record ID (CUID)
 *
 * Request Body (all fields optional):
 * {
 *   completed?: boolean,
 *   score?: number | null
 * }
 *
 * Response: 200 OK with updated progress data
 * Error: 400 Bad Request, 404 Not Found, 500 Internal Error
 *
 * Note: Uses PATCH (not PUT) for partial updates following REST conventions.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ progressId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { progressId } = await params;
    const body = await request.json();

    // Extract only allowed fields for update
    const { completed, score } = body;

    // Validate at least one field is provided
    if (completed === undefined && score === undefined) {
      return apiBadRequest(
        "At least one field (completed, score) must be provided",
        undefined,
        requestId
      );
    }

    // Validate score range if provided
    if (score !== undefined && score !== null && (score < 0 || score > 100)) {
      return apiOutOfRange("score", 0, 100, requestId);
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
          },
        },
      },
    });

    return apiSuccess(progress, requestId);
  } catch (error) {
    console.error("[API] PATCH /api/progress/:progressId failed:", error);

    // Try Prisma error handler first
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    return apiServerError(error, requestId);
  }
}

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
