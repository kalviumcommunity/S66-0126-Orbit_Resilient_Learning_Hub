# Orbit API Testing Guide

## Overview

This document provides comprehensive testing procedures for the Orbit REST API. All endpoints follow RESTful conventions with predictable URLs, HTTP verbs, and standard status codes.

---

## Testing Setup

### Prerequisites
1. PostgreSQL database running (Docker or local)
2. Next.js development server: `npm run dev`
3. Database seeded: `npm run seed`

### Testing Tools
- **curl**: Command-line HTTP client
- **Postman**: GUI-based API testing tool
- **HTTPie**: User-friendly curl alternative

---

## Test Scenarios

### 1. Lessons API

#### Test 1.1: Get All Lessons (No Pagination)
```bash
curl -X GET "http://localhost:3000/api/lessons" | json_pp
```

**Expected Response:** `200 OK`
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### Test 1.2: Get Lessons with Pagination
```bash
curl -X GET "http://localhost:3000/api/lessons?page=1&limit=2" | json_pp
```

**Expected Response:** `200 OK`
- Should return exactly 2 lessons
- `pagination.hasMore` should be `true` if total > 2
- `pagination.totalPages` should be calculated correctly

---

#### Test 1.3: Get Lessons with User Progress
```bash
# First, get a valid userId from enrollment
USER_ID="cmlrwcepo00005isbuxh5szih"  # Replace with actual user ID

curl -X GET "http://localhost:3000/api/lessons?userId=$USER_ID" | json_pp
```

**Expected Response:** `200 OK`
- Each lesson should have `userProgress` field
- `userProgress` contains `completed`, `score`, `updatedAt`

---

#### Test 1.4: Get Single Lesson by ID
```bash
LESSON_ID="cmlrtkpu400016zsbfm1c2vy1"  # Replace with actual lesson ID

curl -X GET "http://localhost:3000/api/lessons/$LESSON_ID" | json_pp
```

**Expected Response:** `200 OK`
```json
{
  "data": {
    "id": "cmlrtkpu400016zsbfm1c2vy1",
    "title": "Introduction to Offline Web Apps",
    "slug": "intro-to-offline-apps",
    "content": "Full lesson content...",
    "order": 1,
    "updatedAt": "2026-02-18T10:35:19.412Z"
  }
}
```

---

#### Test 1.5: Get Single Lesson by Slug
```bash
curl -X GET "http://localhost:3000/api/lessons/intro-to-offline-apps" | json_pp
```

**Expected Response:** `200 OK`
- Same as Test 1.4 but accessed via slug

---

#### Test 1.6: Get Lesson with User Progress
```bash
curl -X GET "http://localhost:3000/api/lessons/intro-to-offline-apps?userId=$USER_ID" | json_pp
```

**Expected Response:** `200 OK`
- Lesson data includes `userProgress` field

---

#### Test 1.7: Get Non-Existent Lesson
```bash
curl -X GET "http://localhost:3000/api/lessons/non-existent-slug" | json_pp
```

**Expected Response:** `404 Not Found`
```json
{
  "error": "Lesson not found",
  "message": "No lesson found with slug: non-existent-slug"
}
```

---

### 2. Users API

#### Test 2.1: Get All Users
```bash
curl -X GET "http://localhost:3000/api/users" | json_pp
```

**Expected Response:** `200 OK`
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
  "pagination": {...}
}
```

**Validation:**
- Password field should NOT be present (security)
- `_count.progress` shows number of progress records

---

#### Test 2.2: Create New User
```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "email": "test.student@orbit.edu",
    "password": "testpass123"
  }' | json_pp
```

**Expected Response:** `201 Created`
```json
{
  "message": "User created successfully",
  "data": {
    "id": "cmlrxyz...",
    "name": "Test Student",
    "email": "test.student@orbit.edu",
    "createdAt": "2026-02-18T..."
  }
}
```

**Validation:**
- Password should NOT be in response
- `createdAt` timestamp should be present
- Save the returned `id` for subsequent tests

---

#### Test 2.3: Create User with Duplicate Email
```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Test",
    "email": "test.student@orbit.edu",
    "password": "pass123"
  }' | json_pp
```

**Expected Response:** `409 Conflict`
```json
{
  "error": "Conflict",
  "message": "Email already exists"
}
```

---

#### Test 2.4: Create User with Invalid Email
```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Email",
    "email": "not-an-email",
    "password": "pass123"
  }' | json_pp
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": "Bad Request",
  "message": "Invalid email format"
}
```

---

#### Test 2.5: Get User by ID
```bash
USER_ID="cmlrwcepo00005isbuxh5szih"  # Replace with actual user ID

curl -X GET "http://localhost:3000/api/users/$USER_ID" | json_pp
```

**Expected Response:** `200 OK`
- User data without password field
- `_count.progress` shows total progress records

---

#### Test 2.6: Get User with Progress
```bash
curl -X GET "http://localhost:3000/api/users/$USER_ID?includeProgress=true" | json_pp
```

**Expected Response:** `200 OK`
- User data includes full `progress` array
- Each progress entry includes related lesson data

---

#### Test 2.7: Update User
```bash
curl -X PATCH "http://localhost:3000/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name"
  }' | json_pp
```

**Expected Response:** `200 OK`
```json
{
  "message": "User updated successfully",
  "data": {
    "id": "...",
    "name": "Updated Name",
    "email": "...",
    "createdAt": "..."
  }
}
```

---

#### Test 2.8: Update User with Duplicate Email
```bash
curl -X PATCH "http://localhost:3000/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@orbit.edu"
  }' | json_pp
```

**Expected Response:** `409 Conflict`
- Assuming `alice@orbit.edu` already exists

---

#### Test 2.9: Delete User
```bash
curl -X DELETE "http://localhost:3000/api/users/$USER_ID"
```

**Expected Response:** `204 No Content`
- No response body
- User and all progress records deleted (CASCADE)

---

### 3. Progress API

#### Test 3.1: Get Progress by User
```bash
USER_ID="cmlrwcepo00005isbuxh5szih"

curl -X GET "http://localhost:3000/api/progress?userId=$USER_ID" | json_pp
```

**Expected Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "...",
      "completed": false,
      "score": null,
      "updatedAt": "...",
      "lesson": {
        "id": "...",
        "title": "...",
        "slug": "...",
        "order": 1
      },
      "user": {
        "id": "...",
        "name": "...",
        "email": "..."
      }
    }
  ],
  "pagination": {...}
}
```

---

#### Test 3.2: Get Progress by Lesson
```bash
LESSON_ID="cmlrtkpu400016zsbfm1c2vy1"

curl -X GET "http://localhost:3000/api/progress?lessonId=$LESSON_ID" | json_pp
```

**Expected Response:** `200 OK`
- All progress records for the specified lesson

---

#### Test 3.3: Get Completed Progress Only
```bash
curl -X GET "http://localhost:3000/api/progress?userId=$USER_ID&completed=true" | json_pp
```

**Expected Response:** `200 OK`
- Only progress records where `completed = true`

---

#### Test 3.4: Get Progress Without Required Parameters
```bash
curl -X GET "http://localhost:3000/api/progress" | json_pp
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": "Bad Request",
  "message": "Either userId or lessonId parameter is required"
}
```

---

#### Test 3.5: Create Progress Record
```bash
USER_ID="cmlrwcepo00005isbuxh5szih"
LESSON_ID="cmlrtkpu400016zsbfm1c2vy1"

curl -X POST "http://localhost:3000/api/progress" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "lessonId": "'$LESSON_ID'",
    "completed": false,
    "score": null
  }' | json_pp
```

**Expected Response:** `201 Created`
```json
{
  "message": "Progress record created successfully",
  "data": {
    "id": "...",
    "completed": false,
    "score": null,
    "updatedAt": "...",
    "lesson": {...},
    "user": {...}
  }
}
```

---

#### Test 3.6: Create Duplicate Progress Record
```bash
# Run Test 3.5 again with same userId and lessonId

curl -X POST "http://localhost:3000/api/progress" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "lessonId": "'$LESSON_ID'",
    "completed": false
  }' | json_pp
```

**Expected Response:** `409 Conflict`
```json
{
  "error": "Conflict",
  "message": "Progress record already exists for this user-lesson pair"
}
```

---

#### Test 3.7: Create Progress with Invalid Score
```bash
curl -X POST "http://localhost:3000/api/progress" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "lessonId": "'$LESSON_ID'",
    "score": 150
  }' | json_pp
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": "Bad Request",
  "message": "Score must be between 0 and 100"
}
```

---

#### Test 3.8: Get Progress by ID
```bash
PROGRESS_ID="cmlrwceq800015isbbfcp801b"

curl -X GET "http://localhost:3000/api/progress/$PROGRESS_ID" | json_pp
```

**Expected Response:** `200 OK`
- Single progress record with related lesson and user data

---

#### Test 3.9: Update Progress Record
```bash
curl -X PATCH "http://localhost:3000/api/progress/$PROGRESS_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true,
    "score": 85
  }' | json_pp
```

**Expected Response:** `200 OK`
```json
{
  "message": "Progress record updated successfully",
  "data": {
    "id": "...",
    "completed": true,
    "score": 85,
    "updatedAt": "...",
    "lesson": {...},
    "user": {...}
  }
}
```

---

#### Test 3.10: Update Progress with Invalid Score
```bash
curl -X PATCH "http://localhost:3000/api/progress/$PROGRESS_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "score": -10
  }' | json_pp
```

**Expected Response:** `400 Bad Request`

---

#### Test 3.11: Delete Progress Record
```bash
curl -X DELETE "http://localhost:3000/api/progress/$PROGRESS_ID"
```

**Expected Response:** `204 No Content`

---

### 4. Special Endpoints

#### Test 4.1: Enroll User (Transaction)
```bash
curl -X POST "http://localhost:3000/api/users/enroll" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Student",
    "email": "new.student@orbit.edu",
    "password": "securepass123"
  }' | json_pp
```

**Expected Response:** `201 Created`
```json
{
  "message": "Student enrolled successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "New Student",
      "email": "new.student@orbit.edu",
      "createdAt": "..."
    },
    "progressInitialized": 10
  }
}
```

**Validation:**
- User created
- Progress records created for ALL lessons (10 in seed data)
- Transaction should be atomic (all or nothing)

---

#### Test 4.2: Get User Dashboard
```bash
USER_ID="cmlrwcepo00005isbuxh5szih"

curl -X GET "http://localhost:3000/api/users/$USER_ID/dashboard" | json_pp
```

**Expected Response:** `200 OK`
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

---

## Performance Testing

### Pagination Performance
Test that pagination reduces payload size:

```bash
# Without pagination (all 10 lessons)
curl -s "http://localhost:3000/api/lessons" | wc -c

# With pagination (2 lessons only)
curl -s "http://localhost:3000/api/lessons?limit=2" | wc -c
```

**Expected:** Paginated response should be significantly smaller.

---

### Response Time Testing
Measure endpoint response times:

```bash
# Test lessons endpoint
time curl -s "http://localhost:3000/api/lessons" > /dev/null

# Test progress endpoint
time curl -s "http://localhost:3000/api/progress?userId=$USER_ID" > /dev/null
```

**Expected:** 
- Most endpoints < 50ms
- Dashboard endpoint < 100ms (optimized query)

---

## Test Checklist

### Lessons API
- [ ] GET /api/lessons (list with pagination)
- [ ] GET /api/lessons?userId=xyz (with user progress)
- [ ] GET /api/lessons/:id (by ID)
- [ ] GET /api/lessons/:slug (by slug)
- [ ] GET /api/lessons/:slug?userId=xyz (with user progress)
- [ ] 404 error for non-existent lesson

### Users API
- [ ] GET /api/users (list with pagination)
- [ ] POST /api/users (create user)
- [ ] POST /api/users (duplicate email - 409 error)
- [ ] POST /api/users (invalid email - 400 error)
- [ ] GET /api/users/:id (single user)
- [ ] GET /api/users/:id?includeProgress=true
- [ ] PATCH /api/users/:id (update user)
- [ ] DELETE /api/users/:id (cascade delete)
- [ ] Password field excluded from all responses

### Progress API
- [ ] GET /api/progress?userId=xyz (by user)
- [ ] GET /api/progress?lessonId=xyz (by lesson)
- [ ] GET /api/progress?userId=xyz&completed=true (filtered)
- [ ] GET /api/progress (missing params - 400 error)
- [ ] POST /api/progress (create)
- [ ] POST /api/progress (duplicate - 409 error)
- [ ] POST /api/progress (invalid score - 400 error)
- [ ] GET /api/progress/:id (single record)
- [ ] PATCH /api/progress/:id (update)
- [ ] DELETE /api/progress/:id

### Special Endpoints
- [ ] POST /api/users/enroll (atomic transaction)
- [ ] GET /api/users/:id/dashboard (optimized query)

### HTTP Semantics
- [ ] GET requests are idempotent
- [ ] POST returns 201 Created
- [ ] PATCH returns 200 OK
- [ ] DELETE returns 204 No Content
- [ ] 400 for bad requests
- [ ] 404 for not found
- [ ] 409 for conflicts
- [ ] 500 for server errors

---

## Automated Testing

Create a test script:

```bash
#!/bin/bash
# test-api.sh

BASE_URL="http://localhost:3000/api"

echo "Testing Orbit API..."

# Test 1: Get lessons
echo "Test 1: GET /lessons"
curl -s "$BASE_URL/lessons?limit=2" | json_pp

# Test 2: Create user
echo "Test 2: POST /users"
curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@orbit.edu","password":"pass123"}' | json_pp

# Add more tests...

echo "All tests completed!"
```

Run with:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Next Steps

1. Run all test scenarios manually
2. Document results in `api-evidence/` directory
3. Create automated test suite with Jest
4. Add integration tests with Prisma
5. Implement rate limiting
6. Add authentication middleware

---

*Last Updated: 2026-02-18*
