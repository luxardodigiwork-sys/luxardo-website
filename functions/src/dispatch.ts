/* eslint-disable */
/**
 * LUXARDO FASHION — PHASE 4 · DISPATCH DOMAIN
 * ============================================================================
 * Cloud Functions for the Dispatch role's piece-routing actions.
 *
 * Finalized rules (locked):
 *  - Dispatch assigns an active Tailor to a DISPATCH_READY piece.
 *  - Dispatch sends a DISPATCH_READY piece directly to STORE (skip-path,
 *    no tailoring).
 *  - Dispatch sends a STITCH_COMPLETE piece to STORE.
 *  - Dispatch does NOT create Tailor staff accounts (staffCreate remains
 *    admin-only). A "New Tailor Request" mechanism is a separate,
 *    not-yet-defined feature — out of scope here.
 * ============================================================================
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireStaff, hasAnyRole } from "./staffAuth";
import { writeAudit } from "./audit";
import { recordMovement } from "./movement";
import { applyPrQuantityDelta } from "./productionRequests";
import { assertOpenPiece, NEXT_STAGES } from "./pieces";

const db = admin.firestore();

const DISPATCH_ROLES = ["dispatch"];
const OVERSIGHT_ROLES = ["dispatch", "admin", "owner", "pm"];

/* ═══════════════════════════════════════════════════════════════════
 * listActiveTailors — read-only list of active Tailor staff, for the
 * Dispatch "Assign Tailor" picker.
 * ═══════════════════════════════════════════════════════════════════ */
export const listActiveTailors = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, OVERSIGHT_ROLES)) {
    throw new HttpsError("permission-denied", "Dispatch/PM/Admin/Owner access required.");
  }
  const snap = await db.collection("staff")
    .where("role", "==", "tailor")
    .where("active", "==", true)
    .get();
  const tailors = snap.docs.map((d) => {
    const t = d.data();
    return { uid: d.id, name: String(t.displayName || "") };
  });
  return { ok: true, tailors };
});

/* ═══════════════════════════════════════════════════════════════════
 * dispatchAssignTailor — Dispatch assigns an active Tailor to a
 * DISPATCH_READY piece.
 * Input : { pieceId, tailorUid, reason? }
 * ═══════════════════════════════════════════════════════════════════ */
export const dispatchAssignTailor = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, DISPATCH_ROLES)) {
    throw new HttpsError("permission-denied", "Dispatch access required.");
  }
  const { pieceId, tailorUid, reason } = (request.data || {}) as { pieceId?: string; tailorUid?: string; reason?: string };
  if (!pieceId || !tailorUid) throw new HttpsError("invalid-argument", "pieceId and tailorUid are required.");

  // Fast-fail only — NOT authoritative. staff/{tailorUid} can change (e.g. an
  // Admin deactivates or re-roles the Tailor via staffUpdate) between this
  // read and the transaction's commit below; the transaction's own fresh
  // read of the same doc is the real gate (MED-2), mirroring the existing
  // pre-check-then-reverify pattern assertOpenPiece/tx.get(ref) already uses
  // for the piece in this same function.
  const tailorPreSnap = await db.doc(`staff/${tailorUid}`).get();
  if (!tailorPreSnap.exists) throw new HttpsError("not-found", `Staff ${tailorUid} not found.`);
  const tailorPreDoc = tailorPreSnap.data()!;
  if (String(tailorPreDoc.role || "") !== "tailor") {
    throw new HttpsError("failed-precondition", `Staff ${tailorUid} is not a Tailor.`);
  }
  if (tailorPreDoc.active === false) {
    throw new HttpsError("failed-precondition", `Tailor ${tailorUid} is not active.`);
  }

  const { ref } = await assertOpenPiece(pieceId);
  const staffRef = db.doc(`staff/${tailorUid}`);
  const now = new Date().toISOString();
  let fromStage = "OPEN";
  let prId: string | null = null;
  let tailorName = "";

  await db.runTransaction(async (tx) => {
    const [snap, tailorSnap] = await Promise.all([tx.get(ref), tx.get(staffRef)]);
    const cur = snap.data()!;
    fromStage = String(cur.stage || "OPEN");
    prId = cur.prId || null;
    if (fromStage !== "DISPATCH_READY") {
      throw new HttpsError("failed-precondition", `Piece ${pieceId} must be DISPATCH_READY to assign a Tailor (current: ${fromStage}).`);
    }
    const allowed = NEXT_STAGES[fromStage] || [];
    if (!allowed.includes("TAILOR_ASSIGNED")) {
      throw new HttpsError("failed-precondition", `Invalid transition: ${fromStage} -> TAILOR_ASSIGNED is not allowed.`);
    }

    // MED-2 — authoritative re-check from THIS transaction's fresh read.
    if (!tailorSnap.exists) {
      throw new HttpsError("not-found", `Staff ${tailorUid} not found.`);
    }
    const tailorDoc = tailorSnap.data()!;
    if (String(tailorDoc.role || "") !== "tailor") {
      throw new HttpsError("failed-precondition", `Staff ${tailorUid} is not a Tailor.`);
    }
    if (tailorDoc.active === false) {
      throw new HttpsError("failed-precondition", `Tailor ${tailorUid} is not active.`);
    }
    tailorName = String(tailorDoc.displayName || "");

    tx.update(ref, {
      stage: "TAILOR_ASSIGNED",
      assignedTailorUid: tailorUid,
      assignedTailorName: tailorName,
      updatedAt: now,
    });
    applyPrQuantityDelta(tx, prId, fromStage, "TAILOR_ASSIGNED");
  });

  const recId = await recordMovement({
    pieceId, fromStage, toStage: "TAILOR_ASSIGNED",
    direction: "FORWARD", action: "DISPATCH_ASSIGN_TAILOR", actor,
    reason: reason || `Assigned to ${tailorName}`, relatedRequestId: prId,
  });
  await writeAudit("DISPATCH_ASSIGN_TAILOR", "pieces", pieceId, actor,
    { stage: fromStage, assignedTailorUid: null },
    { stage: "TAILOR_ASSIGNED", assignedTailorUid: tailorUid, assignedTailorName: tailorName, movementId: recId });

  return { ok: true, pieceId, tailorUid, tailorName };
});

/* ═══════════════════════════════════════════════════════════════════
 * dispatchSendToStore — Dispatch sends a piece to STORE, either directly
 * from DISPATCH_READY (skip-path) or after STITCH_COMPLETE.
 * storeInAt is stamped automatically — there is no separate Store-In step.
 * Input : { pieceId, reason? }
 * ═══════════════════════════════════════════════════════════════════ */
export const dispatchSendToStore = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, DISPATCH_ROLES)) {
    throw new HttpsError("permission-denied", "Dispatch access required.");
  }
  const { pieceId, reason } = (request.data || {}) as { pieceId?: string; reason?: string };
  if (!pieceId) throw new HttpsError("invalid-argument", "pieceId is required.");

  const { ref } = await assertOpenPiece(pieceId);
  const now = new Date().toISOString();
  let fromStage = "OPEN";
  let prId: string | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data()!;
    fromStage = String(cur.stage || "OPEN");
    prId = cur.prId || null;
    if (fromStage !== "DISPATCH_READY" && fromStage !== "STITCH_COMPLETE") {
      throw new HttpsError("failed-precondition", `Piece ${pieceId} must be DISPATCH_READY or STITCH_COMPLETE to send to Store (current: ${fromStage}).`);
    }
    const allowed = NEXT_STAGES[fromStage] || [];
    if (!allowed.includes("STORE")) {
      throw new HttpsError("failed-precondition", `Invalid transition: ${fromStage} -> STORE is not allowed.`);
    }
    tx.update(ref, {
      stage: "STORE",
      storeInAt: now,
      updatedAt: now,
    });
    applyPrQuantityDelta(tx, prId, fromStage, "STORE");
  });

  const recId = await recordMovement({
    pieceId, fromStage, toStage: "STORE",
    direction: "FORWARD", action: "DISPATCH_SEND_TO_STORE", actor,
    reason: reason || null, relatedRequestId: prId,
  });
  await writeAudit("DISPATCH_SEND_TO_STORE", "pieces", pieceId, actor,
    { stage: fromStage }, { stage: "STORE", storeInAt: now, movementId: recId });

  return { ok: true, pieceId };
});
