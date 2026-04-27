#!/bin/bash
# privacy_boundary_test.sh
# Demonstrates that anonymous users cannot access sensitive data.

if [ -f .env ]; then
  source .env
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
  exit 1
fi

echo "--- TESTING PUBLIC ACCESS (ANONYMOUS) ---"

echo "1. Attempting to read public dogs (Expected: SUCCESS)..."
curl -s -X GET "$SUPABASE_URL/rest/v1/paws_public_dogs?select=paws_ref,breed&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

echo -e "\n\n2. Attempting to read private dogs table (Expected: EMPTY/FORBIDDEN)..."
# RLS will return an empty list or error depending on setup. In Supabase/PostgREST, it usually returns [] for SELECT.
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_dogs?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
echo "Response: $RES"

echo -e "\n3. Attempting to read audit log (Expected: EMPTY/FORBIDDEN)..."
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_audit_log?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
echo "Response: $RES"

echo -e "\n4. Attempting to read user roles (Expected: EMPTY/FORBIDDEN)..."
RES=$(curl -s -X GET "$SUPABASE_URL/rest/v1/paws_user_roles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")
echo "Response: $RES"

echo -e "\n--- END OF TEST ---"
