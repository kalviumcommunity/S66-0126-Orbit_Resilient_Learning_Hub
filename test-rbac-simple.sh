#!/bin/bash

################################################################################
# Simplified RBAC Test Suite (No jq dependency)
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

echo -e "${YELLOW}=== Module 2.21: RBAC Test Suite ===${NC}\n"

# Test 1: Create STUDENT user
echo -e "${YELLOW}Test 1: Creating STUDENT user...${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student_test@orbit.com",
    "password": "Test123!@#",
    "name": "Test Student"
  }')

if echo "$RESPONSE" | grep -q '"role":"STUDENT"'; then
  echo -e "${GREEN}✓ PASSED${NC} - Student created with correct role\n"
  PASSED=$((PASSED + 1))
  STUDENT_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
  echo -e "${RED}✗ FAILED${NC} - Student creation failed\n"
  FAILED=$((FAILED + 1))
fi

# Test 2: Create TEACHER user (should fail - privilege escalation)
echo -e "${YELLOW}Test 2: Attempting to create TEACHER user without auth...${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher_test@orbit.com",
    "password": "Test123!@#",
    "name": "Test Teacher",
    "role": "TEACHER"
  }')

if echo "$RESPONSE" | grep -q '"error"'; then
  echo -e "${GREEN}✓ PASSED${NC} - Privilege escalation prevented\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Should have blocked TEACHER creation\n"
  FAILED=$((FAILED + 1))
fi

# Test 3: Student tries to create lesson (should fail)
echo -e "${YELLOW}Test 3: Student attempting to create lesson...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/lessons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STUDENT_TOKEN}" \
  -d '{
    "title": "Test Lesson",
    "content": "Test content",
    "subject": "Math",
    "gradeLevel": 5
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ PASSED${NC} - Student correctly forbidden from creating lessons\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 403, got ${HTTP_CODE}\n"
  FAILED=$((FAILED + 1))
fi

# Test 4: Login and verify role in response
echo -e "${YELLOW}Test 4: Login and verify role in response...${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student_test@orbit.com",
    "password": "Test123!@#"
  }')

if echo "$RESPONSE" | grep -q '"role":"STUDENT"'; then
  echo -e "${GREEN}✓ PASSED${NC} - Role included in login response\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Role not in login response\n"
  FAILED=$((FAILED + 1))
fi

# Test 5: Access public endpoint (GET /api/lessons)
echo -e "${YELLOW}Test 5: Access public lessons endpoint...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/lessons")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ PASSED${NC} - Public endpoint accessible\n"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected 200, got ${HTTP_CODE}\n"
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
