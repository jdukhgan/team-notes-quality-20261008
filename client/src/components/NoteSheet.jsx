import { useEffect, useId, useRef } from 'react';
import { NOTE_LIMITS } from '../notes/constraints.js';
import { formatAbsolute, formatDate, formatRelative } from '../notes/format.js';
import { Button } from './Button.jsx';
import { EmptyState } from './EmptyState.jsx';
import { Field } from './Field.jsx';
import { Icon } from './Icon.jsx';
import { InlineAlert } from './InlineAlert.jsx';

/**
 * Moves focus when the screen asks for it. `focusRequest` is
 * { target, nonce }; a new nonce re-applies the same target.
 */
let lastHandledNonce = null;

function useFocusRequest(focusRequest, refs) {
  useEffect(() => {
    // Each request is applied once, so a sheet that remounts later (another
    // note selected) does not replay an old request.
    if (!focusRequest || focusRequest.nonce === lastHandledNonce) return;
    const element = refs[focusRequest.target]?.current;
    if (!element) return;
    lastHandledNonce = focusRequest.nonce;
    element.focus();
  }, [focusRequest]);
}

function SheetHeader({ eyebrow, headingRef, onBack, children, badge }) {
  return (
    <div className="sheet__header">
      <Button variant="ghost" size="sm" icon="back" className="sheet__back" onClick={onBack}>
        All notes
      </Button>
      <div className="sheet__heading-row">
        <h2 className="sheet__eyebrow" ref={headingRef} tabIndex={-1}>
          {eyebrow}
          {badge}
        </h2>
        <div className="sheet__tools">{children}</div>
      </div>
    </div>
  );
}

function NoteMeta({ note, now, showAuthor = true }) {
  if (!note) return null;
  return (
    <p className="sheet__meta">
      {showAuthor ? (
        <>
          <span>{note.author}</span>
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      <span>
        Updated{' '}
        <time dateTime={note.updatedAt} title={formatAbsolute(note.updatedAt)}>
          {formatRelative(note.updatedAt, now)}
        </time>
      </span>
      <span aria-hidden="true"> · </span>
      <span>
        Created{' '}
        <time dateTime={note.createdAt} title={formatAbsolute(note.createdAt)}>
          {formatDate(note.createdAt)}
        </time>
      </span>
    </p>
  );
}

/**
 * Shown in the detail pane when nothing is selected (wide layouts only).
 * Deliberately has no button: "New note" is always in the header, and the
 * empty list offers its own call to action.
 */
export function NoteSheetPlaceholder({ hasNotes }) {
  return (
    <div className="sheet sheet--placeholder">
      <EmptyState icon="note" title={hasNotes ? 'Pick a note to read or edit' : 'Nothing selected'}>
        Notes are shared with everyone on the team. Archive anything that’s done — it stays searchable.
      </EmptyState>
    </div>
  );
}

/**
 * Create / edit form. Controlled: the screen owns draft, errors, pending flags,
 * failure and focus decisions; this component owns layout, refs and
 * keyboard shortcuts.
 */
export function NoteEditor({
  mode,
  note,
  draft,
  errors,
  dirty,
  saving,
  archiving,
  failure,
  savedMessage,
  focusRequest,
  onDraftChange,
  onSubmit,
  onDiscard,
  onArchive,
  onSaveAsNew,
  onDismissFailure,
  onBack,
  now,
}) {
  const refs = {
    heading: useRef(null),
    title: useRef(null),
    body: useRef(null),
    author: useRef(null),
    save: useRef(null),
    archive: useRef(null),
    alert: useRef(null),
  };
  useFocusRequest(focusRequest, refs);
  const archiveHintId = useId();
  const headingId = useId();
  const isCreate = mode === 'create';
  const locked = saving || archiving;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  }

  const saveLabel = isCreate ? 'Save note' : 'Save changes';
  const failureIsSave = failure && ['create', 'save'].includes(failure.action);
  const failureIsArchive = failure && failure.action === 'archive';

  return (
    <form className="sheet" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate aria-labelledby={headingId}>
      <SheetHeader
        eyebrow={<span id={headingId}>{isCreate ? 'New note' : 'Edit note'}</span>}
        headingRef={refs.heading}
        onBack={onBack}
      >
        {!isCreate ? (
          <>
            <Button
              ref={refs.archive}
              variant="secondary"
              size="sm"
              icon="archive"
              pending={archiving}
              pendingLabel="Archiving…"
              disabled={dirty || saving}
              aria-describedby={dirty ? archiveHintId : undefined}
              onClick={onArchive}
            >
              Archive
            </Button>
            <span id={archiveHintId} className="visually-hidden">
              Save or discard your changes before archiving.
            </span>
          </>
        ) : null}
      </SheetHeader>

      {failureIsArchive ? (
        <InlineAlert ref={refs.alert} tone="danger" title={failure.title} onDismiss={onDismissFailure}>
          {failure.detail}
        </InlineAlert>
      ) : null}

      <NoteMeta note={isCreate ? null : note} now={now} showAuthor={false} />

      <div className="sheet__fields">
        <Field
          ref={refs.title}
          id="note-title"
          className="field--title"
          label="Title"
          value={draft.title}
          onChange={(value) => onDraftChange('title', value)}
          error={errors.title}
          limit={NOTE_LIMITS.title}
          readOnly={locked}
          placeholder="e.g. Friday handover"
          autoComplete="off"
          required
        />
        <Field
          ref={refs.body}
          id="note-body"
          className="field--body"
          label="Note"
          multiline
          rows={12}
          value={draft.body}
          onChange={(value) => onDraftChange('body', value)}
          error={errors.body}
          limit={NOTE_LIMITS.body}
          readOnly={locked}
          placeholder="Write the note. Line breaks and indentation are kept exactly as typed."
          required
        />
        <Field
          ref={refs.author}
          id="note-author"
          className="field--author"
          label="Written by"
          value={draft.author}
          onChange={(value) => onDraftChange('author', value)}
          error={errors.author}
          limit={NOTE_LIMITS.author}
          readOnly={locked}
          placeholder="Your name"
          autoComplete="name"
          required
        />
      </div>

      <div className="sheet__footer">
        {failureIsSave ? (
          <InlineAlert
            ref={refs.alert}
            tone="danger"
            title={failure.title}
            onDismiss={onDismissFailure}
            actions={
              failure.missing ? (
                <Button size="sm" variant="secondary" icon="plus" onClick={onSaveAsNew}>
                  Save as a new note
                </Button>
              ) : null
            }
          >
            {failure.detail}
          </InlineAlert>
        ) : null}
        <div className="action-bar">
          <Button
            ref={refs.save}
            type="submit"
            variant="primary"
            icon="check"
            pending={saving}
            pendingLabel="Saving…"
            disabled={(!dirty && !isCreate) || archiving}
          >
            {saveLabel}
          </Button>
          {dirty || isCreate ? (
            <Button variant="ghost" onClick={onDiscard} disabled={saving}>
              {isCreate ? 'Cancel' : 'Discard changes'}
            </Button>
          ) : null}
          <span className="action-bar__status">
            {dirty ? (
              <>
                <span className="dot" aria-hidden="true" /> Unsaved changes
              </>
            ) : savedMessage ? (
              <>
                <Icon name="check" size={16} /> {savedMessage}
              </>
            ) : null}
          </span>
          <span className="action-bar__shortcut" aria-hidden="true">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save
          </span>
        </div>
      </div>
    </form>
  );
}

/** Read-only view of an archived note with Restore. */
export function NoteReader({ note, restoring, failure, notice, focusRequest, onRestore, onDismissFailure, onBack, now }) {
  const refs = { heading: useRef(null), archive: useRef(null), alert: useRef(null) };
  useFocusRequest(focusRequest, refs);

  return (
    <article className="sheet sheet--reader" aria-labelledby="reader-title">
      <SheetHeader
        eyebrow="Archived note"
        badge={<span className="badge">Read-only</span>}
        headingRef={refs.heading}
        onBack={onBack}
      >
        <Button
          ref={refs.archive}
          variant="secondary"
          size="sm"
          icon="restore"
          pending={restoring}
          pendingLabel="Restoring…"
          onClick={onRestore}
        >
          Restore
        </Button>
      </SheetHeader>

      {failure ? (
        <InlineAlert ref={refs.alert} tone="danger" title={failure.title} onDismiss={onDismissFailure}>
          {failure.detail}
        </InlineAlert>
      ) : notice ? (
        <InlineAlert tone="success">{notice}</InlineAlert>
      ) : null}

      <h3 className="reader__title" id="reader-title">
        {note.title}
      </h3>
      <NoteMeta note={note} now={now} />
      <div className="reader__body">{note.body}</div>
    </article>
  );
}
