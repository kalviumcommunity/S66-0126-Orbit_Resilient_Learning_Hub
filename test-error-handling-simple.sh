#!/bin/bash

################################################################################
# Simplified Error Handling Test Suite (No jq dependency)
################################################################################

BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

echo -e "${YELLOW}=== Module 2.22: Error Handling & Logging Test Suite ===${NC}\n"

# Test 1: Validation error (400)
echo -e "${YELLOW}Test 1: Validation error - invalid email...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "short",
    "name": "Test"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ] && echo "$BODY" | grep -q '"error"'; then
  echo -e "${GREEN}✓ PASSED${NC} - Validation error returned 400\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 400 with error field\n"
  FAILED=$((FAILED + 1))
fi

# Test 2: Authentication error (401)
echo -e "${YELLOW}Test 2: Authentication error - invalid token...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/lessons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token_here" \
  -d '{
    "title": "Test",
    "content": "Test",
    "subject": "Math",
    "gradeLevel": 5
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ PASSED${NC} - Invalid token returned 401\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 401, got ${HTTP_CODE}\n"
  FAILED=$((FAILED + 1))
fi

# Test 3: Authorization error (403)
echo -e "${YELLOW}Test 3: Creating student user for auth test...${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_student_'$(date +%s)'@orbit.com",
    "password": "Test123!@#",
    "name": "Test Student"
  }')

TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo -e "${YELLOW}Test 3: Authorization error - student creating lesson...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/lessons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "Test Lesson",
    "content": "Test content",
    "subject": "Math",
    "gradeLevel": 5
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ PASSED${NC} - Insufficient permissions returned 403\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 403, got ${HTTP_CODE}\n"
  FAILED=$((FAILED + 1))
fi

# Test 4: Not found error (404)
echo -e "${YELLOW}Test 4: Not found error - invalid lesson ID...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/lessons/nonexistent-id-12345")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ PASSED${NC} - Invalid resource returned 404\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 404, got ${HTTP_CODE}\n"
  FAILED=$((FAILED + 1))
fi

# Test 5: Request ID in response body
echo -e "${YELLOW}Test 5: Request ID tracking in response...${NC}"
RESPONSE=$(curl -s "${API_URL}/lessons")

if echo "$RESPONSE" | grep -q '"requestId"'; then
  echo -e "${GREEN}✓ PASSED${NC} - requestId present in response\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - requestId missing from response\n"
  FAILED=$((FAILED + 1))
fi

# Test 6: Sensitive data redaction in errors
echo -e "${YELLOW}Test 6: Password not exposed in validation errors...${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@orbit.com",
    "password": "MySecretPassword123!",
    "name": ""
  }')

if ! echo "$RESPONSE" | grep -q "MySecretPassword123"; then
  echo -e "${GREEN}✓ PASSED${NC} - Password not leaked in error response\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Password leaked in error response\n"
  FAILED=$((FAILED + 1))
fi

# Summary
TOTAL=$((PASSED + FAILED))
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "Total: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}\n"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
