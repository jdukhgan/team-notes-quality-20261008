import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './httpClient.js';

describe('HTTP adapter boundary', () => {
  it('encodes literal search, forwards cancellation and unwraps API envelopes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: [{ id: 1 }] })));
    const signal = new AbortController().signal;
    const notes = await createHttpClient({ fetchImpl }).listNotes({ status: 'archived', q: 'tea & café?', signal });
    expect(notes).toEqual([{ id: 1 }]);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(new URL(url, 'http://localhost').searchParams.get('q')).toBe('tea & café?');
    expect(options.signal).toBe(signal);
  });

  it('sends only supplied fields and preserves multiline body formatting', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ note: { id: 2 } })));
    const api = createHttpClient({ fetchImpl });
    const draft = { title: 'Handovers', body: '  First\n\nSecond  ', author: 'Mira' };
    expect(await api.createNote(draft)).toEqual({ id: 2 });
    await api.updateNote(2, { archived: true });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(draft);
    expect(fetchImpl.mock.calls[1]).toEqual(['/api/notes/2', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"archived":true}',
    }]);
  });

  it('preserves validation fields, handles non-JSON failures, and never retries implicitly', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: {
      code: 'validation_error', message: 'Check fields', fields: { title: 'Required' },
    } }), { status: 400 })).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    const api = createHttpClient({ fetchImpl });
    await expect(api.createNote({})).rejects.toMatchObject({ status: 400, code: 'validation_error', fields: { title: 'Required' } });
    await expect(api.updateNote(1, { archived: true })).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('distinguishes network errors from aborted obsolete searches', async () => {
    const aborted = new DOMException('Aborted', 'AbortError');
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('Offline')).mockRejectedValueOnce(aborted);
    const api = createHttpClient({ fetchImpl });
    await expect(api.listNotes()).rejects.toMatchObject({ status: 0, code: 'network_error' });
    await expect(api.listNotes()).rejects.toBe(aborted);
  });
});
