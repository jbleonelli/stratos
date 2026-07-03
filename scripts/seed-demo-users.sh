#!/usr/bin/env bash
# Create Cognito demo users and sync them to the seeded Aurora profiles.
#
# Prerequisites: AWS credentials, migrate Lambda deployed with COGNITO_USER_POOL_ID.
# On a fresh stack, run with APPLY_SEED=1 first (default below includes both steps).
#
# Usage:
#   ./scripts/seed-demo-users.sh
#   ./scripts/seed-demo-users.sh stratos-dev-migrate
#   APPLY_SEED=0 ./scripts/seed-demo-users.sh   # skip DB seed, demo users only

set -euo pipefail

FUNCTION="${1:-stratos-dev-migrate}"
REGION="${AWS_REGION:-us-east-1}"
APPLY_SEED="${APPLY_SEED:-1}"

if [[ "$APPLY_SEED" == "1" ]]; then
  PAYLOAD='{"applySeed":true,"seedDemoUsersAfterSeed":true}'
else
  PAYLOAD='{"seedDemoUsers":true}'
fi

echo "Invoking ${FUNCTION} (${REGION})…"
aws lambda invoke \
  --function-name "$FUNCTION" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  --region "$REGION" \
  /dev/stdout
echo

cat <<'EOF'

Demo logins (password for all: Stratos-Demo1!)

  admin@alpha.example    Alpha org owner (full access)
  worker@alpha.example   Alpha scoped worker (Alpha Tower only)
  admin@beta.example     Beta org owner
  tech@swift.example     Swift HVAC contractor (contract work orders)
  staff@adaptiv.example  Platform admin (cross-tenant reads)

SPA: https://d2f5e5oygotxj8.cloudfront.net
EOF
