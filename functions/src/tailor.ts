/* eslint-disable */
/**
 * LUXARDO FASHION — PHASE 4 · TAILOR DOMAIN
 * ============================================================================
 * Cloud Functions for the Tailor role's stitching-session actions.
 *
 * Finalized rules (locked):
 *  - A Tailor can act ONLY on pieces assigned to that Tailor
 *    (piece.assignedTailorUid === actor.uid).
 *  - Start Stitching creates a NEW tailorSessions record.
 *  - Complete Stitching requires a garment image (COMPULSORY).
 *  - Stitched piece goes directly to Store (never Grading) — Dispatch owns
 *    the STITCH_COMPLETE -> STORE hop (see dispatch.ts), not this file.
 * ============================================================================
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateId } from "./production";
import { requireStaff, hasAnyRole } from "./staffAuth";
import { writeAudit } from "./audit";
import { recordMovement } from "./movement";
import { applyPrQuantityDelta } from "./productionRequests";
import { assertOpenPiece, NEXT_STAGES } from "./pieces";

const db = admin.firestore();

const TAILOR_ROLES = ["tailor"];

/* ═══════════════════════════════════════════════════════════════════
 * tailorStartStitching — Tailor starts stitching on a piece assigned to
 * them. Creates a tailorSessions record.
 * Input : { pieceId }
 * ═══════════════════════════════════════════════════════════════════ */
export const tailorStartStitching = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, TAILOR_ROLES)) {
    throw new HttpsError("permission-denied", "Tailor access required.");
  }
  const { pieceId } = (request.data || {}) as { pieceId?: string };
  if (!pieceId) throw new HttpsError("invalid-argument", "pieceId is required.");

  const { ref } = await assertOpenPiece(pieceId);
  const sessionId = await generateId("tailorSession");
  const now = new Date().toISOString();
  let fromStage = "OPEN";
  let prId: string | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data()!;
    fromStage = String(cur.stage || "OPEN");
    prId = cur.prId || null;
    if (cur.assignedTailorUid !== actor.uid) {
      throw new HttpsError("permission-denied", `Piece ${pieceId} is not assigned to you.`);
    }
    if (fromStage !== "TAILOR_ASSIGNED") {
      throw new HttpsError("failed-precondition", `Piece ${pieceId} must be TAILOR_ASSIGNED to start stitching (current: ${fromStage}).`);
    }
    const allowed = NEXT_STAGES[fromStage] || [];
    if (!allowed.includes("STITCHING")) {
      throw new HttpsError("failed-precondition", `Invalid transition: ${fromStage} -> STITCHING is not allowed.`);
    }
    tx.update(ref, {
      stage: "STITCHING",
      tailorSessionId: sessionId,
      tailorStartAt: now,
      updatedAt: now,
    });
    tx.set(db.doc(`tailorSessions/${sessionId}`), {
      id: sessionId,
      pieceId,
      tailorUid: actor.uid,
      tailorName: actor.name,
      startedAt: now,
      completedAt: null,
      garmentImageUrl: null,
      garmentImagePath: null,
      note: "",
    });
    applyPrQuantityDelta(tx, prId, fromStage, "STITCHING");
  });

  const recId = await recordMovement({
    pieceId, fromStage, toStage: "STITCHING",
    direction: "FORWARD", action: "TAILOR_START", actor,
    reason: null, relatedRequestId: prId,
  });
  await writeAudit("TAILOR_START", "pieces", pieceId, actor,
    { stage: fromStage }, { stage: "STITCHING", tailorSessionId: sessionId, movementId: recId });

  return { ok: true, pieceId, sessionId };
});

/* ═══════════════════════════════════════════════════════════════════
 * tailorCompleteStitching — Tailor completes stitching on their own
 * in-progress piece. Garment image is COMPULSORY.
 * Input : { pieceId, garmentImageUrl, garmentImagePath?, note? }
 * ═══════════════════════════════════════════════════════════════════ */
export const tailorCompleteStitching = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireStaff(request.auth.uid);
  if (!hasAnyRole(actor, TAILOR_ROLES)) {
    throw new HttpsError("permission-denied", "Tailor access required.");
  }
  const { pieceId, garmentImageUrl, garmentImagePath, note } = (request.data || {}) as {
    pieceId?: string; garmentImageUrl?: string; garmentImagePath?: string; note?: string;
  };
  if (!pieceId) throw new HttpsError("invalid-argument", "pieceId is required.");
  const imageUrl = String(garmentImageUrl ?? "").trim();
  if (!imageUrl) throw new HttpsError("invalid-argument", "A garment image is mandatory to complete stitching.");

  const { ref } = await assertOpenPiece(pieceId);
  const now = new Date().toISOString();
  let fromStage = "OPEN";
  let prId: string | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data()!;
    fromStage = String(cur.stage || "OPEN");
    prId = cur.prId || null;
    if (cur.assignedTailorUid !== actor.uid) {
      throw new HttpsError("permission-denied", `Piece ${pieceId} is not assigned to you.`);
    }
    if (fromStage !== "STITCHING") {
      throw new HttpsError("failed-precondition", `Piece ${pieceId} must be STITCHING to complete (current: ${fromStage}).`);
    }
    const allowed = NEXT_STAGES[fromStage] || [];
    if (!allowed.includes("STITCH_COMPLETE")) {
      throw new HttpsError("failed-precondition", `Invalid transition: ${fromStage} -> STITCH_COMPLETE is not allowed.`);
    }
    const sessionId = String(cur.tailorSessionId || "");
    if (!sessionId) {
      throw new HttpsError("failed-precondition", `Piece ${pieceId} has no active tailoring session.`);
    }
    const sessionRef = db.doc(`tailorSessions/${sessionId}`);
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", `Tailor session ${sessionId} not found.`);
    }

    tx.update(ref, {
      stage: "STITCH_COMPLETE",
      tailorEndAt: now,
      updatedAt: now,
    });
    tx.update(sessionRef, {
      completedAt: now,
      garmentImageUrl: imageUrl,
      garmentImagePath: garmentImagePath || null,
      note: String(note || ""),
    });
    applyPrQuantityDelta(tx, prId, fromStage, "STITCH_COMPLETE");
  });

  const recId = await recordMovement({
    pieceId, fromStage, toStage: "STITCH_COMPLETE",
    direction: "FORWARD", action: "TAILOR_COMPLETE", actor,
    reason: note || null, relatedRequestId: prId,
  });
  await writeAudit("TAILOR_COMPLETE", "pieces", pieceId, actor,
    { stage: fromStage }, { stage: "STITCH_COMPLETE", garmentImageUrl: imageUrl, movementId: recId });

  return { ok: true, pieceId };
});
