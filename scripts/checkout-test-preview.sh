#!/usr/bin/env bash
# Deploys a checkout-ENABLED build to a private Firebase Hosting preview channel (expires in 1 day) so one
# Razorpay TEST payment can be made. The live site (checkout off) is not touched. Run in Cloud Shell.
set -euo pipefail

PROJECT="luxardo-fashion-website"
BRANCH="${BRANCH:-claude/upbeat-fermat-un7uz1}"
DIR="$HOME/luxardo-website"

cd "$DIR"
git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH"
[ -f .env.production.local ] || { echo "Missing .env.production.local - run launch-deploy.sh step 6 first."; exit 1; }

npm ci --no-audit --no-fund
VITE_CHECKOUT_ENABLED=true npm run build
npx -y firebase-tools@latest hosting:channel:deploy checkout-test --expires 1d --project "$PROJECT"

cat <<'EOF'

Open the "Channel URL" shown above on your phone.
Before phone OTP works there, add that domain (without https://) in
Firebase Console > Authentication > Settings > Authorized domains.
Use Razorpay TEST card 4111 1111 1111 1111, any future expiry, any CVV.
EOF
