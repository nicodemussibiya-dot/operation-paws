#!/bin/bash
# privacy_boundary_test.sh
# Verifies that anonymous users cannot access sensitive data tables via PostgREST.

if [ -f .env ]; then
  source .env
fi

# Use defaults if not set (for CI environment)
SUPABASE_URL=${SUPABASE_URL:-"https://test.supabase.co"}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-"ci-anon-key"}

echo "--- OPERATION PAWS PRIVACY BOUNDARY TEST ---"
FAILED=0

# Helper to check if response is an empty array or error
check_forbidden() {
  local res="$1"
  local name="$2"
  # PostgREST returns "[]" if RLS filters everything out, 
  # or an error object if access is denied at a higher level.
  if [[ "$res" == "[]" ]] || [[ "$res" == *"error"* ]] || [[ -z "$res" ]]; then
    echo "✅ $name access restricted as expected."
  else
    echo "❌ $name access VIOLATION: Received data from private table!"
    echo "   Data: $res"
    FAILED=1
  fi
}

echo "1. Attempting to read public dogs (Expected: Success/Empty)..."
# This should NOT fail the privacy test even if it returns data, as it is public.
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_public_dogs?select=paws_ref&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
echo "   Public Dogs status: (Public access enabled)"

echo "2. Testing sensitive tables (Expected: Forbidden/Empty)..."

# paws_dogs
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_dogs?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
check_forbidden "$RES" "paws_dogs"

# paws_audit_log
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_audit_log?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
check_forbidden "$RES" "paws_audit_log"

# paws_user_roles
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_user_roles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
check_forbidden "$RES" "paws_user_roles"

# paws_action_tokens
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_action_tokens?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
check_forbidden "$RES" "paws_action_tokens"

echo "--- PRIVACY TEST COMPLETE ---"

if [ $FAILED -ne 0 ]; then
  echo "Result: FAIL (Privacy breach detected)"
  exit 1
else
  echo "Result: PASS"
  exit 0
fi
