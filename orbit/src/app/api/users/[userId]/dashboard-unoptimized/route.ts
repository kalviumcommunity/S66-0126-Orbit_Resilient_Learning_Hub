import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/users/[userId]/dashboard-unoptimized
 *
 * INTENTIONALLY INEFFICIENT VERSION for performance comparison.
 *
 * Anti-patterns demonstrated:
 * 1. Multiple separate queries (N+1 problem)
 * 2. Over-fetching with include: true (fetches all fields)
 * 3. No field selection (unnecessary data transfer)
 * 4. Inefficient filtering and mapping
 *
 * ⚠️ DO NOT USE IN PRODUCTION - For benchmarking only!
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // ANTI-PATTERN 1: Separate query for user (first database call)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // Over-fetching: Gets all user fields even though we don't need all
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ANTI-PATTERN 2: Second separate query for progress (second database call)
    const progressRecords = await prisma.progress.findMany({
      where: { userId },
      include: {
        lesson: true, // Over-fetching: Gets ALL lesson fields (including content!)
      },
    });

    // ANTI-PATTERN 3: Additional query to get all lessons (third database call)
    const allLessons = await prisma.lesson.findMany({
      // No field selection - fetches everything including large content field
    });

    // ANTI-PATTERN 4: Inefficient client-side operations
    let completedCount = 0;
    let totalScore = 0;
    let scoreCount = 0;

    // Inefficient loop instead of using array methods
    for (let i = 0; i < progressRecords.length; i++) {
      if (progressRecords[i].completed) {
        completedCount++;
      }
      if (progressRecords[i].score !== null) {
        totalScore += progressRecords[i].score!;
        scoreCount++;
      }
    }

    const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

    // Build response with excessive data
    return NextResponse.json({
      user: user, // Returns ALL user fields including password hash!
      stats: {
        totalLessons: progressRecords.length,
        completedLessons: completedCount,
        incompleteLessons: progressRecords.length - completedCount,
        completionRate:
          progressRecords.length > 0
            ? Math.round((completedCount / progressRecords.length) * 100)
            : 0,
        averageScore: Math.round(averageScore),
        totalScores: scoreCount,
      },
      progress: progressRecords, // Includes ALL lesson content (large text fields)
      allLessons: allLessons, // Unnecessary data - not even used!
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
