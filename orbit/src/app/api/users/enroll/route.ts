import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiCreated,
  apiValidationError,
  apiServerError,
  handlePrismaError,
} from "@/lib/api-response";
import { createUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";

/**
 * POST /api/users/enroll
 *
 * Enrolls a student using an atomic transaction with UPSERT support.
 *
 * Request Body:
 * {
 *   name: string (1-100 chars),
 *   email: string (valid email),
 *   password: string (min 8 chars)
 * }
 *
 * Transaction ensures:
 * 1. User is created or updated (UPSERT on email)
 * 2. All existing lessons are fetched
 * 3. Progress records are initialized for ALL lessons (UPSERT on userId+lessonId)
 *
 * UPSERT Behavior (Offline Sync Support):
 * - User: If email exists, updates name and password
 * - Progress: If userId+lessonId exists, updates the record
 * - This prevents 409 Conflict errors when re-enrolling or syncing
 *
 * If any step fails, the entire transaction is rolled back.
 *
 * Response: 201 Created with user data and progress count
 * Error: 400 Bad Request (validation), 500 Internal Error
 *
 * Security: Password is hashed with bcrypt before storage.
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();

    // Validate request body with Zod schema
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return apiValidationError(validationResult.error, requestId);
    }

    const { name, email, password } = validationResult.data;

    // Hash password before storage
    const hashedPassword = await hashPassword(password);

    // Transaction: Upsert user + upsert all progress records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Upsert the user (create or update on email)
      const newUser = await tx.user.upsert({
        where: { email },
        update: {
          name,
          password: hashedPassword,
        },
        create: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Step 2: Fetch all existing lessons
      const allLessons = await tx.lesson.findMany({
        select: { id: true },
      });

      // Step 3: Upsert progress records for all lessons
      let progressCount = 0;
      if (allLessons.length > 0) {
        // Use Promise.all to upsert all progress records in parallel
        await Promise.all(
          allLessons.map((lesson) =>
            tx.progress.upsert({
              where: {
                userId_lessonId: {
                  userId: newUser.id,
                  lessonId: lesson.id,
                },
              },
              update: {
                // Don't overwrite existing progress data
                // Keep completed and score as they are
              },
              create: {
                userId: newUser.id,
                lessonId: lesson.id,
                completed: false,
                score: null,
              },
            })
          )
        );
        progressCount = allLessons.length;
      }

      return {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt,
        },
        progressInitialized: progressCount,
      };
    });

    return apiCreated(result, "Student enrolled successfully", requestId);
  } catch (error) {
    // Transaction will automatically rollback on error
    console.error("Enrollment transaction failed:", error);

    // Try Prisma error handler first
    const prismaResponse = handlePrismaError(error, requestId);
    if (prismaResponse) return prismaResponse;

    // Handle other errors
    return apiServerError(error, requestId);
  }
}
