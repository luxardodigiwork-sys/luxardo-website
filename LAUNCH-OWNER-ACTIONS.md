# Luxardo Fashion - owner actions before launch

Nothing below has been done by the code changes. No values here are guessed; copy them from your consoles.
Use TWO Firebase projects: **staging** first, **production** only after staging passes.

## Deployment model (important)
- A push to `main` runs checks only. It does NOT deploy.
- Pull requests from this repo get a temporary Hosting **preview channel on the staging project**.
- Production Hosting deploys only via GitHub -> Actions -> "Run workflow", target `production`, typed confirmation `DEPLOY PRODUCTION`, on `main`. Add required reviewers to the GitHub Environment `production` yourself.
- The workflow deploys **Hosting only**. Functions, Firestore rules and Storage rules are deployed with the CLI and an explicit project (there is deliberately no default project):
  `firebase deploy --only functions,firestore:rules,storage --project staging` (alias from `.firebaserc`; production the same with `--project production`). Never run it without `--project`.
- GitHub secrets (per environment): `STAGING_FIREBASE_*` / `PROD_FIREBASE_*` for API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID, plus `*_FIREBASE_SERVICE_ACCOUNT`.
- The site refuses to start if any VITE_FIREBASE_* value is missing/invalid, or if the bucket / auth domain belong to a different project than PROJECT_ID.
- Firestore indexes: no composite indexes are needed by the current queries (single-field equality/range only) and the repo has no `firestore.indexes.json`. If an admin query reports "requires an index", create it from the link in the error and then add `firestore.indexes.json`.

## Firebase Console (do for staging first)
1. Create the project. Project settings -> General: note **Project ID**; add a **Web app** and copy its config.
2. Upgrade to Blaze (Functions + phone SMS); set a budget alert.
3. Authentication: enable **Google** and **Phone**; Authorized domains: add staging/custom domains. Optionally add phone test numbers.
4. Create Firestore (location chosen deliberately) and Storage.
5. Replace `REPLACE_WITH_STAGING_PROJECT_ID` / `REPLACE_WITH_PRODUCTION_PROJECT_ID` in `.firebaserc`.
6. Sign in once on staging; copy your UID (Authentication -> Users). Admin currently also works through two hardcoded UIDs in `firestore.rules`/`storage.rules` (see LAUNCH-SAFETY-NOTES below) - replace them with yours before production.
7. Set Function params/secrets with the CLI: `RAZORPAY_KEY_ID`, `ADMIN_UIDS`, optional `OWNER_NOTIFY_EMAIL`; secrets `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
8. Deploy functions/rules (command above), then Hosting preview. Copy the `razorpayWebhook` URL.
9. Razorpay (Test mode): webhook to that URL, events payment.captured, payment.failed, order.paid, same secret.
10. Install the **Trigger Email from Firestore** extension (collection `mail`) with a real SMTP/SendGrid account and verified sender. Until then orders queue mail documents but NOTHING is delivered.

## Admin UID note
`firestore.rules` and `storage.rules` grant admin to `request.auth.uid` equal to two literal UIDs, or to an `admin` custom claim. UIDs are assigned by Firebase and cannot be chosen by visitors, so strangers cannot become admin; but the UIDs are public in the repo and are meaningless in a new project. Before production: replace both with your own UIDs (or move to the `admin` claim once a claim-setting script exists - not in the repo yet). Do not remove them without a replacement or you lose admin access.

## Catalogue (currently empty -> storefront shows "Products coming soon")
Per single-piece product: name, category, price (INR), stock count, fabric/composition, colour, available sizes, description, 1+ real photos. Add via Admin -> Add Product.

## Not yet verified (needs staging)
Real Google sign-in, phone OTP SMS, Razorpay test payment + webhook, email delivery, Hosting deploy.
