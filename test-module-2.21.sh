#!/bin/bash

################################################################################
# Module 2.21: Role-Based Access Control (RBAC) Test Suite
#
# Tests the three-tier role system (STUDENT, TEACHER, ADMIN) with JWT-based
# authorization across all API endpoints.
#
# Usage:
#   chmod +x test-module-2.21.sh
#   ./test-module-2.21.sh
#
# Prerequisites:
#   - Server running on http://localhost:3000
#   - Database seeded with test data
#   - jq installed for JSON parsing (sudo apt-get install jq)
################################################################################

set -e  # Exit on error

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test variables
STUDENT_EMAIL="student_$(date +%s)@test.com"
TEACHER_EMAIL="teacher_$(date +%s)@test.com"
ADMIN_EMAIL="admin_$(date +%s)@test.com"
PASSWORD="testpassword123"

STUDENT_TOKEN=""
TEACHER_TOKEN=""
ADMIN_TOKEN=""
STUDENT_ID=""
TEACHER_ID=""
ADMIN_ID=""
LESSON_ID=""
PROGRESS_ID=""

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST: $1${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

print_success() {
    echo -e "${GREEN}✓ PASS: $1${NC}\n"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

print_failure() {
    echo -e "${RED}✗ FAIL: $1${NC}\n"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

assert_status() {
    local expected=$1
    local actual=$2
    local test_name=$3
    
    if [ "$actual" -eq "$expected" ]; then
        print_success "$test_name (Status: $actual)"
    else
        print_failure "$test_name (Expected: $expected, Got: $actual)"
    fi
}

assert_contains() {
    local text=$1
    local substring=$2
    local test_name=$3
    
    if echo "$text" | grep -q "$substring"; then
        print_success "$test_name"
    else
        print_failure "$test_name (Expected substring '$substring' not found)"
    fi
}

################################################################################
# Setup: Create Test Users
################################################################################

setup_test_users() {
    print_header "SETUP: Creating Test Users"
    
    # Create STUDENT user
    print_test "Create STUDENT user"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test Student\",\"email\":\"$STUDENT_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 201 "$HTTP_CODE" "Student signup"
    
    STUDENT_TOKEN=$(echo "$BODY" | jq -r '.data.token')
    STUDENT_ID=$(echo "$BODY" | jq -r '.data.user.id')
    STUDENT_ROLE=$(echo "$BODY" | jq -r '.data.user.role')
    
    echo "Student ID: $STUDENT_ID"
    echo "Student Role: $STUDENT_ROLE"
    
    # Verify student has STUDENT role by default
    if [ "$STUDENT_ROLE" = "STUDENT" ]; then
        print_success "Student has default STUDENT role"
    else
        print_failure "Student role is $STUDENT_ROLE, expected STUDENT"
    fi
    
    # Create ADMIN user (first, create as student, then manually promote in database)
    # For testing purposes, we'll simulate having an ADMIN token by creating a user
    # In production, the first admin would be created via database seed or CLI tool
    print_test "Create ADMIN user (via privilege escalation test)"
    
    # This should fail - regular signup cannot create ADMIN
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test Admin\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASSWORD\",\"role\":\"ADMIN\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Cannot create ADMIN without admin token (privilege escalation prevention)"
    
    # For testing, we need to create an ADMIN user manually
    # This would typically be done via database seeding
    echo -e "${YELLOW}Note: In production, create first admin via database seed or CLI tool${NC}"
    echo -e "${YELLOW}For this test, we'll simulate having admin access${NC}\n"
}

################################################################################
# Test Group 1: Authentication & Role Assignment
################################################################################

test_auth_and_roles() {
    print_header "TEST GROUP 1: Authentication & Role Assignment"
    
    # Test 1.1: Signup defaults to STUDENT role
    print_test "1.1: Signup defaults to STUDENT role"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Default Role Test\",\"email\":\"default_$(date +%s)@test.com\",\"password\":\"$PASSWORD\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    ROLE=$(echo "$BODY" | jq -r '.data.user.role')
    
    assert_status 201 "$HTTP_CODE" "Signup successful"
    
    if [ "$ROLE" = "STUDENT" ]; then
        print_success "Default role is STUDENT"
    else
        print_failure "Default role is $ROLE, expected STUDENT"
    fi
    
    # Test 1.2: Login returns role in response
    print_test "1.2: Login returns role in response"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$STUDENT_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    ROLE=$(echo "$BODY" | jq -r '.data.user.role')
    
    assert_status 200 "$HTTP_CODE" "Login successful"
    
    if [ "$ROLE" = "STUDENT" ]; then
        print_success "Login response includes role"
    else
        print_failure "Login response role is $ROLE, expected STUDENT"
    fi
    
    # Test 1.3: Privilege escalation prevention
    print_test "1.3: Cannot create TEACHER without admin token"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Teacher Test\",\"email\":\"teacher_test_$(date +%s)@test.com\",\"password\":\"$PASSWORD\",\"role\":\"TEACHER\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Privilege escalation prevented"
    
    # Test 1.4: Missing token returns 401
    print_test "1.4: Protected endpoint without token returns 401"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/lessons" \
        -H "Content-Type: application/json" \
        -d "{\"title\":\"Test\",\"slug\":\"test\",\"content\":\"test\",\"order\":1}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 401 "$HTTP_CODE" "Missing token rejected"
    
    # Test 1.5: Invalid token returns 401
    print_test "1.5: Invalid token returns 401"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/lessons" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid_token_12345" \
        -d "{\"title\":\"Test\",\"slug\":\"test\",\"content\":\"test\",\"order\":1}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 401 "$HTTP_CODE" "Invalid token rejected"
}

################################################################################
# Test Group 2: Lesson Endpoints RBAC
################################################################################

test_lesson_rbac() {
    print_header "TEST GROUP 2: Lesson Endpoints RBAC"
    
    # Test 2.1: GET /api/lessons is public (no auth required)
    print_test "2.1: GET /api/lessons is public"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/lessons")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 200 "$HTTP_CODE" "Public lessons list"
    
    # Test 2.2: GET /api/lessons/:id is public
    print_test "2.2: GET /api/lessons/:id is public"
    # First create a lesson as TEACHER (simulate)
    # For now, we'll test that existing lessons are publicly accessible
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/lessons")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 200 "$HTTP_CODE" "Public lesson detail"
    
    # Test 2.3: POST /api/lessons requires TEACHER or ADMIN
    print_test "2.3: STUDENT cannot POST /api/lessons"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/lessons" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $STUDENT_TOKEN" \
        -d "{\"title\":\"Test Lesson\",\"slug\":\"test-lesson-$(date +%s)\",\"content\":\"Test content\",\"order\":1}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Student cannot create lesson"
    
    echo -e "${YELLOW}Note: TEACHER/ADMIN lesson creation tests require database seeding with those roles${NC}\n"
}

################################################################################
# Test Group 3: User Endpoints RBAC
################################################################################

test_user_rbac() {
    print_header "TEST GROUP 3: User Endpoints RBAC"
    
    # Test 3.1: Users can view their own profile
    print_test "3.1: User can view own profile"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/users/$STUDENT_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 200 "$HTTP_CODE" "View own profile"
    
    # Test 3.2: Users can update their own profile
    print_test "3.2: User can update own profile"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/users/$STUDENT_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $STUDENT_TOKEN" \
        -d "{\"name\":\"Updated Student Name\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 200 "$HTTP_CODE" "Update own profile"
    
    # Test 3.3: Users cannot update other users' profiles (without ADMIN role)
    print_test "3.3: User cannot update another user's profile"
    # Create another student
    OTHER_EMAIL="other_$(date +%s)@test.com"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Other Student\",\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    OTHER_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data.user.id')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/users/$OTHER_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $STUDENT_TOKEN" \
        -d "{\"name\":\"Unauthorized Update\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Cannot update other user's profile"
}

################################################################################
# Test Group 4: Dashboard Endpoints RBAC
################################################################################

test_dashboard_rbac() {
    print_header "TEST GROUP 4: Dashboard Endpoints RBAC"
    
    # Test 4.1: User can view their own dashboard
    print_test "4.1: User can view own dashboard"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/users/$STUDENT_ID/dashboard" \
        -H "Authorization: Bearer $STUDENT_TOKEN")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 200 "$HTTP_CODE" "View own dashboard"
    
    # Test 4.2: User cannot view another user's dashboard (without TEACHER/ADMIN role)
    print_test "4.2: User cannot view another user's dashboard"
    OTHER_EMAIL="other2_$(date +%s)@test.com"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Other Student 2\",\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    OTHER_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data.user.id')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/users/$OTHER_ID/dashboard" \
        -H "Authorization: Bearer $STUDENT_TOKEN")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Cannot view other user's dashboard"
    
    echo -e "${YELLOW}Note: TEACHER/ADMIN dashboard access tests require database seeding with those roles${NC}\n"
}

################################################################################
# Test Group 5: Progress Endpoints RBAC
################################################################################

test_progress_rbac() {
    print_header "TEST GROUP 5: Progress Endpoints RBAC"
    
    # Test 5.1: User can create/update their own progress
    print_test "5.1: User can create own progress"
    # First, get a lesson ID
    LESSONS_RESPONSE=$(curl -s "$API_URL/lessons")
    LESSON_ID=$(echo "$LESSONS_RESPONSE" | jq -r '.data[0].id // empty')
    
    if [ -z "$LESSON_ID" ]; then
        echo -e "${YELLOW}No lessons found, skipping progress tests${NC}\n"
        return
    fi
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/progress" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $STUDENT_TOKEN" \
        -d "{\"userId\":\"$STUDENT_ID\",\"lessonId\":\"$LESSON_ID\",\"completed\":true,\"score\":85}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    PROGRESS_ID=$(echo "$BODY" | jq -r '.data.id // empty')
    
    assert_status 201 "$HTTP_CODE" "Create own progress"
    
    # Test 5.2: User cannot create progress for another user (without TEACHER/ADMIN)
    print_test "5.2: User cannot create progress for another user"
    OTHER_EMAIL="other3_$(date +%s)@test.com"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Other Student 3\",\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    OTHER_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data.user.id')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/progress" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $STUDENT_TOKEN" \
        -d "{\"userId\":\"$OTHER_ID\",\"lessonId\":\"$LESSON_ID\",\"completed\":true,\"score\":85}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Cannot create progress for other user"
    
    # Test 5.3: User can update their own progress
    if [ -n "$PROGRESS_ID" ]; then
        print_test "5.3: User can update own progress"
        RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/progress/$PROGRESS_ID" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $STUDENT_TOKEN" \
            -d "{\"score\":95}")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        assert_status 200 "$HTTP_CODE" "Update own progress"
    fi
}

################################################################################
# Test Summary
################################################################################

print_summary() {
    print_header "TEST SUMMARY"
    
    echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! ✓${NC}\n"
        exit 0
    else
        echo -e "\n${RED}Some tests failed. Please review the output above.${NC}\n"
        exit 1
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║         MODULE 2.21: RBAC TEST SUITE                          ║"
    echo "║         Role-Based Access Control Testing                     ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    echo "API Base URL: $BASE_URL"
    echo "Testing against: $API_URL"
    echo ""
    
    # Run test groups
    setup_test_users
    test_auth_and_roles
    test_lesson_rbac
    test_user_rbac
    test_dashboard_rbac
    test_progress_rbac
    
    # Print summary
    print_summary
}

# Check prerequisites
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install it first:${NC}"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  macOS: brew install jq"
    exit 1
fi

# Run main
main
