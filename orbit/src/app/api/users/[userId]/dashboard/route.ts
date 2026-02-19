import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiForbidden,
  apiServerError,
} from "@/lib/api-response";
import { withAuth } from "@/lib/auth/middleware";

/**
 * GET /api/users/[userId]/dashboard
 *
 * Optimized dashboard query for student progress overview.
 * Requires authentication - users can only access their own dashboard.
 *
 * Request Headers:
 * - Authorization: Bearer <token>
 *
 * Optimizations applied:
 * 1. Single query with nested select (no N+1 problem)
 * 2. Only fetches needed fields (no over-fetching)
 * 3. Leverages indexes on userId and lesson.order
 * 4. Client-side aggregation for statistics
 */
export const GET = withAuth(async (_request, context, authenticatedUserId) => {
  const requestId = generateRequestId();

  try {
    const { userId } = await context.params;

    // Authorization check: users can only access their own dashboard
    if (userId !== authenticatedUserId) {
      return apiForbidden("You can only access your own dashboard", requestId);
    }

    // Single optimized query: Fetch user with all progress in one database call
    const dashboardData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
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
              order: "asc", // Uses index on Lesson.order
            },
          },
        },
      },
    });

    if (!dashboardData) {
      return apiNotFound("User", userId, requestId);
    }

    // Calculate statistics (client-side aggregation - lightweight)
    const totalLessons = dashboardData.progress.length;
    const completedLessons = dashboardData.progress.filter(
      (p) => p.completed
    ).length;

    const scoresArray = dashboardData.progress
      .filter((p) => p.score !== null)
      .map((p) => p.score!);

    const averageScore =
      scoresArray.length > 0
        ? scoresArray.reduce((sum, score) => sum + score, 0) /
          scoresArray.length
        : 0;

    // Build response with structured data
    return apiSuccess(
      {
        user: {
          id: dashboardData.id,
          name: dashboardData.name,
          email: dashboardData.email,
          createdAt: dashboardData.createdAt,
        },
        stats: {
          totalLessons,
          completedLessons,
          incompleteLessons: totalLessons - completedLessons,
          completionRate:
            totalLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0,
          averageScore: Math.round(averageScore),
          totalScores: scoresArray.length,
        },
        progress: dashboardData.progress.map((p) => ({
          id: p.id,
          completed: p.completed,
          score: p.score,
          updatedAt: p.updatedAt,
          lesson: p.lesson,
        })),
      },
      requestId
    );
  } catch (error) {
    console.error("Dashboard query failed:", error);
    return apiServerError(error, requestId);
  }
});
