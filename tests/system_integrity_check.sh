#!/bin/bash
# system_integrity_check.sh
# Verifies repository health, coherence, and security posture.

echo "--- OPERATION PAWS INTEGRITY CHECK ---"

# 1. Minification Check
echo "1. Checking for 'minified' files (single-line blobs)..."
LONG_LINES=$(find . -maxdepth 1 -name "*.md" -o -name "*.yml" -o -name "*.example" | xargs awk 'length > 1000' | wc -l)
if [ "$LONG_LINES" -eq 0 ]; then
  echo "✅ No minified files detected in root."
else
  echo "❌ Found $LONG_LINES lines longer than 1000 chars. Please reformat."
fi

# 2. Migration Coherence Check
echo "2. Checking migration coherence..."
if grep -q "CREATE TABLE IF NOT EXISTS public.paws_user_roles" supabase/migrations/001_ops_tables.sql; then
  echo "✅ Base table 'paws_user_roles' defined in 001."
else
  echo "❌ 'paws_user_roles' NOT found in 001_ops_tables.sql. Migrations may fail."
fi

# 3. CORS Posture Check
echo "3. Checking CORS posture in Edge Functions..."
if grep -q "corsHeaders(origin)" supabase/functions/paws-intake/index.ts; then
  echo "✅ 'paws-intake' uses allow-list CORS correctly."
else
  echo "❌ 'paws-intake' may have permissive or broken CORS."
fi

# 4. JWT Verification Check
echo "4. Checking JWT verification consistency..."
INTAKE_DEPLOY=$(grep "supabase functions deploy paws-intake" .github/workflows/supabase_deploy.yml)
if [[ "$INTAKE_DEPLOY" == *"--no-verify-jwt"* ]]; then
  echo "❌ 'paws-intake' is deployed with --no-verify-jwt in workflow. This clashes with security goals."
else
  echo "✅ 'paws-intake' deployment uses default (verified) JWT."
fi

echo "--- INTEGRITY CHECK COMPLETE ---"
