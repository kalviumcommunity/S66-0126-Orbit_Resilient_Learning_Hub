# Orbit API Documentation

## Overview

The Orbit API follows RESTful principles with predictable, resource-based URLs, HTTP verbs, and standard status codes. This documentation covers all available endpoints for managing users, lessons, and progress in the Orbit educational platform.

**Base URL:** `http://localhost:3000/api` (development)

---

## API Design Principles

### 1. Resource-Based Routing
- **Plural nouns** for resources: `/api/lessons`, `/api/users`, `/api/progress`
- **Hierarchical structure** for relationships: `/api/users/:userId/dashboard`
- **Self-documenting URLs**: Endpoint paths clearly indicate the resource being accessed

### 2. HTTP Verbs
| Verb | Purpose | Idempotent |
|------|---------|------------|
| `GET` | Retrieve resource(s) | ✅ Yes |
| `POST` | Create new resource | ❌ No |
| `PATCH` | Partial update | ✅ Yes |
| `PUT` | Full replacement | ✅ Yes |
| `DELETE` | Remove resource | ✅ Yes |

### 3. Status Codes
| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET/PATCH/PUT |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Invalid input |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource (unique constraint) |
| `500` | Internal Server Error | Server-side error |

### 4. Pagination
All list endpoints support pagination to minimize payload size for low-bandwidth networks:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max varies by endpoint)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasMore": true
  }
}
```

---

## Endpoints

### Users

#### `GET /api/users`
Retrieve a paginated list of users.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `email` (optional): Filter by exact email match

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "cmlrwcepo00005isbuxh5szih",
      "name": "Alice Johnson",
      "email": "alice@orbit.edu",
      "createdAt": "2026-02-18T10:35:52.571Z",
      "_count": {
        "progress": 10
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasMore": true
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/users?page=1&limit=10
```

---

#### `POST /api/users`
Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@orbit.edu",
  "password": "securepassword123"
}
```

**Response:** `201 Created`
```json
{
  "message": "User created successfully",
  "data": {
    "id": "cmlrwcepo00005isbuxh5szih",
    "name": "John Doe",
    "email": "john@orbit.edu",
    "createdAt": "2026-02-18T10:35:52.571Z"
  }
}
```

**Errors:**
- `400` - Missing required fields or invalid email format
- `409` - Email already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@orbit.edu","password":"pass123"}'
```

---

#### `GET /api/users/:userId`
Retrieve a single user by ID.

**Path Parameters:**
- `userId` - User ID (CUID)

**Query Parameters:**
- `includeProgress` (optional): Include progress summary (`true`/`false`)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "cmlrwcepo00005isbuxh5szih",
    "name": "Alice Johnson",
    "email": "alice@orbit.edu",
    "createdAt": "2026-02-18T10:35:52.571Z",
    "progress": [...],
    "_count": {
      "progress": 10
    }
  }
}
```

**Errors:**
- `404` - User not found

**Example:**
```bash
curl http://localhost:3000/api/users/cmlrwcepo00005isbuxh5szih?includeProgress=true
```

---

#### `PATCH /api/users/:userId`
Update user information (partial update).

**Path Parameters:**
- `userId` - User ID (CUID)

**Request Body:** (at least one field required)
```json
{
  "name": "Alice Smith",
  "email": "alice.smith@orbit.edu"
}
```

**Response:** `200 OK`
```json
{
  "message": "User updated successfully",
  "data": {
    "id": "cmlrwcepo00005isbuxh5szih",
    "name": "Alice Smith",
    "email": "alice.smith@orbit.edu",
    "createdAt": "2026-02-18T10:35:52.571Z"
  }
}
```

**Errors:**
- `400` - No fields provided or invalid email
- `404` - User not found
- `409` - Email already exists

---

#### `DELETE /api/users/:userId`
Delete a user account and all associated progress records.

**Path Parameters:**
- `userId` - User ID (CUID)

**Response:** `204 No Content`

**Errors:**
- `404` - User not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/users/cmlrwcepo00005isbuxh5szih
```

---

### Lessons

#### `GET /api/lessons`
Retrieve a paginated list of lessons.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `userId` (optional): Include user's progress for each lesson

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "cmlrtkpu400016zsbfm1c2vy1",
      "title": "Introduction to Offline Web Apps",
      "slug": "intro-to-offline-apps",
      "order": 1,
      "updatedAt": "2026-02-18T10:35:19.412Z",
      "userProgress": {
        "id": "cmlrwceq800015isbbfcp801b",
        "completed": false,
        "score": null,
        "updatedAt": "2026-02-18T10:35:52.592Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1,
    "hasMore": false
  }
}
```

**Example:**
```bash
# Get all lessons
curl http://localhost:3000/api/lessons

# Get lessons with user progress
curl http://localhost:3000/api/lessons?userId=cmlrwcepo00005isbuxh5szih

# Paginated request
curl http://localhost:3000/api/lessons?page=2&limit=5
```

---

#### `GET /api/lessons/:identifier`
Retrieve a single lesson by ID or slug.

**Path Parameters:**
- `identifier` - Lesson ID (CUID) or slug (string)

**Query Parameters:**
- `userId` (optional): Include user's progress for this lesson

**Response:** `200 OK`
```json
{
  "data": {
    "id": "cmlrtkpu400016zsbfm1c2vy1",
    "title": "Introduction to Offline Web Apps",
    "slug": "intro-to-offline-apps",
    "content": "In this lesson, you will learn...",
    "order": 1,
    "updatedAt": "2026-02-18T10:35:19.412Z",
    "userProgress": {
      "id": "cmlrwceq800015isbbfcp801b",
      "completed": false,
      "score": null,
      "updatedAt": "2026-02-18T10:35:52.592Z"
    }
  }
}
```

**Errors:**
- `404` - Lesson not found

**Examples:**
```bash
# By ID
curl http://localhost:3000/api/lessons/cmlrtkpu400016zsbfm1c2vy1

# By slug
curl http://localhost:3000/api/lessons/intro-to-offline-apps

# With user progress
curl http://localhost:3000/api/lessons/intro-to-offline-apps?userId=xyz123
```

---

### Progress

#### `GET /api/progress`
Retrieve progress records with filtering.

**Query Parameters:**
- `userId` (required unless lessonId): Filter by user ID
- `lessonId` (required unless userId): Filter by lesson ID
- `completed` (optional): Filter by completion status (`true`/`false`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "cmlrwceq800015isbbfcp801b",
      "completed": false,
      "score": null,
      "updatedAt": "2026-02-18T10:35:52.592Z",
      "lesson": {
        "id": "cmlrtkpu400016zsbfm1c2vy1",
        "title": "Introduction to Offline Web Apps",
        "slug": "intro-to-offline-apps",
        "order": 1
      },
      "user": {
        "id": "cmlrwcepo00005isbuxh5szih",
        "name": "Alice Johnson",
        "email": "alice@orbit.edu"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1,
    "hasMore": false
  }
}
```

**Errors:**
- `400` - Missing required userId or lessonId parameter

**Examples:**
```bash
# Get all progress for a user
curl http://localhost:3000/api/progress?userId=cmlrwcepo00005isbuxh5szih

# Get completed lessons only
curl http://localhost:3000/api/progress?userId=xyz123&completed=true

# Get all progress for a specific lesson
curl http://localhost:3000/api/progress?lessonId=cmlrtkpu400016zsbfm1c2vy1
```

---

#### `POST /api/progress`
Create a new progress record.

**Request Body:**
```json
{
  "userId": "cmlrwcepo00005isbuxh5szih",
  "lessonId": "cmlrtkpu400016zsbfm1c2vy1",
  "completed": false,
  "score": null
}
```

**Response:** `201 Created`
```json
{
  "message": "Progress record created successfully",
  "data": {
    "id": "cmlrwceq800015isbbfcp801b",
    "completed": false,
    "score": null,
    "updatedAt": "2026-02-18T10:35:52.592Z",
    "lesson": {...},
    "user": {...}
  }
}
```

**Errors:**
- `400` - Missing required fields or invalid score (must be 0-100)
- `409` - Progress record already exists for this user-lesson pair

**Example:**
```bash
curl -X POST http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d '{"userId":"xyz","lessonId":"abc","completed":false,"score":null}'
```

---

#### `GET /api/progress/:progressId`
Retrieve a single progress record by ID.

**Path Parameters:**
- `progressId` - Progress record ID (CUID)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "cmlrwceq800015isbbfcp801b",
    "completed": true,
    "score": 85,
    "updatedAt": "2026-02-18T12:30:00.000Z",
    "lesson": {...},
    "user": {...}
  }
}
```

**Errors:**
- `404` - Progress record not found

---

#### `PATCH /api/progress/:progressId`
Update a progress record (partial update).

**Path Parameters:**
- `progressId` - Progress record ID (CUID)

**Request Body:** (at least one field required)
```json
{
  "completed": true,
  "score": 85
}
```

**Response:** `200 OK`
```json
{
  "message": "Progress record updated successfully",
  "data": {
    "id": "cmlrwceq800015isbbfcp801b",
    "completed": true,
    "score": 85,
    "updatedAt": "2026-02-18T12:30:00.000Z",
    "lesson": {...},
    "user": {...}
  }
}
```

**Errors:**
- `400` - No fields provided or invalid score
- `404` - Progress record not found

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/progress/cmlrwceq800015isbbfcp801b \
  -H "Content-Type: application/json" \
  -d '{"completed":true,"score":85}'
```

---

#### `DELETE /api/progress/:progressId`
Delete a progress record.

**Path Parameters:**
- `progressId` - Progress record ID (CUID)

**Response:** `204 No Content`

**Errors:**
- `404` - Progress record not found

---

## Special Endpoints

### `POST /api/users/enroll`
Atomic enrollment transaction that creates a user and initializes progress for all lessons.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@orbit.edu",
  "password": "securepass123"
}
```

**Response:** `201 Created`
```json
{
  "message": "Student enrolled successfully",
  "data": {
    "user": {
      "id": "cmlrwcepo00005isbuxh5szih",
      "name": "John Doe",
      "email": "john@orbit.edu",
      "createdAt": "2026-02-18T10:35:52.571Z"
    },
    "progressInitialized": 10
  }
}
```

**Errors:**
- `400` - Missing required fields or invalid email
- `409` - Email already exists

---

### `GET /api/users/:userId/dashboard`
Optimized dashboard query for student progress overview.

**Path Parameters:**
- `userId` - User ID (CUID)

**Response:** `200 OK`
```json
{
  "user": {...},
  "stats": {
    "totalLessons": 10,
    "completedLessons": 5,
    "incompleteLessons": 5,
    "completionRate": 50,
    "averageScore": 82,
    "totalScores": 5
  },
  "progress": [...]
}
```

**Errors:**
- `404` - User not found

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

**Example Error:**
```json
{
  "error": "Bad Request",
  "message": "userId and lessonId are required"
}
```

---

## Rate Limiting

*To be implemented in production:*
- Rate limits will be applied per IP address
- Recommended: 100 requests per minute for authenticated users
- 429 Too Many Requests status code will be returned when exceeded

---

## Authentication

*To be implemented in Auth module:*
- Bearer token authentication via `Authorization` header
- JWT-based session management
- Protected endpoints will require valid authentication

---

## Best Practices

### 1. Pagination for Lists
Always use pagination when fetching lists to minimize data transfer:
```bash
curl "http://localhost:3000/api/lessons?page=1&limit=5"
```

### 2. Field Selection
Use query parameters to request only needed data:
```bash
curl "http://localhost:3000/api/users/xyz?includeProgress=false"
```

### 3. Error Handling
Always check status codes and handle errors appropriately:
```javascript
const response = await fetch('/api/lessons');
if (!response.ok) {
  const error = await response.json();
  console.error(error.message);
}
```

### 4. Caching
Leverage HTTP caching headers (to be implemented):
- `ETag` for conditional requests
- `Cache-Control` for client-side caching

---

## Testing the API

Use the provided test scripts:

```bash
# Test all endpoints
npm run test:api

# Benchmark performance
npm run benchmark
```

Or use curl for manual testing:

```bash
# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@orbit.edu","password":"test123"}'

# Get lessons
curl http://localhost:3000/api/lessons?page=1&limit=5

# Update progress
curl -X PATCH http://localhost:3000/api/progress/xyz \
  -H "Content-Type: application/json" \
  -d '{"completed":true,"score":90}'
```

---

## Changelog

### Version 1.0.0 (2026-02-18)
- Initial API release
- RESTful endpoints for Users, Lessons, Progress
- Pagination support for all list endpoints
- Comprehensive error handling with standard status codes
- Optimized queries with Prisma indexes

---

*For support or questions, contact: aryan@orbit.edu*
