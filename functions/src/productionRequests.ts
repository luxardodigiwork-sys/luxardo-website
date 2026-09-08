/* eslint-disable */
/**
 * LUXARDO FASHION — PHASE 2 · BLOCK 2.4 · PRODUCTION REQUEST
 * ============================================================================
 * Cloud Functions for the production-request foundation.
 *
 * Finalized rules (locked):
 *  - Dispatch creates / submits reproduction or additional production requests.
 *  - Each PR has its own PR-XXXX ID (transaction-safe).
 *  - Quantity defaults to 0. A PR CANNOT be submitted at quantity 0.
 *  - Quantity may be edited BEFORE Owner approval. After approval the
 *    originalOrderedQty is PERMANENTLY FROZEN.
 *  - An approved PR's design version can never be silently changed.
 *  - Additional quantity ALWAYS requires a NEW PR (never merged in).
 *  - Owner approval is REQUIRED before PM can receive/work the PR.
 *  - Rejection by Owner stores actor, timestamp and mandatory reason.
 *  - Post-approval edits are limited to urgency + requiredDate (audited).
 * ============================================================================
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { generateId } from "./production";
import { requireStaff, hasAnyRole, StaffIdentity } from "./staffAuth";
import { auditDoc, writeAudit } from "./audit";

const db = admin.firestore();

const PR_CREATORS = ["admin", "owner", "dispatch"];
const PR_EDITORS = ["admin", "owner", "dispatch"];
const PR_APPROVERS = ["admin", "owner"];
const PR_AUDIT_EDITORS = ["admin", "owner"];

const URGENCY_LEVELS = ["HIGH", "MEDIUM", "LOW"];
const REQUIRED_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Audit helper inside a transaction (atomic with the state change). */
function txAudit(
  tx: admin.firestore.Transaction,
  action: string,
  entity: string,
  entityId: string,
  actor: StaffIdentity,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const rec = auditDoc(action, entity, entityId, actor, before, after);
  rec.id = crypto.randomUUID();
  tx.set(db.collection("auditLogs").doc(rec.id), rec);
}

/** The referenced design version must be an approved, frozen version. */
async function assertFrozenDesignVersion(designId: string, designVersionId: string): Promise<void> {
  const snap = await db.doc(`designVersions/${designVersionId}`).get();
  if (!snap.exists) {
    throw new HttpsError("invalid-argument", `Design version ${designVersionId} not found.`);
  }
  const v = snap.data()!;
  if (v.designId !== designId || !v.frozen || v.snapshot?.status !== "APPROVED") {
    throw new HttpsError("failed-precondition", "Only an Owner-approved (frozen) design version can be produced.");
  }
}

function normalizeQty(n: unknown): number {
  const q = Number(n);
  if (!Number.isFinite(q) || q < 0) throw new HttpsError("invalid-argument", "Quantity must be a non-negative number.");
  return Math.floor(q);
}

/** Derive the 6-facet quantity map from the ordered quantity. */
function qtyMap(ordered: number) {
  return {
    originalOrderedQty: ordered,
    currentActiveQty: 0,
    completedQty: 0,
    reworkQty: 0,
    rejectedQty: 0,
    pendingQty: ordered,
    totalPieceCount: ordered,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * prCreate — Dispatch/admin/owner creates a production request (DRAFT).
 * Input : { designId, designVersionId, quantity?, urgency?, requiredDate?, garmentType? }
 * Output: { ok, id, pr }
 * Quantity defaults to 0 and must be > 0 to submit.
 * ═══════════════════════════════════════════════════════════════════ */
export const prCreate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_CREATORS)) {
    throw new HttpsError("permission-denied", "Dispatch/Admin/Owner access required.");
  }

  const { designId, designVersionId, quantity, urgency, requiredDate, garmentType } = (request.data || {}) as {
    designId?: string; designVersionId?: string; quantity?: number;
    urgency?: string; requiredDate?: string; garmentType?: string;
  };
  if (!designId || !designVersionId) {
    throw new HttpsError("invalid-argument", "designId and designVersionId are required.");
  }
  await assertFrozenDesignVersion(designId, designVersionId);

  const qty = normalizeQty(quantity ?? 0);
  const urgencyLevel = String(urgency ?? "MEDIUM").toUpperCase();
  if (!URGENCY_LEVELS.includes(urgencyLevel)) throw new HttpsError("invalid-argument", "Invalid urgency level.");
  if (requiredDate !== undefined && !REQUIRED_DATE_RE.test(String(requiredDate))) {
    throw new HttpsError("invalid-argument", "requiredDate must be YYYY-MM-DD.");
  }

  const prId = await generateId("pr");
  const now = new Date().toISOString();
  const pr = {
    id: prId,
    requestedBy: actor.uid,
    requestedByName: actor.name,
    requestedByRole: actor.role,
    createdAt: now,
    updatedAt: now,
    designId,
    designVersionId,
    garmentType: String(garmentType ?? ""),
    ...qtyMap(qty),
    originalQtyFrozen: false,
    status: "DRAFT",
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedByName: null,
    rejectedAt: null,
    rejectionReason: null,
    urgency: urgencyLevel as "HIGH" | "MEDIUM" | "LOW",
    requiredDate: String(requiredDate ?? ""),
    cancelledBy: null,
    cancelledAt: null,
    createdBy: actor.uid,
    createdByName: actor.name,
  };

  await db.doc(`productionRequests/${prId}`).set(pr);
  await writeAudit("PR_CREATE", "productionRequests", prId, actor, null, pr);

  return { ok: true, id: prId, pr };
});

/* ═══════════════════════════════════════════════════════════════════
 * prUpdate — edit a PRE-approval PR (quantity, urgency, requiredDate, garmentType).
 * Quantity edits permitted only while originalQtyFrozen === false.
 * Input : { id, quantity?, urgency?, requiredDate?, garmentType? }
 * ═══════════════════════════════════════════════════════════════════ */
export const prUpdate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_EDITORS)) {
    throw new HttpsError("permission-denied", "Dispatch/Admin/Owner access required.");
  }

  const { id, quantity, urgency, requiredDate, garmentType } = (request.data || {}) as {
    id?: string; quantity?: number; urgency?: string; requiredDate?: string; garmentType?: string;
  };
  if (!id) throw new HttpsError("invalid-argument", "PR id required.");

  const ref = db.doc(`productionRequests/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `PR ${id} not found.`);
    const d = snap.data()!;
    if (d.originalQtyFrozen || d.status === "APPROVED" || d.status === "IN_PRODUCTION" || d.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Approved PR quantity is immutable. Additional quantity requires a NEW request.");
    }

    const patch: Record<string, unknown> = {};
    if (quantity !== undefined) {
      const q = normalizeQty(quantity);
      Object.assign(patch, qtyMap(q));
      txAudit(tx, "PR_EDIT_QTY", "productionRequests", id, actor,
        { originalOrderedQty: d.originalOrderedQty }, { originalOrderedQty: q });
    }
    if (urgency !== undefined) {
      const u = String(urgency).toUpperCase();
      if (!URGENCY_LEVELS.includes(u)) throw new HttpsError("invalid-argument", "Invalid urgency level.");
      patch.urgency = u;
    }
    if (requiredDate !== undefined) {
      if (!REQUIRED_DATE_RE.test(String(requiredDate))) throw new HttpsError("invalid-argument", "requiredDate must be YYYY-MM-DD.");
      patch.requiredDate = String(requiredDate);
    }
    if (garmentType !== undefined) patch.garmentType = String(garmentType);
    if (Object.keys(patch).length === 0) throw new HttpsError("invalid-argument", "No valid fields to update.");
    patch.updatedAt = new Date().toISOString();
    tx.update(ref, patch);
  });

  return { ok: true, id };
});

/* ═══════════════════════════════════════════════════════════════════
 * prSubmit — submit PR for Owner approval. Rejected at quantity 0.
 * Input : { id }
 * ═══════════════════════════════════════════════════════════════════ */
export const prSubmit = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_CREATORS)) {
    throw new HttpsError("permission-denied", "Dispatch/Admin/Owner access required.");
  }
  const { id } = (request.data || {}) as { id?: string };
  if (!id) throw new HttpsError("invalid-argument", "PR id required.");

  const ref = db.doc(`productionRequests/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `PR ${id} not found.`);
    const d = snap.data()!;
    if (d.originalQtyFrozen || d.status === "APPROVED" || d.status === "IN_PRODUCTION" || d.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "PR already approved.");
    }
    if (Number(d.originalOrderedQty) <= 0) {
      throw new HttpsError("invalid-argument", "A production request CANNOT be submitted with quantity 0.");
    }
    await assertFrozenDesignVersion(String(d.designId), String(d.designVersionId));
    tx.update(ref, { status: "SUBMITTED", updatedAt: new Date().toISOString() });
    txAudit(tx, "PR_SUBMIT", "productionRequests", id, actor,
      { status: d.status }, { status: "SUBMITTED" });
  });
  return { ok: true, id };
});

/* ═══════════════════════════════════════════════════════════════════
 * prApprove — Owner/Admin approves. Freezes originalOrderedQty + design version.
 * PM may only receive Owner-approved PRs.
 * Input : { id }
 * ═══════════════════════════════════════════════════════════════════ */
export const prApprove = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_APPROVERS)) {
    throw new HttpsError("permission-denied", "Owner/Admin approval required.");
  }
  const { id } = (request.data || {}) as { id?: string };
  if (!id) throw new HttpsError("invalid-argument", "PR id required.");

  const ref = db.doc(`productionRequests/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `PR ${id} not found.`);
    const d = snap.data()!;
    if (d.status === "APPROVED" || d.status === "IN_PRODUCTION" || d.status === "COMPLETED") {
      throw new HttpsError("already-exists", "PR already approved.");
    }
    if (d.status !== "SUBMITTED") throw new HttpsError("failed-precondition", "PR must be submitted before approval.");
    if (Number(d.originalOrderedQty) <= 0) {
      throw new HttpsError("invalid-argument", "Cannot approve a PR with quantity 0.");
    }
    await assertFrozenDesignVersion(String(d.designId), String(d.designVersionId));

    const now = new Date().toISOString();
    tx.update(ref, {
      status: "APPROVED",
      originalQtyFrozen: true,
      approvedBy: actor.uid,
      approvedByName: actor.name,
      approvedAt: now,
      updatedAt: now,
    });
    txAudit(tx, "PR_APPROVE", "productionRequests", id, actor,
      { status: d.status, originalOrderedQty: d.originalOrderedQty }, { status: "APPROVED", originalQtyFrozen: true });
  });
  return { ok: true, id };
});

/* ═══════════════════════════════════════════════════════════════════
 * prReject — Owner (or Admin) rejects; mandatory reason recorded.
 * Input : { id, reason }
 * ═══════════════════════════════════════════════════════════════════ */
export const prReject = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_APPROVERS)) {
    throw new HttpsError("permission-denied", "Owner/Admin access required.");
  }
  const { id, reason } = (request.data || {}) as { id?: string; reason?: string };
  if (!id) throw new HttpsError("invalid-argument", "PR id required.");
  const reasonText = String(reason ?? "").trim();
  if (!reasonText) throw new HttpsError("invalid-argument", "A rejection reason is mandatory.");

  const ref = db.doc(`productionRequests/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `PR ${id} not found.`);
    const d = snap.data()!;
    if (d.status === "APPROVED" || d.status === "IN_PRODUCTION" || d.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Approved PR cannot be rejected — create a new request instead.");
    }
    if (d.originalQtyFrozen) throw new HttpsError("failed-precondition", "Quantity already frozen; cannot reject.");

    const now = new Date().toISOString();
    tx.update(ref, {
      status: "REJECTED_BY_OWNER",
      rejectedBy: actor.uid,
      rejectedByName: actor.name,
      rejectedAt: now,
      rejectionReason: reasonText,
      updatedAt: now,
    });
    txAudit(tx, "PR_REJECT", "productionRequests", id, actor,
      { status: d.status }, { status: "REJECTED_BY_OWNER", rejectionReason: reasonText });
  });
  return { ok: true, id };
});

/* ═══════════════════════════════════════════════════════════════════
 * prEditApproved — post-approval edits. Only urgency + requiredDate,
 * and only Owner/Admin. Every edit is written to the PR audit sub-collection.
 * Input : { id, urgency?, requiredDate? }
 * ═══════════════════════════════════════════════════════════════════ */
export const prEditApproved = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, PR_AUDIT_EDITORS)) {
    throw new HttpsError("permission-denied", "Owner/Admin access required.");
  }
  const { id, urgency, requiredDate } = (request.data || {}) as {
    id?: string; urgency?: string; requiredDate?: string;
  };
  if (!id) throw new HttpsError("invalid-argument", "PR id required.");

  const ref = db.doc(`productionRequests/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", `PR ${id} not found.`);
    const d = snap.data()!;
    if (!d.originalQtyFrozen || d.status !== "APPROVED") {
      throw new HttpsError("failed-precondition", "Only approved PRs support post-approval edits (urgency/requiredDate).");
    }

    const patch: Record<string, unknown> = {};
    const audits: Array<{ field: string; oldValue: string | number; newValue: string | number }> = [];

    if (urgency !== undefined) {
      const u = String(urgency).toUpperCase();
      if (!URGENCY_LEVELS.includes(u)) throw new HttpsError("invalid-argument", "Invalid urgency level.");
      if (u !== d.urgency) {
        patch.urgency = u;
        audits.push({ field: "urgency", oldValue: d.urgency, newValue: u });
      }
    }
    if (requiredDate !== undefined) {
      if (!REQUIRED_DATE_RE.test(String(requiredDate))) throw new HttpsError("invalid-argument", "requiredDate must be YYYY-MM-DD.");
      if (String(requiredDate) !== d.requiredDate) {
        patch.requiredDate = String(requiredDate);
        audits.push({ field: "requiredDate", oldValue: d.requiredDate, newValue: String(requiredDate) });
      }
    }
    if (Object.keys(patch).length === 0) throw new HttpsError("invalid-argument", "No valid fields to edit.");

    patch.updatedAt = new Date().toISOString();
    tx.update(ref, patch);

    for (const a of audits) {
      const docId = `${id}-ed-${crypto.randomUUID().slice(0, 8)}`;
      tx.set(db.doc(`productionRequests/${id}/audit/${docId}`), {
        id: docId,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        editedBy: actor.uid,
        editedByName: actor.name,
        editedByRole: actor.role,
        at: new Date().toISOString(),
      });
      txAudit(tx, a.field === "urgency" ? "PR_EDIT_URGENCY" : "PR_EDIT_REQUIREDDATE",
        "productionRequests", id, actor, { [a.field]: a.oldValue }, { [a.field]: a.newValue });
    }
  });
  return { ok: true, id };
});