// Notes API adapter contract used by NotesScreen.
//
// An adapter is a plain object:
//   listNotes({ status, q, signal }) -> Promise<Note[]>
//   createNote({ title, body, author }) -> Promise<Note>
//   updateNote(id, patch) -> Promise<Note>   // patch: any of title/body/author/archived
//
// Note: { id:number, title, body, author, archived:boolean, createdAt, updatedAt }
// (UTC ISO strings). Adapters reject with NotesApiError so the screen can map
// failures to one consistent presentation. The fixture adapter lives in
// fixtureClient.js; the Builder supplies the HTTP adapter.

/**
 * @typedef {{ id: number, title: string, body: string, author: string, archived: boolean, createdAt: string, updatedAt: string }} Note
 * @typedef {{
 *   listNotes(params: { status: 'active'|'archived', q: string, signal?: AbortSignal }): Promise<Note[]>,
 *   createNote(draft: { title: string, body: string, author: string }): Promise<Note>,
 *   updateNote(id: number, patch: Partial<Pick<Note, 'title'|'body'|'author'|'archived'>>): Promise<Note>,
 * }} NotesAdapter
 */

export class NotesApiError extends Error {
  /**
   * @param {object} options
   * @param {number} options.status HTTP status, or 0 for network/offline failures.
   * @param {string} [options.code] Server error code from {error:{code}}.
   * @param {string} [options.message] Server message (not shown verbatim for 5xx/network).
   * @param {Record<string,string>} [options.fields] Field-level validation messages.
   */
  constructor({ status, code = 'unknown', message = 'Request failed', fields } = {}) {
    super(message);
    this.name = 'NotesApiError';
    this.status = status ?? 0;
    this.code = code;
    this.fields = fields ?? null;
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

const ACTION_COPY = {
  create: "Couldn't create the note.",
  save: "Couldn't save your changes.",
  archive: "Couldn't archive the note.",
  restore: "Couldn't restore the note.",
  load: "Couldn't load notes.",
};

/**
 * Turn any adapter failure into user-facing copy.
 * @param {'create'|'save'|'archive'|'restore'|'load'} action
 * @returns {{ title: string, detail: string, fields: Record<string,string>|null, missing: boolean }}
 */
export function describeFailure(action, error) {
  const title = ACTION_COPY[action] ?? 'Something went wrong.';
  const status = error?.status ?? 0;

  if (status === 400 && error.fields && Object.keys(error.fields).length) {
    return {
      title,
      detail: 'Some fields need attention. Fix them and try again.',
      fields: error.fields,
      missing: false,
    };
  }
  if (status === 404) {
    return {
      title,
      detail:
        action === 'load'
          ? 'The notes service could not be found. Try again in a moment.'
          : 'This note no longer exists. It may have been removed by someone else. Copy anything you need before leaving.',
      fields: null,
      missing: action !== 'load',
    };
  }
  if (status === 400) {
    return { title, detail: error.message || 'The request was not accepted.', fields: null, missing: false };
  }
  if (status === 0) {
    return {
      title,
      detail: keepCopy(action, 'Check your connection, then try again.'),
      fields: null,
      missing: false,
    };
  }
  return {
    title,
    detail: keepCopy(action, 'The notes service had a problem. Try again in a moment.'),
    fields: null,
    missing: false,
  };
}

function keepCopy(action, hint) {
  if (action === 'create' || action === 'save') return `Your draft is still here. ${hint}`;
  if (action === 'archive' || action === 'restore') return `Nothing was changed. ${hint}`;
  return hint;
}
