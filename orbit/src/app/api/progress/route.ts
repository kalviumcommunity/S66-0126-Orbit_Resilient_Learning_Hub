import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const lessonId = searchParams.get("lessonId");
    const completed = searchParams.get("completed");

    // At least one filter is required for performance reasons
    if (!userId && !lessonId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Either userId or lessonId parameter is required",
        },
        { status: 400 }
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

    return NextResponse.json({
      data: progressRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + progressRecords.length < total,
      },
    });
  } catch (error) {
    console.error("[API] GET /api/progress failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch progress records",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/progress
 *
 * Creates a new progress record for a user-lesson pair.
 *
 * Request Body:
 * {
 *   userId: string,
 *   lessonId: string,
 *   completed?: boolean (default: false),
 *   score?: number | null
 * }
 *
 * Response: 201 Created with progress data
 * Error: 400 Bad Request, 409 Conflict (duplicate), 500 Internal Error
 *
 * Note: Uses Prisma's unique constraint (userId + lessonId)
 * to prevent duplicate progress records.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, lessonId, completed = false, score = null } = body;

    // Validate required fields
    if (!userId || !lessonId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "userId and lessonId are required",
        },
        { status: 400 }
      );
    }

    // Validate score range if provided
    if (score !== null && (score < 0 || score > 100)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Score must be between 0 and 100",
        },
        { status: 400 }
      );
    }

    // Create progress record
    const progress = await prisma.progress.create({
      data: {
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

    return NextResponse.json(
      {
        message: "Progress record created successfully",
        data: progress,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] POST /api/progress failed:", error);

    // Handle Prisma unique constraint violation
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "Progress record already exists for this user-lesson pair",
        },
        { status: 409 }
      );
    }

    // Handle foreign key constraint violation
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Invalid userId or lessonId",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create progress record",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
