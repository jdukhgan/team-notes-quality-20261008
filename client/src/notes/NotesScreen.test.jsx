import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFixtureClient } from './fixtureClient.js';
import { createHttpClient } from './httpClient.js';
import { NotesScreen } from './NotesScreen.jsx';

function setup(options = {}) {
  const api = createFixtureClient({ latency: 30, ...options });
  const user = userEvent.setup();
  render(<NotesScreen api={api} theme="light" onToggleTheme={() => {}} />);
  return { api, user };
}

const list = () => screen.getByRole('region', { name: /active notes|archived notes/i });

async function openNote(user, title) {
  await user.click(await screen.findByRole('button', { name: new RegExp(title, 'i') }));
  return screen.findByRole('form', { name: /edit note/i });
}

describe('NotesScreen', () => {
  it.each([
    ['Title', '  Handover  '],
    ['Written by', '  Mira  '],
  ])('settles a surrounding-whitespace-only %s edit without an HTTP write', async (label, value) => {
    const stamp = '2026-10-08T12:00:00Z';
    const note = { id: 1, title: 'Handover', body: '  Opening\n\n  side door  ', author: 'Mira', archived: false, createdAt: stamp, updatedAt: stamp };
    const fetchImpl = vi.fn(async (_path, options = {}) => {
      if (!options.method) return new Response(JSON.stringify({ notes: [note] }));
      return new Response(JSON.stringify({ error: { code: 'validation_error', message: 'Provide a nonempty JSON object.' } }), { status: 400 });
    });
    const user = userEvent.setup();
    render(<NotesScreen api={createHttpClient({ fetchImpl })} theme="light" onToggleTheme={() => {}} />);
    await openNote(user, 'Handover');
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), value);
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(save);
    expect(screen.getByLabelText('Title')).toHaveValue('Handover');
    expect(screen.getByLabelText('Written by')).toHaveValue('Mira');
    expect(screen.getByLabelText('Note')).toHaveValue('  Opening\n\n  side door  ');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Archive' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(fetchImpl.mock.calls.filter(([, options]) => options.method)).toHaveLength(0);
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'New note' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: /new note/i })).toBeInTheDocument();
  });

  it('sends a body-whitespace change exactly while normalizing unchanged title and author', async () => {
    const stamp = '2026-10-08T12:00:00Z';
    const note = { id: 1, title: 'Handover', body: 'Opening', author: 'Mira', archived: false, createdAt: stamp, updatedAt: stamp };
    const fetchImpl = vi.fn(async (_path, options = {}) => {
      if (!options.method) return new Response(JSON.stringify({ notes: [note] }));
      return new Response(JSON.stringify({ note: { ...note, ...JSON.parse(options.body) } }));
    });
    const user = userEvent.setup();
    render(<NotesScreen api={createHttpClient({ fetchImpl })} theme="light" onToggleTheme={() => {}} />);
    await openNote(user, 'Handover');
    await user.type(screen.getByLabelText('Title'), ' ');
    await user.type(screen.getByLabelText('Written by'), ' ');
    await user.type(screen.getByLabelText('Note'), '  {enter}  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-disabled', 'true'));
    const writes = fetchImpl.mock.calls.filter(([, options]) => options.method === 'PATCH');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1].body)).toEqual({ body: 'Opening  \n  ' });
    expect(screen.getByLabelText('Note')).toHaveValue('Opening  \n  ');
    expect(screen.getByLabelText('Title')).toHaveValue('Handover');
    expect(screen.getByLabelText('Written by')).toHaveValue('Mira');
  });

  it('reconciles a mutation with the current tab when the filter changes while saving', async () => {
    let finishSave;
    const stamp = new Date().toISOString();
    const note = { id: 1, title: 'Current handover', body: 'Opening', author: 'Mira', archived: false, createdAt: stamp, updatedAt: stamp };
    const api = {
      listNotes: vi.fn().mockImplementation(async ({status}) => status === 'active' ? [note] : []),
      updateNote: vi.fn().mockImplementation(() => new Promise(resolve => { finishSave = resolve; })),
    };
    const user = userEvent.setup();
    render(<NotesScreen api={api} theme="light" onToggleTheme={() => {}} />);
    await openNote(user, 'Current handover');
    await user.type(screen.getByLabelText('Note'), ' reviewed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(screen.getByRole('radio', { name: 'Archived' }));
    await waitFor(() => expect(within(list()).queryByRole('listitem')).not.toBeInTheDocument());
    finishSave({ ...note, body: 'Opening reviewed' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(list()).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('ignores an obsolete list response even when cancellation arrives after resolution', async () => {
    let resolveOld;
    const api = { listNotes: vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue([{ id: 99, title: 'Archived handover', body: 'Done', author: 'Mira', archived: true, updatedAt: new Date().toISOString() }]) };
    const user = userEvent.setup();
    render(<NotesScreen api={api} theme="light" onToggleTheme={() => {}} />);
    await user.click(screen.getByRole('radio', { name: 'Archived' }));
    await screen.findByRole('button', { name: /Archived handover/ });
    resolveOld([{ id: 1, title: 'Obsolete active note', body: 'Old', author: 'Mira', archived: false }]);
    await waitFor(() => expect(screen.queryByText('Obsolete active note')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Archived handover/ })).toBeInTheDocument();
  });

  it('lists active notes in contract order and filters archived', async () => {
    const { user } = setup();
    const items = await within(list()).findAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveTextContent('Harbor Street pop-up');

    await user.click(screen.getByRole('radio', { name: 'Archived' }));
    await screen.findByRole('heading', { name: 'Archived notes' });
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(3));
  });

  it('searches case-insensitively in title and body', async () => {
    const { user } = setup();
    await within(list()).findAllByRole('listitem');
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'KRAFT');
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(1));
    expect(within(list()).getByRole('listitem')).toHaveTextContent('Supplier call');
  });

  it('shows inline validation and focuses the first invalid field', async () => {
    const { user } = setup();
    await within(list()).findAllByRole('listitem');
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'New note' }));
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    const title = screen.getByLabelText('Title');
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(/add a title/i);
  });

  it('prevents duplicate creates while pending and keeps the draft on failure', async () => {
    const { api, user } = setup({ failNextSave: true });
    await within(list()).findAllByRole('listitem');
    const create = vi.spyOn(api, 'createNote');

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'New note' }));
    await user.type(screen.getByLabelText('Title'), 'Delivery window');
    await user.type(screen.getByLabelText('Note'), 'Mon 7–9am{enter}  side door');
    await user.type(screen.getByLabelText('Written by'), 'Lena');

    const save = screen.getByRole('button', { name: 'Save note' });
    await user.click(save);
    await user.click(save);
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(create).toHaveBeenCalledTimes(1);
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Title')).toHaveAttribute('readonly');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't create the note.");
    expect(alert).toHaveTextContent(/draft is still here/i);
    expect(screen.getByLabelText('Title')).toHaveValue('Delivery window');
    expect(screen.getByLabelText('Note')).toHaveValue('Mon 7–9am\n  side door');
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Save note' })).toHaveFocus();
    expect(within(list()).getAllByRole('listitem')).toHaveLength(7);

    // Retry succeeds and the note joins the top of the list.
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await screen.findByRole('form', { name: /edit note/i });
    expect(create).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('Delivery window'));
  });

  it('keeps edits and refocuses Save when an update fails', async () => {
    const { user } = setup({ failNextSave: true });
    await openNote(user, 'Retro notes');
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Retro notes — sprint 41 (final)');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your changes.");
    expect(title).toHaveValue('Retro notes — sprint 41 (final)');
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus();
  });

  it('archives with duplicate prevention, recovers from failure, and restores', async () => {
    const { api, user } = setup({ failNextArchive: true });
    await openNote(user, 'Wi-Fi password');
    const update = vi.spyOn(api, 'updateNote');

    const archive = screen.getByRole('button', { name: 'Archive' });
    await user.click(archive);
    await user.click(archive);
    expect(update).toHaveBeenCalledTimes(1);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't archive the note.");
    expect(alert).toHaveTextContent(/nothing was changed/i);
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
    expect(within(list()).getAllByRole('listitem')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    const restore = await screen.findByRole('button', { name: 'Restore' });
    expect(restore).toHaveFocus();
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(6));

    await user.click(restore);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus());
  });

  it('keeps the loaded list when a refresh fails and retries', async () => {
    const { api, user } = setup();
    await within(list()).findAllByRole('listitem');
    api.controls.set({ failNextList: true });
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'rota');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load notes.");
    expect(within(list()).getAllByRole('listitem')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('offers to save a draft as a new note when the original is gone (404)', async () => {
    const { user } = setup({ missingNextSave: true });
    await openNote(user, 'Ideas for the autumn menu');
    await user.type(screen.getByLabelText('Note'), '{enter}Pumpkin loaf?');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/i);
    expect(screen.getByLabelText('Note').value).toMatch(/Pumpkin loaf\?$/);
    await user.click(screen.getByRole('button', { name: 'Save as a new note' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(8));
  });

  it('asks before discarding unsaved edits', async () => {
    const { user } = setup();
    await openNote(user, 'Retro notes');
    await user.type(screen.getByLabelText('Note'), ' more');
    await user.click(screen.getByRole('button', { name: /Ideas for the autumn menu/ }));
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Note').value).toMatch(/ more$/);
  });
});
