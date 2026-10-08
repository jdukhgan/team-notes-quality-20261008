import { describe, expect, it } from 'vitest';
import { describeFailure, NotesApiError } from './api.js';
import { charCount, compareNotes, NOTE_LIMITS, normalizeDraft, validateDraft } from './constraints.js';

describe('validateDraft', () => {
  const valid = { title: 'Retro', author: 'Mei', body: 'Notes' };

  it('accepts a valid draft', () => {
    expect(validateDraft(valid)).toEqual({});
  });

  it('requires trimmed title/author and a nonblank body', () => {
    expect(validateDraft({ title: '   ', author: '\t', body: ' \n ' })).toEqual({
      title: expect.any(String),
      author: expect.any(String),
      body: expect.any(String),
    });
  });

  it('applies limits after trimming title/author', () => {
    expect(validateDraft({ ...valid, title: `  ${'a'.repeat(NOTE_LIMITS.title)}  ` })).toEqual({});
    expect(validateDraft({ ...valid, title: 'a'.repeat(NOTE_LIMITS.title + 1) }).title).toMatch(/120/);
    expect(validateDraft({ ...valid, author: 'a'.repeat(NOTE_LIMITS.author + 1) }).author).toMatch(/80/);
    expect(validateDraft({ ...valid, body: 'a'.repeat(NOTE_LIMITS.body + 1) }).body).toMatch(/20,000/);
  });

  it('counts code points like the Python server', () => {
    expect(charCount('🗒️a')).toBe(3);
    expect(validateDraft({ ...valid, title: '😀'.repeat(NOTE_LIMITS.title) })).toEqual({});
  });
});

describe('normalizeDraft', () => {
  it('trims title/author but preserves body formatting', () => {
    const body = '  indented\n\n\tTabbed  \n';
    expect(normalizeDraft({ title: ' T ', author: ' A ', body })).toEqual({ title: 'T', author: 'A', body });
  });
});

describe('compareNotes', () => {
  it('orders by updatedAt desc then id desc', () => {
    const notes = [
      { id: 1, updatedAt: '2026-10-01T10:00:00Z' },
      { id: 3, updatedAt: '2026-10-02T10:00:00Z' },
      { id: 2, updatedAt: '2026-10-02T10:00:00Z' },
    ];
    expect(notes.sort(compareNotes).map((n) => n.id)).toEqual([3, 2, 1]);
  });
});

describe('describeFailure', () => {
  it('maps validation errors to fields', () => {
    const error = new NotesApiError({ status: 400, fields: { title: 'Too long' } });
    expect(describeFailure('save', error)).toMatchObject({ fields: { title: 'Too long' } });
  });

  it('keeps-draft copy for network failures', () => {
    const result = describeFailure('save', new NotesApiError({ status: 0 }));
    expect(result.title).toBe("Couldn't save your changes.");
    expect(result.detail).toMatch(/draft is still here/);
  });

  it('flags missing notes', () => {
    expect(describeFailure('archive', new NotesApiError({ status: 404 })).missing).toBe(true);
  });
});
