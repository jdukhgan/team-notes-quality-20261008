import { NotesApiError, isAbortError } from './api.js';

/** Same-origin HTTP adapter; presentation and explicit retries belong to NotesScreen. */
export function createHttpClient({ fetchImpl = (...args) => fetch(...args) } = {}) {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(path, options);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new NotesApiError({ status: 0, code: 'network_error' });
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new NotesApiError({ status: response.ok ? 502 : response.status, code: 'invalid_response' });
    }
    if (!response.ok) throw new NotesApiError({ ...data.error, status: response.status });
    return data;
  }
  const write = (path, method, payload) => request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((data) => data.note);
  return {
    listNotes: ({ status = 'active', q = '', signal } = {}) =>
      request(`/api/notes?${new URLSearchParams({ status, q })}`, { signal }).then((data) => data.notes),
    createNote: (draft) => write('/api/notes', 'POST', draft),
    updateNote: (id, patch) => write(`/api/notes/${encodeURIComponent(id)}`, 'PATCH', patch),
  };
}
