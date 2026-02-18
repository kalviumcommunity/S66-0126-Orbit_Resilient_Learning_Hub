import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/users/enroll
 *
 * Enrolls a new student using an atomic transaction.
 *
 * Transaction ensures:
 * 1. User is created
 * 2. All existing lessons are fetched
 * 3. Progress records are initialized for ALL lessons
 *
 * If any step fails, the entire transaction is rolled back.
 */
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Input validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password" },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Transaction: Create user + initialize all progress records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create the user
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password, // Note: In Auth module, password will be hashed with bcrypt
        },
      });

      // Step 2: Fetch all existing lessons
      const allLessons = await tx.lesson.findMany({
        select: { id: true },
      });

      // Step 3: Create progress records for all lessons
      if (allLessons.length > 0) {
        const progressRecords = allLessons.map((lesson) => ({
          userId: newUser.id,
          lessonId: lesson.id,
          completed: false,
          score: null,
        }));

        await tx.progress.createMany({
          data: progressRecords,
        });
      }

      return {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt,
        },
        progressInitialized: allLessons.length,
      };
    });

    return NextResponse.json(
      {
        message: "Student enrolled successfully",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    // Transaction will automatically rollback on error
    console.error("Enrollment transaction failed:", error);

    // Handle Prisma unique constraint violation (duplicate email)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: "Failed to enroll student",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
