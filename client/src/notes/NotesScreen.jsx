import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeFailure, isAbortError } from './api.js';
import { compareNotes, firstInvalidField, normalizeDraft, validateDraft } from './constraints.js';
import { Button } from '../components/Button.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { NoteList } from '../components/NoteList.jsx';
import { NoteEditor, NoteReader, NoteSheetPlaceholder } from '../components/NoteSheet.jsx';
import { SearchField } from '../components/SearchField.jsx';
import { StatusFilter } from '../components/StatusFilter.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';

const EMPTY_DRAFT = { title: '', body: '', author: '' };
const SEARCH_DEBOUNCE_MS = 250;

const draftOf = (note) => ({ title: note.title, body: note.body, author: note.author });
const sameDraft = (a, b) => a.title === b.title && a.body === b.body && a.author === b.author;

function matchesView(note, status, query) {
  if (note.archived !== (status === 'archived')) return false;
  const needle = query.trim().toLowerCase();
  return !needle || note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function isNarrow() {
  return window.matchMedia?.('(max-width: 47.99rem)').matches ?? false;
}

/**
 * Notes screen: the single owner of list, selection, draft, pending and
 * failure state. All child components are controlled by it.
 *
 * @param {{ api: import('./api.js').NotesAdapter, theme: string, onToggleTheme: () => void }} props
 */
export function NotesScreen({ api, theme, onToggleTheme }) {
  // List ------------------------------------------------------------------
  const [status, setStatus] = useState('active');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [reloadKey, setReloadKey] = useState(0);
  const [list, setList] = useState({ notes: [], loaded: false, loading: true, error: null, status: 'active' });

  // Selection and draft ----------------------------------------------------
  const [mode, setMode] = useState('none'); // none | create | edit | view
  const [current, setCurrent] = useState(null); // selected note snapshot
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState(EMPTY_DRAFT);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [failure, setFailure] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const [pane, setPane] = useState('list'); // narrow layouts show one pane
  const [confirm, setConfirm] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [lastAuthor, setLastAuthor] = useState('');

  // Synchronous guards: state updates are async, refs block a double click
  // or Enter-repeat landing before the pending render.
  const savingRef = useRef(false);
  const archivingRef = useRef(false);
  const listHeadingRef = useRef(null);
  const newButtonRef = useRef(null);
  const listControllerRef = useRef(null);
  const viewRef = useRef(null);
  viewRef.current = { status, query: debouncedQuery };

  const dirty = (mode === 'create' || mode === 'edit') && !sameDraft(draft, baseline);

  const focus = useCallback((target) => setFocusRequest({ target, nonce: Date.now() + Math.random() }), []);
  const announce = useCallback((message) => {
    // Clear first so repeating the same message is announced again.
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  // Load notes whenever filter, query or retry changes. Out-of-date responses
  // are aborted, so a slow earlier search cannot overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    listControllerRef.current = controller;
    setList((prev) => ({ ...prev, loading: true }));
    api
      .listNotes({ status, q: debouncedQuery.trim(), signal: controller.signal })
      .then((notes) => {
        if (controller.signal.aborted) return;
        setList({ notes, loaded: true, loading: false, error: null, status });
        if (debouncedQuery.trim()) {
          announce(`${notes.length} ${notes.length === 1 ? 'note matches' : 'notes match'} “${debouncedQuery.trim()}”.`);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setList((prev) => {
          // Keep the last list only if it belongs to the same status tab;
          // otherwise active notes would show under "Archived".
          const keep = prev.loaded && prev.status === status;
          return {
            notes: keep ? prev.notes : [],
            loaded: keep,
            loading: false,
            error: describeFailure('load', error),
            status,
          };
        });
      });
    return () => controller.abort();
  }, [api, status, debouncedQuery, reloadKey, announce]);

  // Warn before leaving the page with unsaved work.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Upsert a note into the visible list if it still belongs there.
  const placeInList = useCallback(
    (note) => {
      // A mutation can finish after the user changes the search or status.
      // Invalidate snapshots taken before the write and reconcile the current view.
      listControllerRef.current?.abort();
      setList((prev) => {
        const view = viewRef.current;
        const others = prev.notes.filter((n) => n.id !== note.id);
        const notes = prev.status === view.status && matchesView(note, view.status, view.query)
          ? [...others, note].sort(compareNotes) : others;
        return { ...prev, notes };
      });
      setReloadKey((key) => key + 1);
    },
    [],
  );

  // Selection ---------------------------------------------------------------
  function guardDiscard(action) {
    if (savingRef.current || archivingRef.current) return;
    if (dirty) setConfirm({ action });
    else action();
  }

  function resetTransient() {
    setErrors({});
    setShowErrors(false);
    setFailure(null);
    setSavedMessage('');
    setNotice('');
  }

  function openNote(note) {
    resetTransient();
    setCurrent(note);
    setDraft(draftOf(note));
    setBaseline(draftOf(note));
    setMode(note.archived ? 'view' : 'edit');
    setPane('detail');
    if (isNarrow()) focus('heading');
  }

  function startCreate() {
    resetTransient();
    setCurrent(null);
    const fresh = { ...EMPTY_DRAFT, author: lastAuthor };
    setDraft(fresh);
    setBaseline(fresh);
    setMode('create');
    setPane('detail');
    focus('title');
  }

  function closeSheet() {
    resetTransient();
    setMode('none');
    setCurrent(null);
    setDraft(EMPTY_DRAFT);
    setPane('list');
  }

  function backToList() {
    // The draft is kept; only the visible pane changes on narrow layouts.
    setPane('list');
    requestAnimationFrame(() => listHeadingRef.current?.focus());
  }

  // Editing -------------------------------------------------------------------
  function changeDraft(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setSavedMessage('');
    if (showErrors) setErrors(validateDraft(next));
  }

  function discard() {
    if (mode === 'create') {
      closeSheet();
      requestAnimationFrame(() => newButtonRef.current?.focus());
      return;
    }
    setDraft(baseline);
    setErrors({});
    setShowErrors(false);
    setFailure(null);
    announce('Changes discarded.');
    focus('title');
  }

  async function save({ asNew = false } = {}) {
    if (savingRef.current || archivingRef.current) return;
    const creating = mode === 'create' || asNew;
    const validation = validateDraft(draft);
    if (Object.keys(validation).length) {
      setErrors(validation);
      setShowErrors(true);
      const count = Object.keys(validation).length;
      announce(`${count} ${count === 1 ? 'field needs' : 'fields need'} attention.`);
      focus(firstInvalidField(validation));
      return;
    }
    if (!creating && !dirty) return;

    savingRef.current = true;
    setSaving(true);
    setFailure(null);
    const payload = normalizeDraft(draft);
    try {
      let saved;
      if (creating) {
        saved = await api.createNote(payload);
      } else {
        // Send only fields that changed.
        const patch = {};
        for (const key of Object.keys(payload)) if (payload[key] !== baseline[key]) patch[key] = payload[key];
        saved = await api.updateNote(current.id, patch);
      }
      placeInList(saved);
      setCurrent(saved);
      setDraft(draftOf(saved));
      setBaseline(draftOf(saved));
      setMode('edit');
      setErrors({});
      setShowErrors(false);
      setLastAuthor(saved.author);
      setSavedMessage(creating ? 'Note created' : 'Changes saved');
      announce(creating ? `Note “${saved.title}” created.` : 'Changes saved.');
      if (creating) focus('title');
    } catch (error) {
      const described = describeFailure(creating ? 'create' : 'save', error);
      if (described.fields) {
        setErrors(described.fields);
        setShowErrors(true);
        focus(firstInvalidField(described.fields) ?? 'save');
        announce(described.detail);
      } else {
        setFailure({ action: creating ? 'create' : 'save', ...described });
        // The alert announces itself; focus returns to Save, which is the retry.
        focus('save');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (archivingRef.current || savingRef.current || !current) return;
    if (!current.archived && dirty) return;
    const archiving = !current.archived;
    const action = archiving ? 'archive' : 'restore';

    archivingRef.current = true;
    setArchiving(true);
    setFailure(null);
    setNotice('');
    try {
      const updated = await api.updateNote(current.id, { archived: archiving });
      placeInList(updated);
      setCurrent(updated);
      setDraft(draftOf(updated));
      setBaseline(draftOf(updated));
      setMode(updated.archived ? 'view' : 'edit');
      setSavedMessage('');
      if (archiving) {
        setNotice('Archived. It’s kept in the Archived tab and can be restored at any time.');
        announce(`“${updated.title}” archived.`);
      } else {
        setSavedMessage('Restored');
        announce(`“${updated.title}” restored to active notes.`);
      }
      // The toggle swaps Archive <-> Restore in the same place; keep focus there.
      focus('archive');
    } catch (error) {
      setFailure({ action, ...describeFailure(action, error) });
      focus('archive');
    } finally {
      archivingRef.current = false;
      setArchiving(false);
    }
  }

  // Filters -------------------------------------------------------------------
  function changeStatus(next) {
    if (next === status) return;
    setStatus(next);
    // Show the loading state rather than the other tab's notes.
    setList({ notes: [], loaded: false, loading: true, error: null, status: next });
  }

  const listTitle = status === 'active' ? 'Active notes' : 'Archived notes';
  const countLabel = useMemo(() => {
    if (!list.loaded) return '';
    const n = list.notes.length;
    return `${n} ${n === 1 ? 'note' : 'notes'}`;
  }, [list.loaded, list.notes.length]);

  const now = Date.now();
  const restoring = archiving && current?.archived;

  return (
    <div className="app" data-pane={pane}>
      <a className="skip-link" href="#note-search">
        Skip to search
      </a>
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true" />
          <h1 className="app-header__title">Team Notes</h1>
        </div>
        <div className="app-header__actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button ref={newButtonRef} variant="primary" icon="plus" onClick={() => guardDiscard(startCreate)}>
            New note
          </Button>
        </div>
      </header>

      <main className="layout">
        <section className="pane pane--list" aria-labelledby="list-heading">
          <div className="pane__toolbar">
            <SearchField value={query} onChange={setQuery} busy={list.loading && list.loaded} />
            <StatusFilter value={status} onChange={changeStatus} />
          </div>
          <div className="pane__heading">
            <h2 id="list-heading" ref={listHeadingRef} tabIndex={-1}>
              {listTitle}
            </h2>
            <span className="pane__count">{countLabel}</span>
          </div>
          <NoteList
            notes={list.notes}
            status={status}
            query={debouncedQuery}
            selectedId={current?.id ?? null}
            loaded={list.loaded}
            loading={list.loading}
            error={list.error}
            now={now}
            onSelect={(note) => (note.id === current?.id ? setPane('detail') : guardDiscard(() => openNote(note)))}
            onRetry={() => setReloadKey((k) => k + 1)}
            onCreate={() => guardDiscard(startCreate)}
            onClearSearch={() => setQuery('')}
            onShowActive={() => changeStatus('active')}
          />
        </section>

        <section className="pane pane--detail" aria-label="Selected note">
          {mode === 'create' || mode === 'edit' ? (
            <NoteEditor
              key={mode === 'create' ? 'new' : current.id}
              mode={mode}
              note={current}
              draft={draft}
              errors={showErrors ? errors : {}}
              dirty={dirty}
              saving={saving}
              archiving={archiving}
              failure={failure}
              savedMessage={savedMessage}
              focusRequest={focusRequest}
              onDraftChange={changeDraft}
              onSubmit={() => save()}
              onSaveAsNew={() => save({ asNew: true })}
              onDiscard={discard}
              onArchive={toggleArchive}
              onDismissFailure={() => setFailure(null)}
              onBack={backToList}
              now={now}
            />
          ) : mode === 'view' && current ? (
            <NoteReader
              key={current.id}
              note={current}
              restoring={restoring}
              failure={failure}
              notice={notice}
              focusRequest={focusRequest}
              onRestore={toggleArchive}
              onDismissFailure={() => setFailure(null)}
              onBack={backToList}
              now={now}
            />
          ) : (
            <NoteSheetPlaceholder hasNotes={list.notes.length > 0} />
          )}
        </section>
      </main>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const next = confirm?.action;
          setConfirm(null);
          next?.();
        }}
      >
        <p>Your edits to this note haven’t been saved. If you continue they’ll be lost.</p>
      </ConfirmDialog>
    </div>
  );
}
