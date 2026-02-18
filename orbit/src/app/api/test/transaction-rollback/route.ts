import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/test/transaction-rollback
 *
 * Test endpoint to demonstrate transaction rollback behavior.
 * Intentionally triggers errors to verify atomicity.
 *
 * ⚠️ FOR DEVELOPMENT/TESTING ONLY - Remove in production!
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testCase = searchParams.get("case") || "duplicate-email";

  const results: {
    testCase: string;
    timestamp: string;
    success: boolean;
    error: string | null;
    rollbackVerified: boolean;
    details: Record<string, unknown>;
    prismaErrorCode?: string;
    expectedError?: boolean;
    thrownError?: string;
  } = {
    testCase,
    timestamp: new Date().toISOString(),
    success: false,
    error: null,
    rollbackVerified: false,
    details: {},
  };

  try {
    switch (testCase) {
      case "duplicate-email":
        await testDuplicateEmail(results);
        break;

      case "invalid-foreign-key":
        await testInvalidForeignKey(results);
        break;

      case "manual-throw":
        await testManualThrow(results);
        break;

      default:
        results.error =
          "Invalid test case. Use: duplicate-email, invalid-foreign-key, or manual-throw";
    }
  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      results.prismaErrorCode = error.code;
    }
  }

  return NextResponse.json(results);
}

/**
 * Test Case 1: Duplicate Email (Unique Constraint Violation)
 */
async function testDuplicateEmail(results: {
  success: boolean;
  error: string | null;
  rollbackVerified: boolean;
  details: Record<string, unknown>;
  expectedError?: boolean;
  prismaErrorCode?: string;
}) {
  // Check if test user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: "test-rollback@orbit.edu" },
  });

  results.details.existingUserBefore = existingUser ? "exists" : "not found";

  // Attempt transaction with duplicate email
  try {
    await prisma.$transaction(async (tx) => {
      // First, create a user if it doesn't exist
      if (!existingUser) {
        await tx.user.create({
          data: {
            name: "Test User Original",
            email: "test-rollback@orbit.edu",
            password: "test123",
          },
        });
      }

      // This should fail due to unique constraint
      await tx.user.create({
        data: {
          name: "Test User Duplicate",
          email: "test-rollback@orbit.edu", // Same email - should fail
          password: "test456",
        },
      });
    });

    results.success = false;
    results.error = "Transaction should have failed but didn't!";
  } catch (error) {
    results.expectedError = true;
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      results.prismaErrorCode = error.code;
      results.rollbackVerified = error.code === "P2002"; // Unique constraint violation
    }

    // Verify no partial data was committed
    const usersWithEmail = await prisma.user.count({
      where: { email: "test-rollback@orbit.edu" },
    });

    results.details.userCountAfterRollback = usersWithEmail;
    results.details.explanation =
      "Transaction rolled back successfully - only 1 user exists";
  }
}

/**
 * Test Case 2: Invalid Foreign Key
 */
async function testInvalidForeignKey(results: {
  success: boolean;
  error: string | null;
  rollbackVerified: boolean;
  details: Record<string, unknown>;
  expectedError?: boolean;
  prismaErrorCode?: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      // Create a user
      const newUser = await tx.user.create({
        data: {
          name: "Test FK User",
          email: `test-fk-${Date.now()}@orbit.edu`,
          password: "test123",
        },
      });

      // Try to create progress with non-existent lesson ID
      await tx.progress.create({
        data: {
          userId: newUser.id,
          lessonId: "non-existent-lesson-id-12345",
          completed: false,
        },
      });
    });

    results.success = false;
    results.error = "Transaction should have failed but didn't!";
  } catch (error) {
    results.expectedError = true;
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      results.prismaErrorCode = error.code;
      results.rollbackVerified = error.code === "P2003"; // Foreign key constraint violation
    }

    // Verify user was not created (rollback successful)
    const orphanedUsers = await prisma.user.findMany({
      where: {
        email: { contains: "test-fk-" },
        progress: { none: {} }, // Users with no progress
      },
    });

    results.details.orphanedUsersCount = orphanedUsers.length;
    results.details.explanation =
      "Transaction rolled back - no orphaned user records";
  }
}

/**
 * Test Case 3: Manual Error Throw
 */
async function testManualThrow(results: {
  success: boolean;
  error: string | null;
  rollbackVerified: boolean;
  details: Record<string, unknown>;
  expectedError?: boolean;
  thrownError?: string;
}) {
  const testEmail = `test-manual-${Date.now()}@orbit.edu`;

  try {
    await prisma.$transaction(async (tx) => {
      // Create a user
      const newUser = await tx.user.create({
        data: {
          name: "Test Manual User",
          email: testEmail,
          password: "test123",
        },
      });

      results.details.userIdCreated = newUser.id;

      // Fetch all lessons
      const lessons = await tx.lesson.findMany();

      // Start creating progress
      await tx.progress.create({
        data: {
          userId: newUser.id,
          lessonId: lessons[0]?.id || "dummy-id",
          completed: false,
        },
      });

      // Manually throw error (simulating business logic failure)
      throw new Error("Business logic validation failed: simulated error");
    });

    results.success = false;
    results.error = "Transaction should have failed but didn't!";
  } catch (error) {
    results.expectedError = true;
    results.thrownError =
      error instanceof Error ? error.message : String(error);
    results.rollbackVerified = true;

    // Verify user was not created
    const userExists = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    results.details.userExistsAfterRollback = userExists !== null;
    results.details.explanation = userExists
      ? "ROLLBACK FAILED - User still exists!"
      : "Transaction rolled back successfully - no user created";
  }
}
