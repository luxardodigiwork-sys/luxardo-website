# Checkout security test (emulators only)

Proves the server — not the browser — decides prices and payment status.

```bash
(cd functions && npm ci && npm run build)
# functions/.env.local      -> RAZORPAY_MOCK=1
# functions/.secret.local   -> RAZORPAY_KEY_ID=rzp_test_local
#                              RAZORPAY_KEY_SECRET=local_test_secret_123
#                              RAZORPAY_WEBHOOK_SECRET=local_webhook_secret
#                              RESEND_API_KEY=re_local
firebase emulators:start --config firebase.b2c-e2e.json --project demo-luxardo-b2c
cd qa-checkout && npm i && npm test      # expect RESULT pass=21 fail=0
```

Note: in some sandboxes the emulator cannot register Firestore triggers;
comment out the `sendOrderEmail` export in `functions/lib/index.js` (build
output only) for local runs. Never edit `src/`.
