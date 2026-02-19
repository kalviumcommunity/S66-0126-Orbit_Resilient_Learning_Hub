import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/users/:userId
 *
 * Retrieves a single user by ID.
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Query Parameters:
 * - includeProgress: Include progress summary (true/false)
 *
 * Response: 200 OK with user data
 * Error: 404 Not Found if user doesn't exist
 *
 * Note: Password field is always excluded for security.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const includeProgress = searchParams.get("includeProgress") === "true";

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        ...(includeProgress && {
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
                order: "asc",
              },
            },
          },
        }),
        _count: {
          select: {
            progress: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: `User with id ${userId} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("[API] GET /api/users/:userId failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/:userId
 *
 * Updates an existing user (partial update).
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Request Body (all fields optional):
 * {
 *   name?: string,
 *   email?: string
 * }
 *
 * Response: 200 OK with updated user data
 * Error: 400 Bad Request, 404 Not Found, 409 Conflict, 500 Internal Error
 *
 * Note: Password updates should be handled through a dedicated
 * password change endpoint with proper authentication.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();

    // Extract only allowed fields for update
    const { name, email } = body;

    // Validate at least one field is provided
    if (!name && !email) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "At least one field (name, email) must be provided",
        },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          {
            error: "Bad Request",
            message: "Invalid email format",
          },
          { status: 400 }
        );
      }
    }

    // Build update data object
    const updateData: { name?: string; email?: string } = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("[API] PATCH /api/users/:userId failed:", error);

    // Handle record not found
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "User not found",
        },
        { status: 404 }
      );
    }

    // Handle unique constraint violation (duplicate email)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "Email already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:userId
 *
 * Deletes a user account.
 *
 * Path Parameters:
 * - userId: User ID (CUID)
 *
 * Response: 204 No Content
 * Error: 404 Not Found, 500 Internal Error
 *
 * Note: Due to ON DELETE CASCADE in schema,
 * all related progress records will be automatically deleted.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    await prisma.user.delete({
      where: { id: userId },
    });

    // 204 No Content - successful deletion
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API] DELETE /api/users/:userId failed:", error);

    // Handle record not found
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to delete user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
