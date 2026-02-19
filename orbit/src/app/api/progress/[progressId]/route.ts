import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  request: Request,
  { params }: { params: Promise<{ progressId: string }> }
) {
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
      return NextResponse.json(
        {
          error: "Not Found",
          message: `Progress record with id ${progressId} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: progress });
  } catch (error) {
    console.error("[API] GET /api/progress/:progressId failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch progress record",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
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
  try {
    const { progressId } = await params;
    const body = await request.json();

    // Extract only allowed fields for update
    const { completed, score } = body;

    // Validate at least one field is provided
    if (completed === undefined && score === undefined) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "At least one field (completed, score) must be provided",
        },
        { status: 400 }
      );
    }

    // Validate score range if provided
    if (score !== undefined && score !== null && (score < 0 || score > 100)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Score must be between 0 and 100",
        },
        { status: 400 }
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
          },
        },
      },
    });

    return NextResponse.json({
      message: "Progress record updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error("[API] PATCH /api/progress/:progressId failed:", error);

    // Handle record not found
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Progress record not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update progress record",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
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
  request: Request,
  { params }: { params: Promise<{ progressId: string }> }
) {
  try {
    const { progressId } = await params;

    await prisma.progress.delete({
      where: { id: progressId },
    });

    // 204 No Content - successful deletion
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API] DELETE /api/progress/:progressId failed:", error);

    // Handle record not found
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Progress record not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to delete progress record",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
