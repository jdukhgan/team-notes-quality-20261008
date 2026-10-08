// In-memory notes adapter with controllable latency and failures. It follows
// the API contract (filtering, search, ordering, validation, error shape) so
// the UI can be exercised before the real server exists.

import { NotesApiError } from './api.js';
import { buildFixtureNotes } from './fixtures.js';
import { compareNotes, normalizeDraft, validateDraft } from './constraints.js';

export const SCENARIOS = Object.freeze({
  populated: 'Populated list',
  empty: 'No notes yet',
  loading: 'List never finishes loading',
  'list-error': 'First list load fails',
  'save-error': 'Next save fails once',
  'archive-error': 'Next archive/restore fails once',
  'missing-note': 'Next save returns 404',
});

const DEFAULT_OPTIONS = {
  latency: 450,
  failNextList: false,
  failNextSave: false,
  failNextArchive: false,
  missingNextSave: false,
  hangList: false,
};

export function optionsForScenario(scenario) {
  switch (scenario) {
    case 'loading':
      return { hangList: true };
    case 'list-error':
      return { failNextList: true };
    case 'save-error':
      return { failNextSave: true };
    case 'archive-error':
      return { failNextArchive: true };
    case 'missing-note':
      return { missingNextSave: true };
    default:
      return {};
  }
}

export function createFixtureClient({ scenario = 'populated', notes, now = Date.now(), ...overrides } = {}) {
  let store = (notes ?? (scenario === 'empty' ? [] : buildFixtureNotes(now))).map((n) => ({ ...n }));
  let nextId = store.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  let options = { ...DEFAULT_OPTIONS, ...optionsForScenario(scenario), ...overrides };
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn(options));

  function consume(flag) {
    if (!options[flag]) return false;
    options = { ...options, [flag]: false };
    emit();
    return true;
  }

  function wait(signal, ms = options.latency) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true },
      );
    });
  }

  const networkError = () =>
    new NotesApiError({ status: 0, code: 'network_error', message: 'Network request failed' });
  const serverError = () =>
    new NotesApiError({ status: 503, code: 'unavailable', message: 'Service temporarily unavailable' });

  function stamp() {
    return new Date().toISOString();
  }

  function assertValid(draft, partial) {
    const errors = validateDraft(draft);
    if (partial) for (const key of Object.keys(errors)) if (!(key in partial)) delete errors[key];
    if (Object.keys(errors).length) {
      throw new NotesApiError({ status: 400, code: 'validation_error', message: 'Invalid note', fields: errors });
    }
  }

  return {
    // Adapter contract -----------------------------------------------------
    async listNotes({ status = 'active', q = '', signal } = {}) {
      if (options.hangList) await new Promise((_, reject) => signal?.addEventListener('abort', () => reject(abortError())));
      await wait(signal);
      if (consume('failNextList')) throw networkError();
      const needle = q.trim().toLowerCase();
      return store
        .filter((n) => n.archived === (status === 'archived'))
        .filter((n) => !needle || n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle))
        .sort(compareNotes)
        .map((n) => ({ ...n }));
    },

    async createNote(draft) {
      await wait();
      if (consume('failNextSave')) throw serverError();
      assertValid(draft);
      const time = stamp();
      const note = { id: nextId++, ...normalizeDraft(draft), archived: false, createdAt: time, updatedAt: time };
      store = [note, ...store];
      return { ...note };
    },

    async updateNote(id, patch) {
      await wait();
      const isArchiveToggle = Object.keys(patch).length === 1 && 'archived' in patch;
      if (isArchiveToggle ? consume('failNextArchive') : consume('failNextSave')) throw networkError();
      const current = store.find((n) => n.id === id);
      if (!current || consume('missingNextSave')) {
        throw new NotesApiError({ status: 404, code: 'not_found', message: 'Note not found' });
      }
      const editable = {};
      for (const key of ['title', 'body', 'author']) if (key in patch) editable[key] = patch[key];
      if (Object.keys(editable).length) assertValid({ ...current, ...editable }, editable);
      const normalized = normalizeDraft({ ...current, ...editable });
      const updated = {
        ...current,
        ...normalized,
        archived: 'archived' in patch ? Boolean(patch.archived) : current.archived,
        updatedAt: stamp(),
      };
      store = store.map((n) => (n.id === id ? updated : n));
      return { ...updated };
    },

    // Fixture controls (not part of the adapter contract) -------------------
    controls: {
      get: () => options,
      set(partial) {
        options = { ...options, ...partial };
        emit();
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
  };
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}
