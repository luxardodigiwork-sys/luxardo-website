/* eslint-disable */
/**
 * LUXARDO FASHION — PHASE 2 · BLOCK 5 · PIECE MOVEMENT HISTORY
 * ============================================================================
 * Shared, append-only movement-history service (pieceMovementHistory).
 *
 * EVERY important piece transition appends one permanent record. Records are
 * NEVER mutated or deleted. Reverse movement is represented as a NEW forward
 * history event (with its own id + timestamp) so the original movement stays
 * intact and the full trail is reconstructable:
 *
 *   piece → fromStage → toStage → actor → timestamp → action
 *         → reason (where applicable) → related PR → related Piece
 *
 * A piece's very first record (creation) has fromStage = null.
 * ============================================================================
 */

import * as admin from "firebase-admin";
import * as crypto from "crypto";
import type { StaffIdentity } from "./staffAuth";

const db = admin.firestore();

export type MovementInput = {
  pieceId: string;
  fromStage: string | null;
  toStage: string;
  direction: "FORWARD" | "REVERSE";
  action: string; // "WORK_START" | "WORK_STOP" | "REWORK" | "COMPLETE_REJECT" | "REPLACE" | ...
  actor: StaffIdentity;
  reason?: string | null;
  relatedRequestId?: string | null;
  relatedPieceId?: string | null;
  source?: "MANUAL" | "SYSTEM";
  snapshot?: Partial<{ pieceStage: string; totalLabourMinutes: number; totalLabourCost: number }>;
  /** True when this movement was an emergency PM/Admin/Owner override of a
   *  transition that now has a dedicated specialist function (Dispatch/
   *  Tailor/Store). See pieces.ts SPECIALIST_OWNED_TRANSITIONS. */
  isOverride?: boolean;
};

/**
 * Record ONE movement-history entry. Configurable to run inside an existing
 * transaction (tx) for atomicity with the state change, or standalone.
 * Returns the generated doc id.
 */
export async function recordMovement(input: MovementInput, tx?: admin.firestore.Transaction): Promise<string> {
  const rec: Record<string, unknown> = {
    id: "",
    pieceId: input.pieceId,
    fromStage: input.fromStage,
    toStage: input.toStage,
    direction: input.direction,
    action: input.action,
    at: new Date().toISOString(),
    actorUid: input.actor.uid,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    source: input.source ?? "MANUAL",
    reason: input.reason ?? null,
    relatedRequestId: input.relatedRequestId ?? null,
    relatedPieceId: input.relatedPieceId ?? null,
    revertsMvId: null,
    snapshot: input.snapshot ?? null,
    isOverride: input.isOverride ?? false,
  };

  const id = crypto.randomUUID();
  rec.id = id;

  if (tx) {
    tx.set(db.collection("pieceMovementHistory").doc(id), rec);
  } else {
    await db.doc(`pieceMovementHistory/${id}`).set(rec);
  }
  return id;
}