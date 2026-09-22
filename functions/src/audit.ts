import * as admin from "firebase-admin";

const db = admin.firestore();

export interface AuditActor {
  uid: string;
  name: string;
  role: string;
}

/** Build an append-only audit log record (id filled by caller context). */
export function auditDoc(
  action: string,
  entity: string,
  entityId: string,
  actor: AuditActor,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reason?: string
) {
  return {
    id: "",
    ts: new Date().toISOString(),
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entity,
    entityId,
    before,
    after,
    reason: reason ?? null,
    ip: null,
  };
}

/** Append an audit log record outside a transaction (add then backfill id). */
export async function writeAudit(
  action: string,
  entity: string,
  entityId: string,
  actor: AuditActor,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reason?: string
) {
  const data = auditDoc(action, entity, entityId, actor, before, after, reason);
  const ref = await db.collection("auditLogs").add(data);
  await ref.update({ id: ref.id });
}