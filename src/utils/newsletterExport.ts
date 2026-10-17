/** CSV exports must quote cells and neutralise spreadsheet formulas in user-controlled fields. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function subscriberDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value && typeof (value as any).toDate === 'function'
    ? (value as any).toDate() : new Date(value as string);
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

export function newsletterCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [['Email Address', 'Date Subscribed', 'Status'], ...rows.map(row => [
    row.email, subscriberDate(row.createdAt ?? row.subscribedAt), row.status ?? 'subscribed',
  ])];
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n');
}
