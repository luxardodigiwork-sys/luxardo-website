/**
 * LUXARDO FASHION — V1 PRODUCTION SYSTEM
 * ============================================================================
 * Type definitions for the production-management workflow.
 *
 * This module is the FOUNDATION / DATA MODEL for the production system.
 * It is purely additive: it does not modify any existing type in `../types`.
 *
 * Design notes (mirrors the finalized workflow):
 *  - Catalogue Design (KL-2001): a design pattern on fabric in the collection.
 *  - Sample Design (SAMPLE-10021): a small fabric piece showing a portion of a
 *    design, used by salesmen. Independent entity; optionally linked to a
 *    Catalogue Design via `catalogDesignId`.
 *  - Sample Piece (SAMPLE-10021-P1): one complete garment made for catalogue
 *    approval. Normally only one per design.
 *  - Physical Piece ({designId}-NN): the atomic unit of production.
 *  - Karigar: NOT a login user — a registry entity worked on by the PM.
 */

/* ────────────────────────────── ENUMS ────────────────────────────── */

export type StaffRole =
  | "owner"
  | "admin"
  | "designer"
  | "pm"
  | "dispatch"
  | "guard"
  | "tailor"
  | "store"
  | "accounts"
  | "analysis";

export type DesignStatus = "DRAFT" | "APPROVED" | "FROZEN";
export type SampleDesignStatus = "DRAFT" | "APPROVED" | "FROZEN";
export type SamplePieceStatus = "IN_WORK" | "COMPLETE";
export type PieceKind = "PHYSICAL" | "SAMPLE";
export type PieceStatus = "active" | "closed" | "replaced";

/** Physical piece lifecycle stage (atomic tracking unit). */
export type PieceStage =
  | "OPEN"
  | "IN_WORK"
  | "QC_PENDING"
  | "REWORK"
  | "QC_PASS"
  | "DISPATCH_READY"
  | "TAILOR_ASSIGNED"
  | "STITCHING"
  | "STITCH_COMPLETE"
  | "STORE"
  | "STORE_OUT"
  | "REJECTED";

export type PRStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "REJECTED_BY_OWNER"
  | "CANCELLED";

export type UrgencyLevel = "HIGH" | "MEDIUM" | "LOW";

export type StoreOutReason =
  | "DAMAGE_IN_TRANSIT"
  | "SIZE_MISMATCH"
  | "QUALITY_REJECT"
  | "BILLING_DISPUTE"
  | "OTHER";

export type MovementDirection = "FORWARD" | "REVERSE";
export type MovementSource = "MANUAL" | "SYSTEM";

/* ─────────────────────── CATALOGUE DESIGN ─────────────────────── */

export interface DesignDoc {
  id: string; // "KL-2001"
  designType: "catalogue";
  name: string;
  description: string;
  image: string; // Primary image URL
  images: string[]; // Additional images
  status: DesignStatus; // DRAFT | APPROVED | FROZEN
  currentVersion: number;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  /** Per-design piece sequence counter (atomic, used to derive KL-2001-NN). */
  nextPieceSeq: number;
}

/** Immutable snapshot written on approval (v1) and freeze (v2+). */
export interface DesignVersionDoc {
  id: string; // "v1", "v2"
  versionNo: number;
  snapshot: DesignDoc;
  frozen: boolean;
  approvedBy: string;
  approvedByName: string;
  approvedAt: string;
  note: string;
  createdAt: string;
}

/* ───────────────────────── SAMPLE DESIGN ───────────────────────── */

export interface SampleDesignDoc {
  id: string; // "SAMPLE-10021"
  catalogDesignId: string | null; // "KL-2001" if related to a catalogue design
  name: string;
  description: string;
  image: string;
  images: string[];
  status: SampleDesignStatus;
  currentVersion: number;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleDesignVersionDoc {
  id: string;
  versionNo: number;
  snapshot: SampleDesignDoc;
  frozen: boolean;
  approvedBy: string;
  approvedByName: string;
  approvedAt: string;
  note: string;
  createdAt: string;
}

/* ────────────────────────── SAMPLE PIECE ───────────────────────── */

export interface SamplePieceDoc {
  id: string; // "SAMPLE-10021-P1"
  designId: string; // Catalogue design this sample is for: "KL-2001"
  sampleDesignId: string | null; // Swatch it is based on, if any
  status: SamplePieceStatus; // IN_WORK | COMPLETE
  notes: string;
  image: string; // Photo of completed garment (on COMPLETE)
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────── PRODUCTION REQUEST ────────────────────── */

export interface PRLine {
  designId: string;
  designName: string;
  quantity: number; // Must be > 0 to submit
}

export interface ProductionRequestDoc {
  id: string; // "PR-0001"
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string; // "dispatch" | "admin" | "owner"
  createdAt: string;
  updatedAt: string;
  lines: PRLine[];
  /** Frozen copy of `lines` written by the server at Owner approval. Immutable. */
  originalQuantity: PRLine[];
  status: PRStatus;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  totalPieceCount: number;
  urgency: UrgencyLevel;
  requiredDate: string; // ISO date — production deadline
  cancelledBy: string | null;
  cancelledAt: string | null;
}

/** Post-approval edit history (urgency / requiredDate only). */
export interface PRAuditDoc {
  id: string;
  field: "urgency" | "requiredDate";
  oldValue: string | number;
  newValue: string | number;
  editedBy: string;
  editedByName: string;
  editedByRole: string;
  at: string;
}

/* ────────────────────────── PHYSICAL PIECE ─────────────────────── */

export interface PieceDoc {
  id: string; // "KL-2001-01" — immutable
  designId: string;
  prId: string | null;
  kind: PieceKind; // "PHYSICAL" | "SAMPLE"
  stage: PieceStage;
  status: PieceStatus; // active | closed | replaced
  assignedKarigars: string[];
  lastKarigarIds: string[];
  totalLabourMinutes: number;
  totalLabourCost: number;
  firstWorkAt: string | null;
  lastWorkAt: string | null;
  qcVerdict: "PASS" | "REWORK" | "COMPLETE_REJECT" | null;
  rejectionReason: string | null;
  reworkCount: number;
  lastGuardQcId: string | null;
  tailorSessionId: string | null;
  tailorStartAt: string | null;
  tailorEndAt: string | null;
  storeInAt: string | null;
  storeOutAt: string | null;
  storeOutId: string | null;
  billNumber: string | null;
  replacesPieceId: string | null;
  replacedByPieceId: string | null;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/** Every stage transition — forward or reverse — appends one record. Never deleted. */
export interface MovementDoc {
  id: string;
  pieceId: string;
  fromStage: PieceStage;
  toStage: PieceStage;
  direction: MovementDirection;
  at: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  source: MovementSource;
  reason: string | null;
  revertsMvId: string | null;
  snapshot: {
    pieceStage: PieceStage;
    totalLabourMinutes: number;
    totalLabourCost: number;
  };
}

/* ──────────────────────────── KARIGAR ──────────────────────────── */

export interface KarigarDoc {
  id: string; // "K-001"
  name: string;
  mobile: string;
  skillTags: string[];
  hourlyRate: number; // ₹/hour
  active: boolean;
  badgeId: string | null;
  aadhaar?: string; // optional master-data field (Admin)
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── LABOUR SESSION ──────────────────────── */

export interface LabourSessionDoc {
  id: string;
  pieceId: string;
  karigarId: string;
  karigarName: string;
  designId: string;
  prId: string | null;
  startedAt: string;
  endedAt: string | null; // null while in progress
  minutes: number; // 0 while in progress
  hourlyRate: number; // SNAPSHOT of karigar rate at session start
  labourCost: number; // (minutes / 60) × hourlyRate, computed once on stop
  type: "FIRST" | "REWORK";
  reworkOf: string | null;
  startedBy: string;
  startedByName: string;
  stoppedBy: string | null;
  stoppedByName: string | null;
  note: string;
}

/* ─────────────────────────── GUARD QC ──────────────────────────── */

export interface QCAction {
  label: string;
  ok: boolean;
  note: string;
}

export interface GuardQCRecordDoc {
  id: string;
  pieceId: string;
  verdict: "PASS" | "REWORK" | "COMPLETE_REJECT";
  reason: string; // MANDATORY for REWORK / COMPLETE_REJECT
  checkedActions: QCAction[];
  guardUid: string;
  guardName: string;
  at: string;
  photos: string[];
}

/* ────────────────────────── TAILOR SESSION ─────────────────────── */

export interface TailorSessionDoc {
  id: string;
  pieceId: string;
  tailorUid: string;
  tailorName: string;
  startedAt: string;
  completedAt: string | null; // null while in progress
  garmentImageUrl: string | null; // COMPULSORY on completion
  garmentImagePath: string | null;
  note: string;
}

/* ─────────────────────────── STORE / SO ────────────────────────── */

export interface StoreOutDoc {
  id: string; // "SO-0001"
  storeOutNumber: string;
  pieceIds: string[];
  billNumber: string; // MANDATORY
  party: string | null;
  totalPieces: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface StoreOutIssueDoc {
  id: string;
  storeOutId: string;
  pieceId: string;
  reason: StoreOutReason;
  otherText: string | null; // required when reason === "OTHER"
  reportedBy: string;
  reportedByName: string;
  at: string;
}

/* ─────────────────────── REPLACEMENT LINK ──────────────────────── */

export interface ReplacementLinkDoc {
  id: string;
  rejectedPieceId: string;
  replacementPieceId: string;
  reason: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

/* ──────────────────────────── STAFF ────────────────────────────── */

export interface StaffDoc {
  uid: string; // Firebase Auth uid
  displayName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/* ────────────────────────── AUDIT LOG ──────────────────────────── */

export type AuditAction =
  | "DESIGN_CREATE"
  | "DESIGN_UPDATE"
  | "DESIGN_APPROVE"
  | "DESIGN_FREEZE"
  | "SAMPLE_DESIGN_CREATE"
  | "SAMPLE_DESIGN_UPDATE"
  | "SAMPLE_DESIGN_APPROVE"
  | "SAMPLE_DESIGN_FREEZE"
  | "SAMPLE_PIECE_CREATE"
  | "SAMPLE_PIECE_COMPLETE"
  | "PR_CREATE"
  | "PR_SUBMIT"
  | "PR_APPROVE"
  | "PR_REJECT"
  | "PR_CANCEL"
  | "PR_EDIT_URGENCY"
  | "PR_EDIT_REQUIREDDATE"
  | "PIECE_CREATE"
  | "PIECE_STAGE_MOVE"
  | "PIECE_REVERSE_MOVE"
  | "PIECE_ASSIGN_KARIGAR"
  | "LABOUR_START"
  | "LABOUR_STOP"
  | "GUARD_QC_PASS"
  | "GUARD_QC_REWORK"
  | "GUARD_QC_REJECT"
  | "REPLACEMENT_CREATE"
  | "TAILOR_START"
  | "TAILOR_COMPLETE"
  | "STORE_OUT"
  | "STORE_OUT_ISSUE"
  | "KARIGAR_CREATE"
  | "KARIGAR_UPDATE"
  | "KARIGAR_DEACTIVATE"
  | "STAFF_CREATE"
  | "STAFF_UPDATE"
  | "STAFF_ROLE_CHANGE"
  | "REPORT_EXPORT";

export interface AuditLogDoc {
  id: string; // UUID (crypto.randomUUID)
  ts: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
}

/* ────────────────────────── ID COUNTER ─────────────────────────── */

export interface IdCounterDoc {
  domain: string;
  prefix: string;
  next: number;
  updatedAt: string;
}
