/* eslint-disable */
/**
 * LUXARDO FASHION — PHASE 4 · NEW TAILOR REQUEST DOMAIN
 * ============================================================================
 * Cloud Functions for the Dispatch -> Admin/Owner New Tailor Request
 * workflow: Dispatch raises a request (name, email, reason); Admin/Owner
 * approve or reject it. Approval automatically provisions the Tailor's
 * Firebase Auth account + staff/{uid} via the shared provisionStaffAccount()
 * helper (production.ts) — the SAME code path staffCreate uses. No duplicate
 * staff-creation mechanism is introduced.
 *
 * Finalized rules (locked):
 *  - Dispatch raises requests; Dispatch can never approve/reject — enforced
 *    structurally, not just by role gate: a staff/{uid} doc has exactly one
 *    role, so a Dispatch identity can never also satisfy the Admin/Owner
 *    gate on the SAME request it raised.
 *  - Only Admin/Owner approve or reject.
 *  - APPROVED and REJECTED are both terminal — no reopening either way.
 *  - Approval is idempotent: a second approve call on an already-APPROVED
 *    request returns the existing result and never creates a second
 *    Firebase Auth user.
 *  - Request records are never deleted.
 * ============================================================================
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateId, provisionStaffAccount } from "./production";
import { requireStaff, hasAnyRole } from "./staffAuth";
import { writeAudit } from "./audit";

const db = admin.firestore();

const RAISE_ROLES = ["dispatch"];
const REVIEW_ROLES = ["admin", "owner"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════════════════════════════════════════════════
 * raiseNewTailorRequest — Dispatch requests a new Tailor be onboarded.
 * Input : { name, email, reason }
 * ═══════════════════════════════════════════════════════════════════ */
export const raiseNewTailorRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, RAISE_ROLES)) {
    throw new HttpsError("permission-denied", "Dispatch access required.");
  }
  const { name, email, reason } = (request.data || {}) as { name?: string; email?: string; reason?: string };
  const nameVal = String(name ?? "").trim();
  const emailVal = String(email ?? "").trim();
  const reasonVal = String(reason ?? "").trim();
  if (!nameVal || !emailVal || !reasonVal) {
    throw new HttpsError("invalid-argument", "name, email and reason are required.");
  }
  if (!EMAIL_RE.test(emailVal)) {
    throw new HttpsError("invalid-argument", "email is not a valid email address.");
  }

  const requestId = await generateId("tailorRequest");
  const now = new Date().toISOString();
  const doc = {
    id: requestId,
    name: nameVal,
    email: emailVal,
    reason: reasonVal,
    status: "PENDING",
    requestedByUid: actor.uid,
    requestedByName: actor.name,
    requestedAt: now,
    reviewedByUid: null,
    reviewedByName: null,
    reviewedAt: null,
    createdTailorUid: null,
    createdTailorName: null,
    rejectionReason: null,
  };
  await db.doc(`tailorRequests/${requestId}`).set(doc);
  await writeAudit("TAILOR_REQUEST_RAISE", "tailorRequests", requestId, actor, null, doc);

  return { ok: true, requestId };
});

/* ═══════════════════════════════════════════════════════════════════
 * approveTailorRequest — Admin/Owner approves a PENDING request. Auto-
 * provisions the Tailor's Firebase Auth account + staff/{uid}.
 * Idempotent: calling again on an already-APPROVED request returns the
 * existing result without creating a second account.
 * Input : { requestId }
 * ═══════════════════════════════════════════════════════════════════ */
export const approveTailorRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, REVIEW_ROLES)) {
    throw new HttpsError("permission-denied", "Admin/Owner access required.");
  }
  const { requestId } = (request.data || {}) as { requestId?: string };
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required.");

  const ref = db.doc(`tailorRequests/${requestId}`);
  const now = new Date().toISOString();

  // Step 1: atomically claim the request (PENDING -> APPROVED) inside a
  // Firestore transaction. This is the ONLY concurrency guard — the actual
  // Auth-user creation below is NOT transactional (Admin SDK auth calls
  // cannot participate in a Firestore transaction and must not be retried
  // blindly), so it must happen strictly after exactly one caller wins this
  // claim. A losing/duplicate caller short-circuits here with the existing
  // result and never reaches Step 2.
  let reqData: admin.firestore.DocumentData | null = null;
  let alreadyApproved = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `Tailor request ${requestId} not found.`);
    const cur = snap.data()!;
    if (cur.status === "APPROVED") {
      reqData = cur;
      alreadyApproved = true;
      return; // idempotent short-circuit — no write
    }
    if (cur.status === "REJECTED") {
      throw new HttpsError("failed-precondition", `Tailor request ${requestId} was already rejected and cannot be reopened.`);
    }
    if (cur.status !== "PENDING") {
      throw new HttpsError("failed-precondition", `Tailor request ${requestId} is not pending.`);
    }
    tx.update(ref, {
      status: "APPROVED",
      reviewedByUid: actor.uid,
      reviewedByName: actor.name,
      reviewedAt: now,
    });
    reqData = { ...cur, status: "APPROVED", reviewedByUid: actor.uid, reviewedByName: actor.name, reviewedAt: now };
  });

  if (!reqData) throw new HttpsError("internal", "Unexpected: request data not captured.");
  const data: admin.firestore.DocumentData = reqData;

  if (alreadyApproved) {
    // HIGH-2 — self-heal a request that is APPROVED (its Tailor account was
    // genuinely provisioned) but never got createdTailorUid recorded, e.g.
    // because the bookkeeping write below failed on a prior attempt. Look
    // the account up by email instead of ever re-provisioning it — the
    // request's claim is never released back to PENDING once provisioning
    // has actually succeeded, so this is the only way a retry can complete.
    if (!data.createdTailorUid) {
      let existingUid: string;
      try {
        const existing = await admin.auth().getUserByEmail(String(data.email));
        existingUid = existing.uid;
      } catch (err) {
        // No account found for this email either — provisioning must have
        // failed before an Auth user was ever created, which the PENDING
        // rollback below already handles for every OTHER caller; reaching
        // APPROVED with no account at all is not expected. Surface it
        // rather than silently returning tailorUid: null.
        throw new HttpsError(
          "internal",
          `Tailor request ${requestId} is APPROVED but no account could be found for ${data.email}. Manual review required.`
        );
      }
      await ref.update({ createdTailorUid: existingUid, createdTailorName: data.name });
      await writeAudit("TAILOR_REQUEST_APPROVE", "tailorRequests", requestId, actor,
        { status: "APPROVED", createdTailorUid: null },
        { status: "APPROVED", createdTailorUid: existingUid, createdTailorName: data.name, reconciled: true });
      return { ok: true, requestId, alreadyApproved: true, tailorUid: existingUid, tailorName: data.name };
    }
    return {
      ok: true, requestId, alreadyApproved: true,
      tailorUid: data.createdTailorUid || null,
      tailorName: data.createdTailorName || null,
    };
  }

  // Step 2: only the transaction's winner reaches here. Provision the
  // account via the SAME code path staffCreate uses — no duplicate
  // staff-creation mechanism.
  let tailorUid: string;
  try {
    const provisioned = await provisionStaffAccount({
      displayName: data.name, email: data.email, role: "tailor", createdByUid: actor.uid,
    });
    tailorUid = provisioned.uid;
  } catch (err) {
    // provisionStaffAccount itself failed — no account was created by THIS
    // call, so it is safe to release the claim back to PENDING for a retry.
    await ref.update({ status: "PENDING", reviewedByUid: null, reviewedByName: null, reviewedAt: null }).catch(() => {});
    throw err;
  }

  // HIGH-2 — the Tailor account now genuinely exists. From this point the
  // request must NEVER be rolled back to PENDING: doing so would make a
  // retry re-call provisionStaffAccount with the same email, which fails
  // with "already-exists" and rolls back again, forever (the original bug).
  // Any failure below is surfaced to the caller as an error, but the request
  // stays APPROVED — a retry then takes the alreadyApproved self-heal branch
  // above instead of re-provisioning.
  await ref.update({ createdTailorUid: tailorUid, createdTailorName: data.name });
  await writeAudit("TAILOR_REQUEST_APPROVE", "tailorRequests", requestId, actor,
    { status: "PENDING" }, { status: "APPROVED", createdTailorUid: tailorUid, createdTailorName: data.name });

  return { ok: true, requestId, tailorUid, tailorName: data.name };
});

/* ═══════════════════════════════════════════════════════════════════
 * rejectTailorRequest — Admin/Owner rejects a PENDING request. Terminal —
 * cannot later be approved. A rejection reason is mandatory.
 * Input : { requestId, rejectionReason }
 * ═══════════════════════════════════════════════════════════════════ */
export const rejectTailorRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, REVIEW_ROLES)) {
    throw new HttpsError("permission-denied", "Admin/Owner access required.");
  }
  const { requestId, rejectionReason } = (request.data || {}) as { requestId?: string; rejectionReason?: string };
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required.");
  const reasonText = String(rejectionReason ?? "").trim();
  if (!reasonText) throw new HttpsError("invalid-argument", "A rejection reason is mandatory.");

  const ref = db.doc(`tailorRequests/${requestId}`);
  const now = new Date().toISOString();
  let alreadyRejected = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `Tailor request ${requestId} not found.`);
    const cur = snap.data()!;
    if (cur.status === "REJECTED") {
      alreadyRejected = true;
      return; // idempotent no-op
    }
    if (cur.status === "APPROVED") {
      throw new HttpsError("failed-precondition", `Tailor request ${requestId} was already approved and cannot be rejected.`);
    }
    tx.update(ref, {
      status: "REJECTED",
      reviewedByUid: actor.uid,
      reviewedByName: actor.name,
      reviewedAt: now,
      rejectionReason: reasonText,
    });
  });

  if (!alreadyRejected) {
    await writeAudit("TAILOR_REQUEST_REJECT", "tailorRequests", requestId, actor,
      { status: "PENDING" }, { status: "REJECTED", rejectionReason: reasonText });
  }

  return { ok: true, requestId };
});
