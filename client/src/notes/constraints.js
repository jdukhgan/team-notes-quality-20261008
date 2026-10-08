// Shared note field rules. These mirror the agreed API contract so the client
// and server reject the same input; keep both sides in sync when a limit changes.

export const NOTE_LIMITS = Object.freeze({
  title: 120,
  author: 80,
  body: 20000,
});

export const NOTE_STATUSES = Object.freeze(['active', 'archived']);

export const FIELD_LABELS = Object.freeze({
  title: 'Title',
  author: 'Author',
  body: 'Note',
});

// The server counts Python str length (Unicode code points), not UTF-16 units,
// so emoji and other astral characters count once.
export function charCount(value) {
  let count = 0;
  for (const _ of value ?? '') count += 1;
  return count;
}

// Title and author are stored trimmed; body is stored exactly as typed so
// indentation, blank lines and trailing whitespace are preserved.
export function normalizeDraft(draft) {
  return {
    title: (draft.title ?? '').trim(),
    author: (draft.author ?? '').trim(),
    body: draft.body ?? '',
  };
}

/**
 * Validate a draft against the contract.
 * @returns {Record<string,string>} field -> message; empty when valid.
 */
export function validateDraft(draft) {
  const { title, author, body } = normalizeDraft(draft);
  const errors = {};

  if (!title) errors.title = 'Add a title.';
  else if (charCount(title) > NOTE_LIMITS.title)
    errors.title = `Keep the title to ${NOTE_LIMITS.title} characters or fewer.`;

  if (!body.trim()) errors.body = 'Write something in the note.';
  else if (charCount(body) > NOTE_LIMITS.body)
    errors.body = `Keep the note to ${NOTE_LIMITS.body.toLocaleString('en-US')} characters or fewer.`;

  if (!author) errors.author = 'Add who wrote this note.';
  else if (charCount(author) > NOTE_LIMITS.author)
    errors.author = `Keep the author name to ${NOTE_LIMITS.author} characters or fewer.`;

  return errors;
}

// Field order used for focusing the first invalid field.
export const FIELD_ORDER = Object.freeze(['title', 'body', 'author']);

export function firstInvalidField(errors) {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

// List ordering defined by the contract: updatedAt descending, then id descending.
export function compareNotes(a, b) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return b.id - a.id;
}
