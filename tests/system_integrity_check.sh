#!/bin/bash
# system_integrity_check.sh
# Verifies repository health, coherence, and security posture.

echo "--- OPERATION PAWS INTEGRITY CHECK ---"
FAILED=0

# 1. Minification Check
echo "1. Checking for 'minified' files (single-line blobs)..."
# Check files in root
for f in README.md SECURITY.md Structure .env.example; do
  if [ -f "$f" ]; then
    LINE_COUNT=$(wc -l < "$f")
    if [ "$LINE_COUNT" -lt 5 ]; then
      echo "❌ $f looks like a single-line blob ($LINE_COUNT lines)."
      FAILED=1
    else
      echo "✅ $f has $LINE_COUNT lines."
    fi
  fi
done

# 2. Migration Coherence Check
echo "2. Checking migration coherence..."
if grep -q "CREATE TABLE IF NOT EXISTS public.paws_user_roles" supabase/migrations/001_ops_tables.sql; then
  echo "✅ Base table 'paws_user_roles' defined in 001."
else
  echo "❌ 'paws_user_roles' NOT found in 001_ops_tables.sql."
  FAILED=1
fi

# Check for the partner role constraint fix
if grep -q "'partner'" supabase/migrations/001_ops_tables.sql; then
  echo "✅ 'partner' role found in 001 migrations."
else
  echo "❌ 'partner' role MISSING from 001 migrations (logic mismatch with escrow policy)."
  FAILED=1
fi

# 3. CORS Posture Check
echo "3. Checking CORS posture in Edge Functions..."
if grep -q "corsHeaders(origin)" supabase/functions/paws-intake/index.ts; then
  echo "✅ 'paws-intake' uses allow-list CORS correctly."
else
  echo "❌ 'paws-intake' may have permissive or broken CORS."
  FAILED=1
fi

# 4. JWT Verification Check
echo "4. Checking JWT verification consistency..."
INTAKE_DEPLOY=$(grep "supabase functions deploy paws-intake" .github/workflows/supabase_deploy.yml)
if [[ "$INTAKE_DEPLOY" == *"--no-verify-jwt"* ]]; then
  echo "❌ 'paws-intake' is deployed with --no-verify-jwt in workflow. This is a security risk."
  FAILED=1
else
  echo "✅ 'paws-intake' deployment uses default (verified) JWT."
fi

echo "--- INTEGRITY CHECK COMPLETE ---"

if [ $FAILED -ne 0 ]; then
  echo "Result: FAIL"
  exit 1
else
  echo "Result: PASS"
  exit 0
fi
