/* eslint-disable */
/**
 * LUXARDO FASHION — V1 PRODUCTION SYSTEM
 * Cloud Functions for master-data CRUD (staff + karigar) and atomic ID generation.
 *
 * All functions:
 *  - require Firebase Auth (request.auth.uid)
 *  - verify admin role from staff/{uid} (Loom identity), with a
 *    customers/{uid} fallback for the legacy B2C admin identity
 *  - run inside Firestore transactions for atomicity
 *  - append audit logs (never delete)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {
  CANONICAL_STAFF_ROLES,
  LEGACY_STAFF_ROLE_MAP,
  normalizeStaffRole,
  CanonicalStaffRole,
  requireStaff,
} from "./staffAuth";

const db = admin.firestore();

/* ───────────────────── HELPER: verify admin ─────────────────────── */

const ADMIN_STAFF_ROLES = ["owner", "admin", "super_admin"];

async function requireAdmin(uid: string): Promise<{ name: string; role: string }> {
  // Prefer staff/{uid} (Loom identity doc) with an owner/admin/super_admin role.
  // This enables bootstrap on a fresh Loom project (luxardo-flow) where the B2C
  // customers/{uid} doc does not exist. staff/{uid} is itself admin-managed, so no
  // unauthorized escalation is introduced.
  const staffSnap = await db.doc(`staff/${uid}`).get();
  if (staffSnap.exists) {
    const s = staffSnap.data()!;
    // Fail closed: a non-canonical / legacy role string (e.g. "grade") is
    // never treated as admin. Legacy roles are repaired only by the
    // sanctioned staffBackfillCustomerDocs job.
    const srole = String(s.role || "").toLowerCase().trim();
    if (ADMIN_STAFF_ROLES.includes(srole) && s.active !== false) {
      return { name: String(s.displayName || "Admin"), role: srole };
    }
  }
  // Fallback: B2C customers/{uid} admin identity (compat with existing master admin).
  const snap = await db.doc(`customers/${uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "User doc not found.");
  const d = snap.data()!;
  const role = (d.role || "").toLowerCase();
  if (role !== "admin" && role !== "super_admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
  return { name: d.firstName ? `${d.firstName} ${d.lastName || ""}`.trim() : d.name || "Admin", role };
}

/* ──────────────────── HELPER: audit log ─────────────────────────── */

function writeAudit(
  action: string,
  entity: string,
  entityId: string,
  actorUid: string,
  actorName: string,
  actorRole: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reason?: string,
) {
  return db.collection("auditLogs").add({
    id: "", // set below after add()
    ts: new Date().toISOString(),
    actorUid,
    actorName,
    actorRole,
    action,
    entity,
    entityId,
    before,
    after,
    reason: reason || null,
    ip: null,
  }).then((ref) => { ref.update({ id: ref.id }); });
}

/* ═══════════════════════════════════════════════════════════════════
 * nextId — atomic ID generation via Firestore transaction.
 *
 * Input : { domain: string }
 *         domain is one of: "design", "sampleDesign", "samplePiece",
 *         "piece", "karigar", "pr", "so", "storeOutIssue", "guardQc",
 *         "tailorSession", "labourSession"
 * Output: { id: string }
 *
 * IdCounter doc: idCounters/{domain}  { domain, prefix, next, updatedAt }
 *
 * ID families (finalized):
 *   Catalogue Design  KL-XXXX
 *   Sample Design     SAMPLE-DESIGN-XXXX
 *   Sample Piece      SAMPLE-PIECE-XXXX
 *   Physical Piece    PIECE-XXXX
 *   Production Request PR-XXXX
 *   Karigar           K-XXXX
 *   Store-Out         SO-XXXX
 *   Store-Out Issue   SOI-XXXX
 *   Guard QC Record   QC-XXXX
 *   Work Session      LS-XXXX
 *
 * IDs are NEVER reused after deletion/closure (monotonic counter).
 * ═══════════════════════════════════════════════════════════════════ */

const ID_PREFIXES: Record<string, string> = {
  design:           "KL-",           // KL-0001, KL-0002, ...
  sampleDesign:     "SAMPLE-DESIGN-", // SAMPLE-DESIGN-0001, ...
  samplePiece:      "SAMPLE-PIECE-",  // SAMPLE-PIECE-0001, ...
  piece:            "PIECE-",         // PIECE-0001, PIECE-0002, ... (global sequential)
  karigar:          "K-",
  pr:               "PR-",
  so:               "SO-",
  storeOutIssue:    "SOI-",
  guardQc:          "QC-",
  tailorSession:    "TS-",
  labourSession:    "LS-",
  tailorRequest:    "TR-",
};

/**
 * generateId — shared atomic ID generator (used by nextId and Phase 2 CFs).
 * Transaction-safe: increments idCounters/{domain} and returns the new ID.
 */
export async function generateId(domain: string): Promise<string> {
  const counterRef = db.doc(`idCounters/${domain}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let next: number;
    let prefix: string;
    if (snap.exists) {
      const d = snap.data()!;
      next = (d.next || 0) + 1;
      prefix = d.prefix;
      tx.update(counterRef, { next, updatedAt: new Date().toISOString() });
    } else {
      next = 1;
      prefix = ID_PREFIXES[domain];
      tx.set(counterRef, { domain, prefix, next, updatedAt: new Date().toISOString() });
    }
    const padded = String(next).padStart(4, "0");
    return `${prefix}${padded}`;
  });
}

export const nextId = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  // CRIT-1 — a generic multi-domain ID utility, not an admin-exclusive
  // management action (unlike staffCreate/karigarCreate below), so any
  // canonical production staff identity may call it — never an unauthorized
  // B2C customer or anonymous session.
  await requireStaff(request.auth.uid);
  const { domain } = request.data as { domain?: string };
  if (!domain || !ID_PREFIXES[domain]) {
    throw new HttpsError("invalid-argument", `Invalid domain. Allowed: ${Object.keys(ID_PREFIXES).join(", ")}`);
  }

  const newId = await generateId(domain);

  return { id: newId };
});

/* ═══════════════════════════════════════════════════════════════════
 * STAFF IDENTITY MODEL
 *
 * staff/{uid} is the AUTHORITATIVE Loom production identity (role, name,
 * active flag). It is the only doc that gates Firestore rules and every
 * server-side role check (see staffAuth.ts).
 *
 * customers/{uid} is maintained as a COMPATIBILITY MIRROR because the
 * shared B2C AuthContext + the role login pages resolve a user's role
 * from customers/{uid} first. Keeping a mirror doc means an
 * app-provisioned staff member can actually sign in. The mirror never
 * grants B2C privilege: B2C isAdmin() only accepts role ∈
 * {admin, super_admin}, which are also legitimate Loom roles.
 * ═══════════════════════════════════════════════════════════════════ */

const VALID_STAFF_ROLES = new Set<string>(CANONICAL_STAFF_ROLES as readonly string[]);

/** Shape of the customers/{uid} compatibility mirror for a staff member. */
function staffCustomerMirror(
  uid: string,
  displayName: string,
  email: string,
  role: string,
  now: string,
): Record<string, unknown> {
  return {
    id: uid,
    name: displayName,
    email,
    role,               // same canonical staff role — single source of truth
    isPrimeMember: false,
    staffLinked: true,  // marker: this customer doc mirrors staff/{uid}
    updatedAt: now,
  };
}

/**
 * provisionStaffAccount — shared staff-account provisioning used by both
 * staffCreate (direct Admin creation) and approveTailorRequest (New Tailor
 * Request auto-provisioning on approval). Creates the Firebase Auth user,
 * then staff/{uid} + customers/{uid} in one atomic batch. Never generates a
 * mechanism-specific duplicate of this logic elsewhere — this IS the single
 * staff-creation code path.
 *
 * The generated temporary password is NEVER returned or persisted anywhere
 * (not in Firestore, not in the function's response) — only the resulting
 * uid is handed back. Password delivery/reset is a separate, existing
 * concern (see the admin password-reset tooling), out of scope here.
 *
 * On any failure after the Auth user is created, the Auth user is rolled
 * back so no orphan account is left behind.
 */
export async function provisionStaffAccount(params: {
  displayName: string;
  email: string;
  role: CanonicalStaffRole;
  createdByUid: string;
  password?: string;
}): Promise<{ uid: string; staffDoc: Record<string, unknown> }> {
  const { displayName, email, role, createdByUid, password } = params;

  let authUid: string;
  try {
    const created = await admin.auth().createUser({
      email,
      displayName,
      password: password || crypto.randomBytes(10).toString("hex"),
      emailVerified: false,
    });
    authUid = created.uid;
  } catch (err: any) {
    console.error("provisionStaffAccount: Auth user creation failed", err);
    throw new HttpsError("already-exists", err?.message || "Could not create Auth user (email may already be registered).");
  }

  const now = new Date().toISOString();
  const staffDoc = {
    uid: authUid,
    displayName,
    email,
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
  };
  const customerMirror = {
    ...staffCustomerMirror(authUid, displayName, email, role, now),
    createdAt: now,
    createdBy: createdByUid,
  };

  try {
    const batch = db.batch();
    batch.set(db.doc(`staff/${authUid}`), staffDoc);
    batch.set(db.doc(`customers/${authUid}`), customerMirror, { merge: true });
    await batch.commit();
  } catch (err) {
    // Clean up the Auth user if the doc write fails, to avoid orphan accounts.
    try {
      await admin.auth().deleteUser(authUid);
    } catch (cleanupErr: any) {
      // MED-3 — the compensating delete ALSO failed: without a record here,
      // the orphaned Auth account (no staff/customers doc) is invisible to
      // every dashboard and audit trail, and the only future symptom is an
      // unrelated-looking "already-exists" error the next time this email
      // is provisioned. Best-effort: a failure writing this record must
      // never mask the original batch-commit error thrown below.
      console.error("provisionStaffAccount: orphan cleanup failed", { authUid, email, cleanupErr });
      await writeAudit(
        "STAFF_PROVISION_ORPHAN", "staff", authUid, createdByUid, "system", "system",
        null, { uid: authUid, email, role },
        `Auth user created but staff/customers write failed, and the compensating Auth user delete also failed: ${String(cleanupErr?.message || cleanupErr)}`
      ).catch(() => {});
    }
    throw err;
  }

  return { uid: authUid, staffDoc };
}

/* ═══════════════════════════════════════════════════════════════════
 * staffCreate — create a production staff member.
 *
 * Input : { displayName: string, email: string, role: StaffRole, password?: string }
 * Output: { ok: true, uid: string }
 *
 * Creates:
 *  - a Firebase Auth user (so the staff member can log in)
 *  - staff/{uid}      — authoritative Loom identity
 *  - customers/{uid}  — compatibility mirror (see STAFF IDENTITY MODEL)
 * The two Firestore docs are written in one atomic batch, via the shared
 * provisionStaffAccount() helper (also used by approveTailorRequest).
 * ═══════════════════════════════════════════════════════════════════ */

export const staffCreate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { displayName, email, role, password } = request.data as {
    displayName?: string; email?: string; role?: string; password?: string;
  };

  if (!displayName || !email || !role) {
    throw new HttpsError("invalid-argument", "displayName, email, role are required.");
  }
  const canonicalRole = normalizeStaffRole(role);
  if (!canonicalRole || !VALID_STAFF_ROLES.has(canonicalRole)) {
    throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
  }

  const { uid: authUid, staffDoc } = await provisionStaffAccount({
    displayName, email, role: canonicalRole, createdByUid: request.auth.uid, password,
  });

  await writeAudit("STAFF_CREATE", "staff", authUid, request.auth.uid, actor.name, actor.role, null, staffDoc);

  return { ok: true, uid: authUid };
});

/* ═══════════════════════════════════════════════════════════════════
 * staffUpdate — update an existing staff member's fields.
 *
 * Input : { uid: string, updates: { displayName?, email?, role?, active? } }
 * Output: { ok: true }
 *
 * Only allows displayName, email, role, active to be changed.
 * Role change is audited separately as STAFF_ROLE_CHANGE.
 * ═══════════════════════════════════════════════════════════════════ */

export const staffUpdate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { uid, updates } = request.data as { uid?: string; updates?: Record<string, unknown> };
  if (!uid || !updates || typeof updates !== "object") {
    throw new HttpsError("invalid-argument", "uid and updates object required.");
  }

  const ref = db.doc(`staff/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", `Staff doc ${uid} not found.`);
  const before = snap.data()!;

  // Whitelist allowed fields
  const allowed = ["displayName", "email", "role", "active"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) patch[k] = updates[k];
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update.");
  }
  if (patch.role !== undefined) {
    const canonicalRole = normalizeStaffRole(patch.role);
    if (!canonicalRole || !VALID_STAFF_ROLES.has(canonicalRole)) {
      throw new HttpsError("invalid-argument", `Invalid role: ${patch.role}`);
    }
    patch.role = canonicalRole;
  }

  const now = new Date().toISOString();
  patch.updatedAt = now;

  // Keep the customers/{uid} compatibility mirror in step with the
  // authoritative staff/{uid} doc (name / email / role). Written atomically.
  const mirror: Record<string, unknown> = { updatedAt: now, staffLinked: true };
  if (patch.displayName !== undefined) mirror.name = patch.displayName;
  if (patch.email !== undefined) mirror.email = patch.email;
  if (patch.role !== undefined) mirror.role = patch.role;

  // ref existence already asserted above, so set/merge == update here and
  // keeps both writes in one atomic batch.
  const batch = db.batch();
  batch.set(ref, patch, { merge: true });
  batch.set(db.doc(`customers/${uid}`), mirror, { merge: true });
  await batch.commit();

  // Audit: role change gets its own action
  if (patch.role && patch.role !== before.role) {
    await writeAudit("STAFF_ROLE_CHANGE", "staff", uid, request.auth.uid, actor.name, actor.role,
      { role: before.role }, { role: patch.role });
  } else {
    await writeAudit("STAFF_UPDATE", "staff", uid, request.auth.uid, actor.name, actor.role,
      { displayName: before.displayName, email: before.email, active: before.active },
      { displayName: patch.displayName ?? before.displayName, email: patch.email ?? before.email, active: patch.active ?? before.active });
  }

  return { ok: true };
});

/* ═══════════════════════════════════════════════════════════════════
 * staffBackfillCustomerDocs — one-shot repair for pre-existing Loom
 * staff identities created before the customers/{uid} mirror existed.
 *
 * Input : {
 *   dryRun?: boolean        // default TRUE — report only, write nothing
 *   fixLegacyRoles?: boolean // default FALSE — also rewrite known legacy
 *                            //   role typos (LEGACY_STAFF_ROLE_MAP,
 *                            //   e.g. "grade" -> "guard") on staff/{uid}
 * }
 * Output: { ok: true, report: {...} }
 *
 * Idempotent: re-running against an already-repaired collection is a
 * no-op (every entry reports as "skipped"). Admin-only. Never deletes.
 * ═══════════════════════════════════════════════════════════════════ */

export const staffBackfillCustomerDocs = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { dryRun = true, fixLegacyRoles = false } = (request.data ?? {}) as {
    dryRun?: boolean; fixLegacyRoles?: boolean;
  };

  const staffSnap = await db.collection("staff").get();
  if (staffSnap.size > 450) {
    // One atomic batch caps at 500 writes (≤2 per staff doc). The staff
    // collection is tiny by design; refuse rather than partially apply.
    throw new HttpsError("failed-precondition", `staff collection too large for a single batch (${staffSnap.size}). Paginate this job before running.`);
  }

  const now = new Date().toISOString();
  const report = {
    dryRun: !!dryRun,
    fixLegacyRoles: !!fixLegacyRoles,
    scanned: 0,
    customerDocsCreated: 0,
    customerDocsUpdated: 0,
    legacyRolesNormalized: 0,
    skipped: 0,
    unknownRoles: [] as Array<{ uid: string; role: string }>,
  };

  const batch = db.batch();
  let writes = 0;

  for (const doc of staffSnap.docs) {
    report.scanned++;
    const s = doc.data();
    const uid = doc.id;
    const rawRole = String(s.role || "").toLowerCase().trim();

    let effectiveRole = normalizeStaffRole(rawRole);

    // Optionally repair a known legacy/typo role on the authoritative doc.
    if (!effectiveRole && fixLegacyRoles && LEGACY_STAFF_ROLE_MAP[rawRole]) {
      effectiveRole = LEGACY_STAFF_ROLE_MAP[rawRole];
      report.legacyRolesNormalized++;
      if (!dryRun) {
        batch.update(doc.ref, {
          role: effectiveRole,
          roleLegacyBackfilledFrom: rawRole,
          updatedAt: now,
        });
        writes++;
      }
    }

    if (!effectiveRole) {
      // Unknown / unrepairable role — leave the data untouched, just report.
      report.unknownRoles.push({ uid, role: rawRole });
      report.skipped++;
      continue;
    }

    const custRef = db.doc(`customers/${uid}`);
    const cust = await custRef.get();
    const desiredName = String(s.displayName || s.name || "Staff");
    const desiredEmail = String(s.email || "");

    if (!cust.exists) {
      report.customerDocsCreated++;
      if (!dryRun) {
        batch.set(custRef, {
          ...staffCustomerMirror(uid, desiredName, desiredEmail, effectiveRole, now),
          createdAt: now,
          createdBy: request.auth.uid,
        }, { merge: true });
        writes++;
      }
    } else {
      const c = cust.data() || {};
      const drift =
        String(c.role || "").toLowerCase() !== effectiveRole ||
        String(c.name || "") !== desiredName ||
        String(c.email || "") !== desiredEmail;
      if (drift) {
        report.customerDocsUpdated++;
        if (!dryRun) {
          batch.set(custRef, staffCustomerMirror(uid, desiredName, desiredEmail, effectiveRole, now), { merge: true });
          writes++;
        }
      } else {
        report.skipped++;
      }
    }
  }

  if (!dryRun && writes > 0) {
    await batch.commit();
    await writeAudit("STAFF_BACKFILL", "staff", "ALL", request.auth.uid, actor.name, actor.role, null, report);
  }

  return { ok: true, report };
});

/* ═══════════════════════════════════════════════════════════════════
 * karigarCreate — add a new Karigar to the registry.
 *
 * Input : { name, mobile, skillTags, hourlyRate, badgeId?, aadhaar?, notes? }
 * Output: { id: string }
 *
 * ID is generated via nextId (K-0001 format). Atomic transaction.
 * ═══════════════════════════════════════════════════════════════════ */

export const karigarCreate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { name, mobile, skillTags, hourlyRate, badgeId, aadhaar, notes } = request.data as {
    name?: string; mobile?: string; skillTags?: string[];
    hourlyRate?: number; badgeId?: string; aadhaar?: string; notes?: string;
  };

  if (!name || !mobile || !skillTags || hourlyRate === undefined) {
    throw new HttpsError("invalid-argument", "name, mobile, skillTags, hourlyRate are required.");
  }
  if (typeof hourlyRate !== "number" || hourlyRate < 0) {
    throw new HttpsError("invalid-argument", "hourlyRate must be a non-negative number.");
  }

  // Atomic ID generation (K-0001, K-0002, ...)
  const counterRef = db.doc("idCounters/karigar");
  const karigarId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let next: number;
    if (snap.exists) {
      next = (snap.data()!.next || 0) + 1;
      tx.update(counterRef, { next, updatedAt: new Date().toISOString() });
    } else {
      next = 1;
      tx.set(counterRef, { domain: "karigar", prefix: "K-", next, updatedAt: new Date().toISOString() });
    }
    return `K-${String(next).padStart(4, "0")}`;
  });

  const now = new Date().toISOString();
  const karigarDoc = {
    id: karigarId,
    name,
    mobile,
    skillTags: Array.isArray(skillTags) ? skillTags : [],
    hourlyRate,
    active: true,
    badgeId: badgeId || null,
    aadhaar: aadhaar || null,
    notes: notes || "",
    createdBy: request.auth.uid,
    createdByName: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  await db.doc(`karigars/${karigarId}`).set(karigarDoc);
  await writeAudit("KARIGAR_CREATE", "karigars", karigarId, request.auth.uid, actor.name, actor.role, null, karigarDoc);

  return { id: karigarId };
});

/* ═══════════════════════════════════════════════════════════════════
 * karigarUpdate — update an existing Karigar's fields.
 *
 * Input : { id: string, updates: { name?, mobile?, skillTags?, hourlyRate?,
 *          badgeId?, aadhaar?, notes?, active? } }
 * Output: { ok: true }
 *
 * hourlyRate change is always audited. active=false = deactivate (never delete).
 * ═══════════════════════════════════════════════════════════════════ */

export const karigarUpdate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { id, updates } = request.data as { id?: string; updates?: Record<string, unknown> };
  if (!id || !updates || typeof updates !== "object") {
    throw new HttpsError("invalid-argument", "id and updates object required.");
  }

  const ref = db.doc(`karigars/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", `Karigar ${id} not found.`);
  const before = snap.data()!;

  const allowed = ["name", "mobile", "skillTags", "hourlyRate", "badgeId", "aadhaar", "notes", "active"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) patch[k] = updates[k];
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update.");
  }
  if (patch.hourlyRate !== undefined && (typeof patch.hourlyRate !== "number" || patch.hourlyRate < 0)) {
    throw new HttpsError("invalid-argument", "hourlyRate must be a non-negative number.");
  }

  patch.updatedAt = new Date().toISOString();
  await ref.update(patch);

  // Audit the update
  const auditAfter: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (k !== "updatedAt") auditAfter[k] = patch[k];
  }
  await writeAudit("KARIGAR_UPDATE", "karigars", id, request.auth.uid, actor.name, actor.role,
    { name: before.name, mobile: before.mobile, hourlyRate: before.hourlyRate, active: before.active },
    auditAfter);

  // Deactivation audit (separate action for the flag)
  if (patch.active === false && before.active === true) {
    await writeAudit("KARIGAR_DEACTIVATE", "karigars", id, request.auth.uid, actor.name, actor.role,
      { active: true }, { active: false });
  }

  return { ok: true };
});
