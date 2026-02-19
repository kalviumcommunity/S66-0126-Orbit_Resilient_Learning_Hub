import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiForbidden,
  apiServerError,
} from "@/lib/api-response";
import { withRole } from "@/lib/auth/rbac";

/**
 * GET /api/users/[userId]/dashboard
 *
 * Optimized dashboard query for student progress overview.
 * Requires authentication - users can access their own dashboard, or TEACHER/ADMIN can access any dashboard.
 *
 * Request Headers:
 * - Authorization: Bearer <token>
 *
 * Optimizations applied:
 * 1. Single query with nested select (no N+1 problem)
 * 2. Only fetches needed fields (no over-fetching)
 * 3. Leverages indexes on userId and lesson.order
 * 4. Client-side aggregation for statistics
 *
 * Security: Users can view their own dashboard, TEACHER/ADMIN can view any dashboard
 */
export const GET = withRole<{ userId: string }>(
  ["STUDENT", "TEACHER", "ADMIN"],
  async (_request, context, user) => {
    const requestId = generateRequestId();

    try {
      const { userId } = await context.params;

      // Authorization check: users can access their own dashboard, or TEACHER/ADMIN can access any
      if (
        userId !== user.id &&
        user.role !== "TEACHER" &&
        user.role !== "ADMIN"
      ) {
        return apiForbidden(
          "You can only access your own dashboard",
          "INSUFFICIENT_PERMISSIONS",
          requestId
        );
      }

      // Single optimized query: Fetch user with all progress in one database call
      const dashboardData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
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

      console.log(
        `[API] Dashboard accessed for user ${userId} by ${user.id} (${user.role})`
      );

      // Build response with structured data
      return apiSuccess(
        {
          user: {
            id: dashboardData.id,
            name: dashboardData.name,
            email: dashboardData.email,
            role: dashboardData.role,
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
  }
);
