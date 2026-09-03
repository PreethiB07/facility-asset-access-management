export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function formatAccessPeriod(
  accessType: 'TEMPORARY' | 'PERMANENT',
  startAt: string,
  endAt: string | null,
): string {
  if (accessType === 'PERMANENT') {
    return `Permanent (from ${formatDateTime(startAt)})`;
  }
  return endAt
    ? `${formatDateTime(startAt)} – ${formatDateTime(endAt)}`
    : formatDateTime(startAt);
}

export function formatValidUntil(
  accessType: 'TEMPORARY' | 'PERMANENT',
  endAt: string | null,
): string {
  if (accessType === 'PERMANENT') {
    return 'Permanent';
  }
  return endAt ? `Valid until ${formatDateTime(endAt)}` : 'Temporary';
}
