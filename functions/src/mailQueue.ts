/** Delivery of one queued `mail/{id}` document, with bounded retries for transient provider errors. */
export const MAX_MAIL_ATTEMPTS = 4;

export class RetryMailError extends Error {}

type Sender = (mailId: string, doc: Record<string, unknown>) => Promise<{ ok: true; id: string } | { ok: false; error: string; retryable?: boolean }>;

/**
 * Re-reads the document (a retried trigger event carries the ORIGINAL snapshot), skips already-handled mails and records
 * SUCCESS / RETRY / ERROR on the document. Throws RetryMailError only for transient failures below the attempt limit, so the
 * function runtime retries; the provider Idempotency-Key makes a repeated send harmless.
 */
export async function processQueuedMail(ref: FirebaseFirestore.DocumentReference, send: Sender, now = () => new Date()): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const cur = await ref.get();
  if (!cur.exists) return "skipped";
  const data = cur.data() as Record<string, unknown>;
  const state = (data.delivery as { state?: string; attempts?: number } | undefined)?.state;
  if (state && state !== "RETRY") return "skipped"; // SUCCESS / ERROR / handled by an extension
  const attempts = ((data.delivery as { attempts?: number } | undefined)?.attempts ?? 0) + 1;
  const result = await send(ref.id, data);
  const at = now().toISOString();
  if (result.ok) {
    await ref.update({ delivery: { state: "SUCCESS", provider: "resend", id: result.id, attempts, at } });
    return "sent";
  }
  if (result.retryable && attempts < MAX_MAIL_ATTEMPTS) {
    await ref.update({ delivery: { state: "RETRY", provider: "resend", error: result.error, attempts, at } });
    console.warn("mail-delivery-retry", { mailId: ref.id, attempts, error: result.error });
    throw new RetryMailError(result.error);
  }
  await ref.update({ delivery: { state: "ERROR", provider: "resend", error: result.error, attempts, at } });
  console.error("mail-delivery-failed", { mailId: ref.id, attempts, error: result.error });
  return "failed";
}
