import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/users
 *
 * Retrieves a list of users with pagination.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - email: Filter by email (exact match)
 *
 * Response Format:
 * {
 *   data: User[],
 *   pagination: { page, limit, total, totalPages, hasMore }
 * }
 *
 * Note: Password field is excluded for security.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50, // Lower max for user queries
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const skip = (page - 1) * limit;

    const email = searchParams.get("email");

    // Build where clause
    const where = email ? { email } : {};

    // Get total count
    const total = await prisma.user.count({ where });

    // Fetch users (exclude password field)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            progress: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    console.error("[API] GET /api/users failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 *
 * Creates a new user account.
 *
 * Request Body:
 * {
 *   name: string,
 *   email: string (unique),
 *   password: string (will be hashed in Auth module)
 * }
 *
 * Response: 201 Created with user data
 * Error: 400 Bad Request, 409 Conflict (duplicate email), 500 Internal Error
 *
 * Note: This is a basic user creation endpoint.
 * The enrollment endpoint (/api/users/enroll) includes
 * automatic progress initialization for all lessons.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "name, email, and password are required",
        },
        { status: 400 }
      );
    }

    // Validate email format
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

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password, // Note: In Auth module, this will be hashed with bcrypt
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] POST /api/users failed:", error);

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
        error: "Failed to create user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
