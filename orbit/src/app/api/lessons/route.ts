import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/lessons
 *
 * Retrieves all lessons ordered by sequence.
 * Optimized with field selection and indexed ordering.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

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
      });

      return NextResponse.json({
        lessons: lessons.map((lesson) => ({
          ...lesson,
          userProgress: lesson.progress[0] || null,
          progress: undefined, // Remove the array wrapper
        })),
      });
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
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error("Lessons query failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch lessons",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
