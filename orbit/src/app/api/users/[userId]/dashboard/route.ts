import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/users/[userId]/dashboard
 *
 * Optimized dashboard query for student progress overview.
 *
 * Optimizations applied:
 * 1. Single query with nested select (no N+1 problem)
 * 2. Only fetches needed fields (no over-fetching)
 * 3. Leverages indexes on userId and lesson.order
 * 4. Client-side aggregation for statistics
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Dashboard query failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
