#!/usr/bin/env bash
# Luxardo launch deploy — run in Google Cloud Shell (your own login, no key file).
# Every step that changes production asks for a typed "yes" first.
set -euo pipefail

PROJECT="luxardo-fashion-website"
BRANCH="${BRANCH:-claude/upbeat-fermat-un7uz1}"
REPO="https://github.com/luxardodigiwork-sys/luxardo-website"
DIR="$HOME/luxardo-website"
FB="npx -y firebase-tools@latest --project $PROJECT"

ask() { read -r -p "$1 Type yes to continue: " a; [ "$a" = "yes" ] || { echo "Skipped."; return 1; }; }

echo "== 1. Get latest code ($BRANCH)"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch origin "$BRANCH"; else git clone "$REPO" "$DIR" || { echo "Clone failed. If repo is private run: gh auth login   then re-run."; exit 1; }; fi
cd "$DIR"; git checkout "$BRANCH"; git pull --ff-only origin "$BRANCH"
git log --oneline -1

echo "== 2. Install + build functions"
npm ci --no-audit --no-fund
(cd functions && npm ci --no-audit --no-fund && npm run build)

echo "== 3. Secrets (values are typed by you here; never shared in chat)"
for s in RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET RESEND_API_KEY; do
  if gcloud secrets describe "$s" --project "$PROJECT" >/dev/null 2>&1; then echo "$s: already set"
  else ask "$s is NOT set. Set it now?" && $FB functions:secrets:set "$s"; fi
done

echo "== 4. Deploy functions + Firestore rules + indexes (asks for ADMIN_UIDS, MAIL_FROM, OWNER_NOTIFY_EMAIL, RAZORPAY_KEY_ID)"
if ask "Deploy new functions, rules and indexes to PRODUCTION?"; then
  $FB deploy --only functions,firestore:rules,firestore:indexes
fi

echo "== 5. Remove OLD payment/other functions in us-central1 (not the image-resize extension)"
for f in createRazorpayOrder verifyRazorpayPayment razorpayWebhook onOrderPaid onProductUpdated abandonedCartReminder; do
  if gcloud functions describe "$f" --region us-central1 --gen2 --project "$PROJECT" >/dev/null 2>&1; then
    echo "Last activity of $f:"; gcloud functions logs read "$f" --region us-central1 --gen2 --limit 2 --project "$PROJECT" --format="value(time_utc)" || true
    ask "Delete OLD function $f?" && gcloud functions delete "$f" --region us-central1 --gen2 --project "$PROJECT" --quiet
  fi
done

echo "== 6. Build + deploy website (Hosting)"
if ask "Build and deploy the website to PRODUCTION hosting?"; then
  $FB apps:sdkconfig web --json > /tmp/sdk.json || $FB apps:sdkconfig web > /tmp/sdk.json
  node -e '
    const t=require("fs").readFileSync("/tmp/sdk.json","utf8");
    const m=t.match(/\{[\s\S]*\}/); let o=JSON.parse(m[0]); o=(o.result&&o.result.sdkConfig)||o;
    const e={API_KEY:o.apiKey,AUTH_DOMAIN:o.authDomain,PROJECT_ID:o.projectId,STORAGE_BUCKET:o.storageBucket,MESSAGING_SENDER_ID:o.messagingSenderId,APP_ID:o.appId,MEASUREMENT_ID:o.measurementId||""};
    require("fs").writeFileSync(".env.production.local",Object.entries(e).map(([k,v])=>"VITE_FIREBASE_"+k+"="+v).join("\n")+"\n");'
  npm run build
  $FB deploy --only hosting
fi

cat <<'EOF'

== DONE. Remaining steps for you:
 1. Razorpay Dashboard > Webhooks: set URL to the new razorpayWebhook URL shown in the deploy output (asia-south1), same secret as RAZORPAY_WEBHOOK_SECRET.
 2. Do ONE Razorpay TEST-mode payment, check order shows Paid in admin.
 3. Delete test orders/products from Firebase Console, upload real products.
 4. Delete the service-account key you pasted in chat.
EOF
