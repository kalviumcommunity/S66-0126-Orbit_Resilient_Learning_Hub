import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiServerError,
} from "@/lib/api-response";
import { withRole } from "@/lib/auth/rbac";
import { z } from "zod";

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
 *
 * Security: Public endpoint (no authentication required)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const requestId = generateRequestId();

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
      return apiNotFound("Lesson", identifier, requestId);
    }

    // Format response
    const response = {
      ...lesson,
      ...(userId && {
        userProgress: lesson.progress?.[0] || null,
        progress: undefined,
      }),
    };

    return apiSuccess(response, requestId);
  } catch (error) {
    console.error("[API] GET /api/lessons/:identifier failed:", error);
    return apiServerError(error, requestId);
  }
}

// Validation schema for lesson updates
const updateLessonSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title too long")
      .optional(),
    slug: z
      .string()
      .min(1, "Slug is required")
      .max(100, "Slug too long")
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must contain only lowercase letters, numbers, and hyphens"
      )
      .optional(),
    content: z.string().min(1, "Content is required").optional(),
    order: z
      .number()
      .int()
      .min(0, "Order must be a non-negative integer")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/**
 * PATCH /api/lessons/:identifier
 *
 * Updates an existing lesson. Only accessible to TEACHER and ADMIN roles.
 *
 * Path Parameters:
 * - identifier: Lesson ID (cuid) or slug (string)
 *
 * Request Body (all fields optional):
 * {
 *   "title": "Updated Title",
 *   "slug": "updated-slug",
 *   "content": "# Updated Content...",
 *   "order": 2
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cmlt...",
 *     "title": "Updated Title",
 *     "slug": "updated-slug",
 *     "content": "# Updated Content...",
 *     "order": 2,
 *     "updatedAt": "2026-02-19T10:30:00.000Z"
 *   },
 *   "message": "Lesson updated successfully"
 * }
 *
 * Security: Requires TEACHER or ADMIN role
 */
export const PATCH = withRole<{ identifier: string }>(
  ["TEACHER", "ADMIN"],
  async (request, { params }, user) => {
    const requestId = generateRequestId();

    try {
      const { identifier } = await params;
      const body = await request.json();

      // Validate request body
      const validationResult = updateLessonSchema.safeParse(body);
      if (!validationResult.success) {
        return apiValidationError(validationResult.error, requestId);
      }

      const updateData = validationResult.data;

      // Determine if identifier is a CUID or slug
      const isCuid = identifier.startsWith("c") && identifier.length > 20;
      const where = isCuid ? { id: identifier } : { slug: identifier };

      // Check if lesson exists
      const existingLesson = await prisma.lesson.findUnique({ where });
      if (!existingLesson) {
        return apiNotFound("Lesson", identifier, requestId);
      }

      // Update lesson
      const updatedLesson = await prisma.lesson.update({
        where,
        data: updateData,
      });

      console.log(
        `[API] Lesson updated by user ${user.id} (${user.role}):`,
        updatedLesson.id
      );

      return apiSuccess(
        updatedLesson,
        requestId,
        "Lesson updated successfully"
      );
    } catch (error) {
      console.error("[API] PATCH /api/lessons/:identifier failed:", error);
      return apiServerError(error, requestId);
    }
  }
);

/**
 * DELETE /api/lessons/:identifier
 *
 * Deletes a lesson. Only accessible to ADMIN role.
 *
 * Path Parameters:
 * - identifier: Lesson ID (cuid) or slug (string)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cmlt...",
 *     "title": "Deleted Lesson",
 *     "slug": "deleted-lesson"
 *   },
 *   "message": "Lesson deleted successfully"
 * }
 *
 * Error: 404 Not Found if lesson doesn't exist
 *
 * Security: Requires ADMIN role only
 */
export const DELETE = withRole<{ identifier: string }>(
  ["ADMIN"],
  async (_request, { params }, user) => {
    const requestId = generateRequestId();

    try {
      const { identifier } = await params;

      // Determine if identifier is a CUID or slug
      const isCuid = identifier.startsWith("c") && identifier.length > 20;
      const where = isCuid ? { id: identifier } : { slug: identifier };

      // Check if lesson exists
      const existingLesson = await prisma.lesson.findUnique({ where });
      if (!existingLesson) {
        return apiNotFound("Lesson", identifier, requestId);
      }

      // Delete lesson (CASCADE will handle related progress records)
      const deletedLesson = await prisma.lesson.delete({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
        },
      });

      console.log(
        `[API] Lesson deleted by user ${user.id} (ADMIN):`,
        deletedLesson.id
      );

      return apiSuccess(
        deletedLesson,
        requestId,
        "Lesson deleted successfully"
      );
    } catch (error) {
      console.error("[API] DELETE /api/lessons/:identifier failed:", error);
      return apiServerError(error, requestId);
    }
  }
);
