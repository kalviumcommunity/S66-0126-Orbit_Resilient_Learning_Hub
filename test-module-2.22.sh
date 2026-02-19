#!/bin/bash

################################################################################
# Module 2.22: Error Handling & Logging Test Suite
#
# Tests centralized error handling, logging with Pino, and production-safe
# error redaction across all API endpoints.
#
# Usage:
#   chmod +x test-module-2.22.sh
#   ./test-module-2.22.sh
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
TEST_EMAIL="errortest_$(date +%s)@test.com"
PASSWORD="testpassword123"
USER_TOKEN=""
USER_ID=""

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

assert_json_field() {
    local json=$1
    local field=$2
    local test_name=$3
    
    local value=$(echo "$json" | jq -r "$field")
    
    if [ "$value" != "null" ] && [ -n "$value" ]; then
        print_success "$test_name (Found: $field)"
    else
        print_failure "$test_name (Missing field: $field)"
    fi
}

assert_json_field_missing() {
    local json=$1
    local field=$2
    local test_name=$3
    
    local value=$(echo "$json" | jq -r "$field")
    
    if [ "$value" = "null" ] || [ -z "$value" ]; then
        print_success "$test_name (Field correctly absent: $field)"
    else
        print_failure "$test_name (Field should be absent: $field, but found: $value)"
    fi
}

################################################################################
# Setup: Create Test User
################################################################################

setup_test_user() {
    print_header "SETUP: Creating Test User"
    
    print_test "Create test user"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Error Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 201 "$HTTP_CODE" "Test user created"
    
    USER_TOKEN=$(echo "$BODY" | jq -r '.data.token')
    USER_ID=$(echo "$BODY" | jq -r '.data.user.id')
    
    echo "User ID: $USER_ID"
}

################################################################################
# Test Group 1: Error Response Structure
################################################################################

test_error_structure() {
    print_header "TEST GROUP 1: Error Response Structure"
    
    # Test 1.1: Error responses have standard structure
    print_test "1.1: Error response has success=false"
    RESPONSE=$(curl -s -X GET "$API_URL/users/invalid_user_id_12345")
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    
    if [ "$SUCCESS" = "false" ]; then
        print_success "Error response has success=false"
    else
        print_failure "Error response success field is $SUCCESS, expected false"
    fi
    
    # Test 1.2: Error responses include timestamp
    print_test "1.2: Error response includes timestamp"
    assert_json_field "$RESPONSE" ".timestamp" "Timestamp field present"
    
    # Test 1.3: Error responses include requestId
    print_test "1.3: Error response includes requestId"
    assert_json_field "$RESPONSE" ".requestId" "RequestId field present"
    
    # Test 1.4: Error responses include error object
    print_test "1.4: Error response includes error object"
    assert_json_field "$RESPONSE" ".error.code" "Error code present"
    assert_json_field "$RESPONSE" ".error.message" "Error message present"
}

################################################################################
# Test Group 2: Validation Errors (400)
################################################################################

test_validation_errors() {
    print_header "TEST GROUP 2: Validation Errors (400)"
    
    # Test 2.1: Missing required fields
    print_test "2.1: Signup without email returns 400"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test\",\"password\":\"testpass123\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 400 "$HTTP_CODE" "Missing email validation"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "VALIDATION_ERROR" ]; then
        print_success "Error code is VALIDATION_ERROR"
    else
        print_failure "Error code is $ERROR_CODE, expected VALIDATION_ERROR"
    fi
    
    # Test 2.2: Invalid email format
    print_test "2.2: Invalid email format returns 400"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test\",\"email\":\"not-an-email\",\"password\":\"testpass123\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 400 "$HTTP_CODE" "Invalid email validation"
    
    # Test 2.3: Password too short
    print_test "2.3: Short password returns 400"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test\",\"email\":\"test@example.com\",\"password\":\"short\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 400 "$HTTP_CODE" "Short password validation"
    
    # Test 2.4: Validation error includes field details
    print_test "2.4: Validation error includes field-level details"
    RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"\",\"email\":\"invalid\",\"password\":\"short\"}")
    
    BODY="$RESPONSE"
    assert_json_field "$BODY" ".error.details.fields" "Field details present"
}

################################################################################
# Test Group 3: Authentication Errors (401)
################################################################################

test_auth_errors() {
    print_header "TEST GROUP 3: Authentication Errors (401)"
    
    # Test 3.1: Missing token
    print_test "3.1: Protected endpoint without token returns 401"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/users/$USER_ID" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Updated Name\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 401 "$HTTP_CODE" "Missing token authentication"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "MISSING_TOKEN" ]; then
        print_success "Error code is MISSING_TOKEN"
    else
        print_failure "Error code is $ERROR_CODE, expected MISSING_TOKEN"
    fi
    
    # Test 3.2: Invalid token
    print_test "3.2: Invalid token returns 401"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/users/$USER_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid_token_123" \
        -d "{\"name\":\"Updated Name\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 401 "$HTTP_CODE" "Invalid token authentication"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "INVALID_TOKEN" ]; then
        print_success "Error code is INVALID_TOKEN"
    else
        print_failure "Error code is $ERROR_CODE, expected INVALID_TOKEN"
    fi
    
    # Test 3.3: Wrong credentials
    print_test "3.3: Wrong password returns 401"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpassword\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 401 "$HTTP_CODE" "Wrong password authentication"
}

################################################################################
# Test Group 4: Authorization Errors (403)
################################################################################

test_authorization_errors() {
    print_header "TEST GROUP 4: Authorization Errors (403)"
    
    # Test 4.1: Insufficient permissions
    print_test "4.1: Student cannot create lessons (403)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/lessons" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $USER_TOKEN" \
        -d "{\"title\":\"Test\",\"slug\":\"test-$(date +%s)\",\"content\":\"test\",\"order\":1}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 403 "$HTTP_CODE" "Insufficient permissions"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "FORBIDDEN" ]; then
        print_success "Error code is FORBIDDEN"
    else
        print_failure "Error code is $ERROR_CODE, expected FORBIDDEN"
    fi
    
    # Test 4.2: Cannot access other user's resources
    print_test "4.2: Cannot update other user's profile (403)"
    # Create another user
    OTHER_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Other User\",\"email\":\"other_$(date +%s)@test.com\",\"password\":\"$PASSWORD\"}")
    
    OTHER_ID=$(echo "$OTHER_RESPONSE" | jq -r '.data.user.id')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/users/$OTHER_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $USER_TOKEN" \
        -d "{\"name\":\"Unauthorized Update\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 403 "$HTTP_CODE" "Cannot access other user's resources"
}

################################################################################
# Test Group 5: Not Found Errors (404)
################################################################################

test_not_found_errors() {
    print_header "TEST GROUP 5: Not Found Errors (404)"
    
    # Test 5.1: Non-existent user
    print_test "5.1: Non-existent user returns 404"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/users/cmnonexistent12345")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 404 "$HTTP_CODE" "Non-existent user"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "NOT_FOUND" ]; then
        print_success "Error code is NOT_FOUND"
    else
        print_failure "Error code is $ERROR_CODE, expected NOT_FOUND"
    fi
    
    # Test 5.2: Non-existent lesson
    print_test "5.2: Non-existent lesson returns 404"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/lessons/nonexistent-lesson")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    assert_status 404 "$HTTP_CODE" "Non-existent lesson"
}

################################################################################
# Test Group 6: Conflict Errors (409)
################################################################################

test_conflict_errors() {
    print_header "TEST GROUP 6: Conflict Errors (409)"
    
    # Test 6.1: Duplicate email
    print_test "6.1: Duplicate email returns 409"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Duplicate Test\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    assert_status 409 "$HTTP_CODE" "Duplicate email conflict"
    
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "CONFLICT" ]; then
        print_success "Error code is CONFLICT"
    else
        print_failure "Error code is $ERROR_CODE, expected CONFLICT"
    fi
}

################################################################################
# Test Group 7: Sensitive Data Redaction
################################################################################

test_sensitive_redaction() {
    print_header "TEST GROUP 7: Sensitive Data Redaction"
    
    # Test 7.1: Password not returned in response
    print_test "7.1: Signup response doesn't include password"
    RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Redaction Test\",\"email\":\"redaction_$(date +%s)@test.com\",\"password\":\"$PASSWORD\"}")
    
    assert_json_field_missing "$RESPONSE" ".data.user.password" "Password not in signup response"
    
    # Test 7.2: Login response doesn't include password
    print_test "7.2: Login response doesn't include password"
    RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    assert_json_field_missing "$RESPONSE" ".data.user.password" "Password not in login response"
    
    # Test 7.3: User profile response doesn't include password
    print_test "7.3: User profile doesn't include password"
    RESPONSE=$(curl -s -X GET "$API_URL/users/$USER_ID")
    
    assert_json_field_missing "$RESPONSE" ".password" "Password not in user profile"
}

################################################################################
# Test Group 8: Request ID Tracing
################################################################################

test_request_tracing() {
    print_header "TEST GROUP 8: Request ID Tracing"
    
    # Test 8.1: Success responses include requestId
    print_test "8.1: Success response includes requestId"
    RESPONSE=$(curl -s -X GET "$API_URL/lessons")
    
    assert_json_field "$RESPONSE" ".requestId" "RequestId in success response"
    
    # Test 8.2: Error responses include requestId
    print_test "8.2: Error response includes requestId"
    RESPONSE=$(curl -s -X GET "$API_URL/users/nonexistent123")
    
    assert_json_field "$RESPONSE" ".requestId" "RequestId in error response"
    
    # Test 8.3: RequestId is UUID format
    print_test "8.3: RequestId is valid UUID"
    REQUEST_ID=$(echo "$RESPONSE" | jq -r '.requestId')
    
    # UUID v4 format regex
    if [[ "$REQUEST_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
        print_success "RequestId is valid UUID v4"
    else
        print_failure "RequestId '$REQUEST_ID' is not a valid UUID v4"
    fi
}

################################################################################
# Test Group 9: Response Headers
################################################################################

test_response_headers() {
    print_header "TEST GROUP 9: Response Headers"
    
    # Test 9.1: X-Request-Id header present
    print_test "9.1: Response includes X-Request-Id header"
    RESPONSE=$(curl -s -i -X GET "$API_URL/lessons" 2>&1)
    
    if echo "$RESPONSE" | grep -qi "x-request-id:"; then
        print_success "X-Request-Id header present"
    else
        print_failure "X-Request-Id header missing"
    fi
    
    # Test 9.2: Content-Type is application/json
    print_test "9.2: Response Content-Type is application/json"
    
    if echo "$RESPONSE" | grep -qi "content-type: application/json"; then
        print_success "Content-Type is application/json"
    else
        print_failure "Content-Type is not application/json"
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
    echo "║    MODULE 2.22: ERROR HANDLING & LOGGING TEST SUITE           ║"
    echo "║    Centralized Error Handling & Structured Logging            ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    echo "API Base URL: $BASE_URL"
    echo "Testing against: $API_URL"
    echo ""
    
    # Run test groups
    setup_test_user
    test_error_structure
    test_validation_errors
    test_auth_errors
    test_authorization_errors
    test_not_found_errors
    test_conflict_errors
    test_sensitive_redaction
    test_request_tracing
    test_response_headers
    
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
