const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, DATE_TIME_OPTIONS);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
    return `From ${formatDateTime(startAt)} — Permanent`;
  }
  return endAt ? `${formatDateTime(startAt)} to ${formatDateTime(endAt)}` : formatDateTime(startAt);
}

export function formatValidUntil(
  accessType: 'TEMPORARY' | 'PERMANENT',
  startAt: string,
  endAt: string | null,
): string {
  if (accessType === 'PERMANENT') {
    return `From ${formatDate(startAt)} — Permanent`;
  }
  return endAt ? `Valid until ${formatDateTime(endAt)}` : 'Temporary';
}
