# Luxardo Fashion - owner actions before launch

Nothing below has been done by the code changes. No values here are guessed; copy them from your consoles.
Use TWO Firebase projects: **staging** first, **production** only after staging passes.

## Deployment model (important)
- A push to `main` runs checks only. It does NOT deploy.
- Pull requests and ordinary pushes run checks only. A staging Hosting preview requires a manual workflow run with target `staging`.
- Production Hosting deploys only via GitHub -> Actions -> "Run workflow", target `production`, typed confirmation `DEPLOY PRODUCTION`, on `main`. Add required reviewers to the GitHub Environment `production` yourself.
- The workflow deploys **Hosting only**. Functions, Firestore rules and Storage rules are deployed with the CLI and an explicit project (there is deliberately no default project):
  `firebase deploy --only functions,firestore:rules,storage,firestore:indexes --project staging` (alias from `.firebaserc`; production the same with `--project production`). Never run it without `--project`.
- GitHub secrets (per environment): `STAGING_FIREBASE_*` / `PROD_FIREBASE_*` for API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID, plus `*_FIREBASE_SERVICE_ACCOUNT`.
- The site refuses to start if any VITE_FIREBASE_* value is missing/invalid, or if the bucket / auth domain belong to a different project than PROJECT_ID.
- Deploy the checked-in `firestore.indexes.json`. The expired pending-order sweep requires its composite orders index; wait for that index to become ready before verifying expiry processing.

## Firebase Console (do for staging first)
1. Create the project. Project settings -> General: note **Project ID**; add a **Web app** and copy its config.
2. Upgrade to Blaze (Functions + phone SMS); set a budget alert.
3. Authentication: enable **Google** and **Phone**; Authorized domains: add staging/custom domains. Optionally add phone test numbers.
4. Create Firestore (location chosen deliberately) and Storage.
5. Replace the staging placeholder in `.firebaserc`; independently verify the existing production project alias before any later deployment.
6. Sign in once on staging; copy your UID (Authentication -> Users). Staff access should be granted through server-issued Firebase custom claims. Verify the actual staging UID and claims; never assume they are configured just because the code supports them.
7. Set Function params/secrets with the CLI: `RAZORPAY_KEY_ID`, `ADMIN_UIDS`, optional `OWNER_NOTIFY_EMAIL`; secrets `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
8. Deploy functions/rules (command above), then Hosting preview. Copy the `razorpayWebhook` URL.
9. Razorpay (Test mode): webhook to that URL, events payment.captured, payment.failed, order.paid, same secret.
10. Configure Resend for the existing `mail` queue: set the Functions secret `RESEND_API_KEY`; set `MAIL_FROM` to a sender on a domain verified in Resend; set `OWNER_NOTIFY_EMAIL` to the monitored owner address. The current backend uses Resend, not Trigger Email. Do NOT install a second sender on the same queue: competing consumers can duplicate delivery or conflict on delivery state. Do not uninstall or alter any existing production extension without a separate migration plan.

## Admin UID note
`firestore.rules` and `storage.rules` support an owner bootstrap UID and server-issued admin/role claims. Do not edit UID literals based on guesswork. Use maintained server-side staff-role tooling to assign claims, verify them with a test account, and ensure a user's editable profile cannot grant staff access. Bootstrap UID migration requires a reviewed rules change and an explicit project-specific UID from Firebase Console.

## Resend email setup
1. Verify the sending domain and sender identity in Resend.
2. Set the Functions secret `RESEND_API_KEY`; set `MAIL_FROM` to a verified sender and `OWNER_NOTIFY_EMAIL` to the monitored owner address.
3. Emulator tests do not prove real provider delivery. Test a real message on staging only.

## Deploy code and rules separately
- Hosting is a manual GitHub Actions workflow and deploys the frontend only; checkout stays disabled by default.
- Deploy Functions, Firestore rules, Storage rules, and indexes separately to staging after review: `firebase deploy --only functions,firestore:rules,storage,firestore:indexes --project staging`. Never omit `--project`.
- The expiry sweep requires the composite orders index checked into this PR.

## Catalogue (verify the actual environment; empty catalogues show "Products coming soon")
Per single-piece product: name, category, price (INR), stock count, fabric/composition, colour, available sizes, description, 1+ real photos. Add via Admin -> Add Product.

## Not yet verified (needs staging)
Real Google sign-in, phone OTP SMS, Razorpay test payment + webhook, email delivery, Hosting deploy.

## Ambiguous Razorpay order recovery
Orders in `reconciliation_required` are intentionally not auto-retried. Use the same Razorpay mode/account to reconcile the order by stored `razorpayReceipt`, amount, currency, time and `notes.orderId`. New receipts are deterministic 35-character values; legacy receipts may equal the full order ID. Attach a verified single provider order only through a reviewed Admin SDK repair procedure and only if no provider ID has already been accepted. If provider state is uncertain, leave the order pending and escalate. Release stock only after confirming no provider order/payment exists and performing a transactionally guarded, release-once cancellation. No automated repair script is included; this requires an operator.


The expiry sweep selects only `rzpOrderCreationState=ready` orders and rechecks eligibility in the stock transaction. `creating`, `reconciliation_required`, and legacy records without a setup state remain reserved until reviewed. Deploy the updated composite index before the Functions verification. Existing orders must not be bulk-marked ready: verify the provider ID, amount and currency first. Customer/admin cancellation also refuses unresolved setup; use a reviewed operator procedure only after confirming provider state.
