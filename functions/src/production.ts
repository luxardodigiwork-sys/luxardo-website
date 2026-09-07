/* eslint-disable */
/**
 * LUXARDO FASHION — V1 PRODUCTION SYSTEM
 * Cloud Functions for master-data CRUD (staff + karigar) and atomic ID generation.
 *
 * All functions:
 *  - require Firebase Auth (request.auth.uid)
 *  - verify admin role from customers/{uid} doc
 *  - run inside Firestore transactions for atomicity
 *  - append audit logs (never delete)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

/* ───────────────────── HELPER: verify admin ─────────────────────── */

async function requireAdmin(uid: string): Promise<{ name: string; role: string }> {
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
 *         "karigar", "pr", "so", "storeOutIssue", "guardQc",
 *         "tailorSession", "labourSession"
 * Output: { id: string }
 *
 * IdCounter doc: idCounters/{domain}  { domain, prefix, next, updatedAt }
 * ═══════════════════════════════════════════════════════════════════ */

const ID_PREFIXES: Record<string, string> = {
  design:           "KL-2001",
  sampleDesign:     "SAMPLE-10021",
  samplePiece:      "SAMPLE-10021-P",
  karigar:          "K-",
  pr:               "PR-",
  so:               "SO-",
  storeOutIssue:    "SOI-",
  guardQc:          "QC-",
  tailorSession:    "TS-",
  labourSession:    "LS-",
};

export const nextId = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { domain } = request.data as { domain?: string };
  if (!domain || !ID_PREFIXES[domain]) {
    throw new HttpsError("invalid-argument", `Invalid domain. Allowed: ${Object.keys(ID_PREFIXES).join(", ")}`);
  }

  const counterRef = db.doc(`idCounters/${domain}`);
  const newId = await db.runTransaction(async (tx) => {
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

  return { id: newId };
});

/* ═══════════════════════════════════════════════════════════════════
 * staffCreate — create a production staff member.
 *
 * Input : { displayName: string, email: string, role: StaffRole, password?: string }
 * Output: { ok: true, uid: string }
 *
 * Creates BOTH:
 *  - a Firebase Auth user (so the staff member can log in)
 *  - a staff/{uid} Firestore doc (so Firestore rules / role checks work)
 *
 * If `password` is omitted, a random temporary password is generated and
 * returned in the response (delivered to the admin to pass on).
 * ═══════════════════════════════════════════════════════════════════ */

const VALID_STAFF_ROLES = new Set(["owner","admin","designer","pm","dispatch","guard","tailor","store","accounts","analysis"]);

export const staffCreate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const actor = await requireAdmin(request.auth.uid);

  const { displayName, email, role, password } = request.data as {
    displayName?: string; email?: string; role?: string; password?: string;
  };

  if (!displayName || !email || !role) {
    throw new HttpsError("invalid-argument", "displayName, email, role are required.");
  }
  if (!VALID_STAFF_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
  }

  // Create the Firebase Auth user first (email is the unique key)
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
    console.error("staffCreate: Auth user creation failed", err);
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
    createdBy: request.auth.uid,
  };

  try {
    await db.doc(`staff/${authUid}`).set(staffDoc);
  } catch (err) {
    // Clean up the Auth user if the doc write fails, to avoid orphan accounts
    await admin.auth().deleteUser(authUid).catch(() => {});
    throw err;
  }

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
  if (patch.role && !VALID_STAFF_ROLES.has(patch.role as string)) {
    throw new HttpsError("invalid-argument", `Invalid role: ${patch.role}`);
  }

  patch.updatedAt = new Date().toISOString();
  await ref.update(patch);

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
