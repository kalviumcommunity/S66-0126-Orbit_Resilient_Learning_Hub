import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiPaginated,
  apiServerError,
} from "@/lib/api-response";

/**
 * GET /api/lessons
 *
 * RESTful endpoint to retrieve lessons with optional pagination and filtering.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - userId: Filter to include user's progress
 *
 * Response Format:
 * {
 *   data: Lesson[],
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     total: number,
 *     totalPages: number,
 *     hasMore: boolean
 *   }
 * }
 *
 * Optimizations:
 * - Server-side pagination (skip/take) for low-bandwidth networks
 * - Field selection (no content field in list view)
 * - Indexed ordering on Lesson.order
 */
export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const skip = (page - 1) * limit;

    const userId = searchParams.get("userId");

    // Get total count for pagination metadata
    const total = await prisma.lesson.count();

    // If userId provided, include user's progress for each lesson
    if (userId) {
      const lessons = await prisma.lesson.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          order: true,
          updatedAt: true,
          progress: {
            where: { userId },
            select: {
              id: true,
              completed: true,
              score: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          order: "asc", // Uses index on Lesson.order
        },
        skip,
        take: limit,
      });

      return apiPaginated(
        lessons.map((lesson) => ({
          ...lesson,
          userProgress: lesson.progress[0] || null,
          progress: undefined, // Remove the array wrapper
        })),
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + lessons.length < total,
        },
        requestId
      );
    }

    // Default: Return lessons without user progress
    const lessons = await prisma.lesson.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        order: true,
        updatedAt: true,
      },
      orderBy: {
        order: "asc", // Uses index on Lesson.order
      },
      skip,
      take: limit,
    });

    return apiPaginated(
      lessons,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + lessons.length < total,
      },
      requestId
    );
  } catch (error) {
    console.error("[API] GET /api/lessons failed:", error);
    return apiServerError(error, requestId);
  }
}
