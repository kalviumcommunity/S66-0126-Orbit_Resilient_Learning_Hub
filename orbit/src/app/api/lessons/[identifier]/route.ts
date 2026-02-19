import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/lessons/:identifier
 *
 * Retrieves a single lesson by ID or slug.
 * Supports CUID (id) or human-readable slug for flexible routing.
 *
 * Path Parameters:
 * - identifier: Lesson ID (cuid) or slug (string)
 *
 * Query Parameters:
 * - userId: Include user's progress for this lesson
 *
 * Response: 200 OK with lesson data
 * Error: 404 Not Found if lesson doesn't exist
 *
 * Examples:
 * - GET /api/lessons/cmlrtkpu400016zsbfm1c2vy1
 * - GET /api/lessons/intro-to-offline-apps
 * - GET /api/lessons/intro-to-offline-apps?userId=xyz123
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Determine if identifier is a CUID (starts with 'c') or a slug
    const isCuid = identifier.startsWith("c") && identifier.length > 20;

    // Build where clause for flexible ID/slug lookup
    const where = isCuid ? { id: identifier } : { slug: identifier };

    // Fetch lesson with optional user progress
    const lesson = await prisma.lesson.findUnique({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        content: true, // Include full content for detail view
        order: true,
        updatedAt: true,
        ...(userId && {
          progress: {
            where: { userId },
            select: {
              id: true,
              completed: true,
              score: true,
              updatedAt: true,
            },
          },
        }),
      },
    });

    if (!lesson) {
      return NextResponse.json(
        {
          error: "Lesson not found",
          message: `No lesson found with ${isCuid ? "id" : "slug"}: ${identifier}`,
        },
        { status: 404 }
      );
    }

    // Format response
    const response = {
      ...lesson,
      ...(userId && {
        userProgress: lesson.progress?.[0] || null,
        progress: undefined,
      }),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("[API] GET /api/lessons/:identifier failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch lesson",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
