// The database runs in UTC and its TIMESTAMP columns carry no timezone, but the
// driver would read them as the device's local time (so times showed up hours
// off). Parse them as UTC instead. Done by hand because Safari rejects
// Postgres's six-digit fractional seconds in Date strings.
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

export function parseUtcTimestamp(value) {
  const m = PATTERN.exec(value);
  if (!m) return value; // e.g. 'infinity': leave as-is
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms));
}

export const TIMESTAMP_OID = 1114; // timestamp without time zone
