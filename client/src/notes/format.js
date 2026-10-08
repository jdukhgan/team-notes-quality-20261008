const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const mediumDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const shortDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "18 minutes ago", "yesterday"; older than a week falls back to "12 Mar". */
export function formatRelative(iso, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  if (Math.abs(seconds) >= 7 * 24 * 3600) return shortDate.format(new Date(iso));
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function formatDate(iso) {
  return mediumDate.format(new Date(iso));
}

export function formatAbsolute(iso) {
  return absolute.format(new Date(iso));
}

/** Single-line preview of a note body for list rows. */
export function excerpt(body, max = 160) {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Split text into [{text, match}] parts for case-insensitive highlighting.
 */
export function highlightParts(text, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const parts = [];
  const haystack = text.toLowerCase();
  let index = 0;
  while (index < text.length) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) break;
    if (found > index) parts.push({ text: text.slice(index, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    index = found + needle.length;
  }
  if (index < text.length) parts.push({ text: text.slice(index), match: false });
  return parts;
}

/** Excerpt centred on the first match so search hits in long bodies are visible. */
export function matchExcerpt(body, query, max = 160) {
  const needle = query.trim().toLowerCase();
  const flat = body.replace(/\s+/g, ' ').trim();
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1;
  if (at < 60 || flat.length <= max) return excerpt(body, max);
  const start = Math.max(0, at - 40);
  const slice = flat.slice(start, start + max - 2).trim();
  return `…${slice}${start + max - 2 < flat.length ? '…' : ''}`;
}
