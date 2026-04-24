#!/usr/bin/env bash
# ================================================================
# Operation PAWS — Security Stress Test Suite
# ================================================================
# This script systematically attacks the system to prove resilience.
# Run from the repo root: bash tests/security_stress_test.sh
# ================================================================

set -euo pipefail

BASE_URL="${PAWS_API_URL:-https://dorihyvbgbhsxvdrtqqr.supabase.co/functions/v1}"
ANON_KEY="${SUPABASE_ANON_KEY:-__INSERT_ANON_KEY__}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}[PASS]${NC} $label (HTTP $actual)"
    ((PASS++))
  else
    echo -e "${RED}[FAIL]${NC} $label — Expected $expected, got $actual"
    ((FAIL++))
  fi
}

echo "============================================"
echo " PAWS SECURITY STRESS TEST"
echo " Target: $BASE_URL"
echo "============================================"
echo ""

# ── TEST 1: Unauthenticated Access ───────────────────────────
echo -e "${YELLOW}── Test 1: Unauthenticated request to secure endpoint${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/paws-secure-action" \
  -H "Content-Type: application/json" \
  -d '{"action":"DELETE_DOG","target_id":"PAWS-26-00402","action_token":"fake"}')
assert_status "Reject unauthenticated request" "401" "$STATUS"

# ── TEST 2: Fake JWT Token ───────────────────────────────────
echo -e "${YELLOW}── Test 2: Forged JWT token${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/paws-secure-action" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIn0.fake" \
  -H "Content-Type: application/json" \
  -d '{"action":"DELETE_DOG","target_id":"PAWS-26-00402","action_token":"fake"}')
assert_status "Reject forged JWT" "401" "$STATUS"

# ── TEST 3: Fake Action Token ────────────────────────────────
echo -e "${YELLOW}── Test 3: Valid auth but fabricated action_token${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/paws-secure-action" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"DELETE_DOG","target_id":"PAWS-26-00402","action_token":"00000000-0000-0000-0000-000000000000"}')
assert_status "Reject fabricated action token" "403" "$STATUS"

# ── TEST 4: Direct DB Delete (RLS Block) ─────────────────────
echo -e "${YELLOW}── Test 4: Direct Supabase REST API delete attempt${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://dorihyvbgbhsxvdrtqqr.supabase.co/rest/v1/paws_dogs?paws_reference=eq.PAWS-26-00402" \
  -X DELETE \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY")
assert_status "RLS blocks direct delete" "403" "$STATUS"

# ── TEST 5: Direct Audit Log Delete (RLS Block) ──────────────
echo -e "${YELLOW}── Test 5: Attempt to delete audit log entries${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://dorihyvbgbhsxvdrtqqr.supabase.co/rest/v1/paws_audit_log?id=eq.fake" \
  -X DELETE \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY")
assert_status "RLS blocks audit log deletion" "403" "$STATUS"

# ── TEST 6: Brute Force Rate Limit ───────────────────────────
echo -e "${YELLOW}── Test 6: Brute force 2FA (6 rapid attempts)${NC}"
LAST_STATUS="200"
for i in {1..6}; do
  LAST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE_URL/paws-2fa-verify" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"00000$i\",\"action\":\"DELETE_DOG\",\"target_id\":\"PAWS-26-00402\"}")
done
assert_status "Rate limit kicks in after 5 attempts" "429" "$LAST_STATUS"

# ── TEST 7: Missing Fields ───────────────────────────────────
echo -e "${YELLOW}── Test 7: Missing required fields in request body${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/paws-secure-action" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_status "Reject empty payload" "400" "$STATUS"

# ── RESULTS ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo " RESULTS: $PASS passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}SYSTEM IS VULNERABLE. Fix the above failures.${NC}"
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED. System is stress-tested.${NC}"
  exit 0
fi
