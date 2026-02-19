import { prisma } from "@/lib/prisma";
import {
  generateRequestId,
  apiPaginated,
  apiCreated,
  apiValidationError,
  apiServerError,
} from "@/lib/api-response";
import { withRole } from "@/lib/auth/rbac";
import { z } from "zod";

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
 *
 * Security: Public endpoint (no authentication required)
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

// Validation schema for lesson creation
const createLessonSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100, "Slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  content: z.string().min(1, "Content is required"),
  order: z
    .number()
    .int()
    .min(0, "Order must be a non-negative integer")
    .optional(),
});

/**
 * POST /api/lessons
 *
 * Creates a new lesson. Only accessible to TEACHER and ADMIN roles.
 *
 * Request Body:
 * {
 *   "title": "Introduction to Offline Apps",
 *   "slug": "intro-to-offline-apps",
 *   "content": "# Lesson Content...",
 *   "order": 1 // Optional, defaults to next available order
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cmlt...",
 *     "title": "Introduction to Offline Apps",
 *     "slug": "intro-to-offline-apps",
 *     "content": "# Lesson Content...",
 *     "order": 1,
 *     "createdAt": "2026-02-19T10:00:00.000Z",
 *     "updatedAt": "2026-02-19T10:00:00.000Z"
 *   },
 *   "message": "Lesson created successfully"
 * }
 *
 * Security: Requires TEACHER or ADMIN role
 */
export const POST = withRole(
  ["TEACHER", "ADMIN"],
  async (request, _context, user) => {
    const requestId = generateRequestId();

    try {
      const body = await request.json();

      // Validate request body
      const validationResult = createLessonSchema.safeParse(body);
      if (!validationResult.success) {
        return apiValidationError(validationResult.error, requestId);
      }

      const { title, slug, content, order } = validationResult.data;

      // If order not provided, get next available order
      let lessonOrder = order;
      if (lessonOrder === undefined) {
        const maxOrder = await prisma.lesson.aggregate({
          _max: { order: true },
        });
        lessonOrder = (maxOrder._max.order ?? -1) + 1;
      }

      // Create lesson
      const lesson = await prisma.lesson.create({
        data: {
          title,
          slug,
          content,
          order: lessonOrder,
        },
      });

      console.log(
        `[API] Lesson created by user ${user.id} (${user.role}):`,
        lesson.id
      );

      return apiCreated(lesson, "Lesson created successfully", requestId);
    } catch (error) {
      console.error("[API] POST /api/lessons failed:", error);
      return apiServerError(error, requestId);
    }
  }
);
