# LUXARDO FASHION — how the website goes online

There is **one** way. No `.bat` files, no Vercel, no deploying from a laptop.

| You do | What happens |
|---|---|
| Open a **pull request** into `main` | GitHub builds the site and posts a **preview link** on the pull request (valid 7 days). luxardofashion.com is not touched. |
| **Merge** the pull request into `main` | GitHub builds the site and puts it **live** on luxardofashion.com (2–3 minutes). |
| Something went wrong after going live | Firebase console → Hosting → Release history → **Rollback** on the previous version (one click). |

The workflow is `.github/workflows/firebase-deploy.yml`. It needs one repository
secret, `FIREBASE_SERVICE_ACCOUNT` (Settings → Secrets and variables → Actions).

## Where settings live

| Setting | File | Secret? |
|---|---|---|
| Firebase web config | `src/firebase.ts` | No — public by design |
| Google Analytics ID, Meta Pixel ID, Sentry | `src/config/site.ts` | No — public by design |
| Razorpay key secret, webhook secret, Resend key | Firebase Functions secrets | **Yes — never in the code** |
| Collections (menu, collection pages) | Admin → Collections | — |
| Products | Admin → Products | — |

Change a tracking ID in `src/config/site.ts` only; every build picks it up.

## Backend (Cloud Functions, Firestore/Storage rules)

These change rarely and are deployed separately from the website, from a
computer logged in to Firebase (`npx firebase-tools login`):

```
npx firebase-tools deploy --only firestore:rules,storage --project luxardo-fashion-website
npx firebase-tools deploy --only functions:createRazorpayOrderV2,functions:verifyRazorpayPaymentV2,functions:createCodOrder,functions:razorpayWebhook,functions:sendOrderEmail --project luxardo-fashion-website
```

Secrets the functions need (set once):
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`
— `npx firebase-tools functions:secrets:set NAME --project luxardo-fashion-website`.

## Product photos

Upload in Admin → Products. Every photo is automatically resized
(longest side 2000px) and saved as WebP — a 20 MB camera photo becomes a few
hundred KB. No need to resize by hand.

## Run locally

```
npm ci
npm run dev        # http://localhost:5173, talks to the real Firebase project
npm run build      # what GitHub runs
```
