/** Sends queued `mail` documents through Resend (https://resend.com). No SDK: one fetch call. */
export interface MailDoc {
  to?: string | string[];
  replyTo?: string;
  message?: { subject?: string; html?: string; text?: string };
  delivery?: unknown;
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

const EMAIL = /^[^@\s<>]{1,64}@[^@\s<>]{1,255}\.[^@\s<>]{2,}$/;

export function normaliseRecipients(to: unknown): string[] {
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  return list.map((x) => String(x).trim()).filter((x) => EMAIL.test(x)).slice(0, 5);
}

export async function sendViaResend(
  fetchImpl: FetchLike, apiKey: string, from: string, mailId: string, doc: MailDoc,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const to = normaliseRecipients(doc.to);
  const m = doc.message || {};
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set" };
  if (!to.length) return { ok: false, error: "no valid recipient" };
  if (!m.subject || (!m.html && !m.text)) return { ok: false, error: "missing subject or body" };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `mail-${mailId}` },
      body: JSON.stringify({ from, to, subject: m.subject, html: m.html, text: m.text, ...(normaliseRecipients(doc.replyTo).length ? { reply_to: normaliseRecipients(doc.replyTo)[0] } : {}) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `resend ${res.status}: ${String(body?.message || body?.name || "error").slice(0, 160)}` };
    return { ok: true, id: String(body?.id || "") };
  } catch (e) {
    return { ok: false, error: `network: ${String((e as Error)?.message || e).slice(0, 120)}` };
  }
}
