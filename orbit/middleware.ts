import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "./src/lib/logger";

/**
 * Global Middleware for Orbit API
 *
 * Runs on all /api/* routes to provide:
 * - Request/response logging with timing
 * - Request ID generation for tracing
 * - Public route identification
 *
 * @module middleware
 */

/**
 * Check if a route is public
 *
 * @param pathname - Request pathname
 * @param method - HTTP method
 * @returns True if route is public
 */
function isPublicRoute(pathname: string, method: string): boolean {
  // Auth endpoints are always public
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }

  // Lessons GET is public (browsing), but POST/PATCH/DELETE require auth
  if (pathname === "/api/lessons" && method === "GET") {
    return true;
  }

  // Specific lesson GET is public
  if (pathname.match(/^\/api\/lessons\/[^/]+$/) && method === "GET") {
    return true;
  }

  return false;
}

/**
 * Next.js Middleware
 *
 * Intercepts all /api/* requests for logging and tracing.
 * Public routes and protected routes are distinguished for logging context.
 *
 * @param request - Incoming request
 * @returns Response or modified request
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const startTime = Date.now();

  // Only run middleware on API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Generate request ID for tracing
  const requestId = crypto.randomUUID();

  // Check if route is public
  const isPublic = isPublicRoute(pathname, method);

  // Log incoming request
  logger.info(
    {
      requestId,
      method,
      path: pathname,
      isPublic,
      userAgent: request.headers.get("user-agent"),
      ip: request.ip || request.headers.get("x-forwarded-for") || "unknown",
    },
    `Incoming ${method} ${pathname}`
  );

  // Continue to route handler
  const response = NextResponse.next();

  // Add request ID to response headers for client-side tracing
  response.headers.set("X-Request-Id", requestId);

  // Log response (approximate - actual status code set in handler)
  const duration = Date.now() - startTime;
  logger.info(
    {
      requestId,
      method,
      path: pathname,
      duration,
      isPublic,
    },
    `Completed ${method} ${pathname} in ${duration}ms`
  );

  return response;
}

/**
 * Middleware configuration
 *
 * Run middleware on all /api/* routes
 */
export const config = {
  matcher: "/api/:path*",
};
