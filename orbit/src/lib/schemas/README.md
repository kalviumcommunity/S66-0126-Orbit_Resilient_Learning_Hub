# Orbit API Validation Schemas

This directory contains Zod validation schemas for all Orbit API endpoints. These schemas provide type-safe input validation with detailed error messages.

## Schema Files

- **user.schema.ts** - User creation and update validation
- **progress.schema.ts** - Progress tracking validation with strict CUID format
- **lesson.schema.ts** - Lesson management validation (prepared for future use)
- **index.ts** - Centralized exports for all schemas

## Usage

### Server-Side (API Routes)

```typescript
import { createUserSchema, apiValidationError } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate with Zod
  const validationResult = createUserSchema.safeParse(body);
  if (!validationResult.success) {
    return apiValidationError(validationResult.error, requestId);
  }
  
  // Use validated data
  const { name, email, password } = validationResult.data;
  // ...
}
```

### Client-Side (Future Use)

```typescript
import { createUserSchema, type CreateUserInput } from "@/lib/schemas";

const formData: CreateUserInput = { name, email, password };
const result = createUserSchema.safeParse(formData);

if (!result.success) {
  // Show validation errors to user
  console.error(result.error.issues);
} else {
  // Submit to API
  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(result.data)
  });
}
```

## Validation Rules

### User Schemas

**createUserSchema**
- `name`: string, 1-100 chars, trimmed
- `email`: valid email format, lowercase, trimmed
- `password`: string, min 8 chars (will be hashed)

**updateUserSchema**
- `name?`: string, 1-100 chars, trimmed
- `email?`: valid email format, lowercase, trimmed
- `password?`: string, min 8 chars (will be hashed)
- At least one field required

### Progress Schemas

**createProgressSchema**
- `userId`: CUID format (`^c[a-z0-9]{24}$`)
- `lessonId`: CUID format (`^c[a-z0-9]{24}$`)
- `completed`: boolean
- `score?`: integer 0-100 or null

**updateProgressSchema**
- `completed?`: boolean
- `score?`: integer 0-100 or null
- At least one field required

### Lesson Schemas (Future Use)

**createLessonSchema**
- `title`: string, 1-200 chars, trimmed
- `slug`: URL-safe string (lowercase, numbers, hyphens)
- `order`: positive integer
- `content?`: string or null

**updateLessonSchema**
- All fields optional
- At least one field required

## Error Response Format

When validation fails, the API returns a `400 Bad Request` with grouped error details:

```json
{
  "success": false,
  "timestamp": "2026-02-19T09:14:49.902Z",
  "requestId": "8fa53d7a-3e0f-421c-a0cf-69aacd057f14",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "name": "Invalid input: expected string, received undefined",
        "email": "Invalid email format",
        "score": "Score must not exceed 100"
      }
    }
  }
}
```

## TypeScript Types

All schemas export inferred TypeScript types:

```typescript
import type {
  CreateUserInput,
  UpdateUserInput,
  CreateProgressInput,
  UpdateProgressInput,
  CreateLessonInput,
  UpdateLessonInput
} from "@/lib/schemas";
```

## CUID Validation

Progress schemas use strict CUID validation to catch malformed IDs early:

```typescript
// Valid CUID: starts with 'c' + 24 alphanumeric chars
const validCuid = "c12345678901234567890123";

// Invalid examples:
"invalid-id"           // Fails: wrong format
"12345678901234567890123"  // Fails: missing 'c' prefix
"c12345"               // Fails: too short
```

## Benefits

1. **Type Safety** - Zod infers TypeScript types from schemas
2. **Runtime Validation** - Catches invalid data before database operations
3. **Consistent Errors** - All validation errors follow the same format
4. **Client Reuse** - Same schemas can validate on client and server
5. **Documentation** - Schemas serve as API documentation

## Adding New Schemas

1. Create new schema file (e.g., `comment.schema.ts`)
2. Define create and update schemas
3. Export types
4. Add exports to `index.ts`
5. Use in API routes with `safeParse()`

Example:

```typescript
import { z } from "zod";

export const createCommentSchema = z.object({
  text: z.string().min(1).max(500),
  userId: z.string().regex(/^c[a-z0-9]{24}$/),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
```
