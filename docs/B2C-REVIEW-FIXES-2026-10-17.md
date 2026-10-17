# Follow-up fixes for the B2C recovery review

These changes follow the review of checkpoint `f77bdba` on `consolidate/b2c-recovery-2026-10-17`. They do not deploy or enable checkout.

## Fixed behavior

1. Razorpay receipts use a deterministic 35-character hash of the complete order ID. The order stores `razorpayReceipt`; provider notes retain the full order ID and UID. Existing accepted provider orders are reused, not recreated or renamed.
2. Admin cancellation validates current shipment state, tracking and dispatch evidence inside the stock-release transaction. A stale caller view cannot cancel a shipped order and put its stock back on sale. Repeated successful cancellation remains release-once.
3. Creating, reconciliation-required and legacy-without-setup-state orders are held for operator review. Only ready unpaid orders expire automatically; transaction-time rechecks prevent stale selections releasing an unresolved order. Customer/admin cancellation cannot bypass unresolved setup. Held orders still count toward the existing user cap. The old composite index is retained and the new ready-state expiry index is added separately.
4. Confirmation copy distinguishes paid fulfilment, paid cancellation, unpaid cancellation, on-hold, unresolved setup, returns and delivery problems. Cancelled/on-hold payments do not show a successful preparation message or emit a new purchase event. Ready-to-Stitch wording remains visible.

## Local evidence

- Frontend typecheck, frontend build (checkout disabled), Functions build: passed.
- Unit tests: 130 passed, including receipt and confirmation-state regressions.
- Order/payment/stock emulator suite: 59 passed; an additional targeted unpaid-cap regression passed separately. GitHub CI runs all 60 together on the final pushed commit.
- Firestore/Storage rules: 36 passed.
- Content publishing: 13 passed.
- Notification logic: 13 passed.
- Functions trigger emulator: attempted with Java 21; failed locally because this sandbox denies the emulator's Unix socket (`listen EPERM`), followed by mail-delivery timeout. This is not counted as a local pass. The complete trigger suite must pass on GitHub CI before this branch is described as verified.
- Diff whitespace check passed. No real Razorpay calls, payment, live email, production data or deployment was used by these tests.

## Later environment verification

Deploy/verify the additional index before checking the new expiry query in staging. Never bulk-mark old orders ready: verify provider order ID, amount/currency and outcome first. Reconcile by `razorpayReceipt` and `notes.orderId`; older receipts may equal the full order ID. Uncertain orders require reviewed operator repair/cancellation, not blind retry. Historical credential rotation and live-provider verification remain separate pending work. The draft PR records CI results for the actual pushed head.
