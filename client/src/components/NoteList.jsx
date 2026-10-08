import { formatAbsolute, formatRelative, highlightParts, matchExcerpt } from '../notes/format.js';
import { Button } from './Button.jsx';
import { EmptyState } from './EmptyState.jsx';
import { InlineAlert } from './InlineAlert.jsx';

function Highlight({ text, query }) {
  return highlightParts(text, query).map((part, index) =>
    part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
  );
}

export function NoteListItem({ note, query, selected, onSelect, now }) {
  return (
    <li className="note-row">
      <button
        type="button"
        className="note-row__button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(note)}
      >
        <span className="note-row__title">
          <Highlight text={note.title} query={query} />
        </span>
        <span className="note-row__excerpt">
          <Highlight text={matchExcerpt(note.body, query)} query={query} />
        </span>
        <span className="note-row__meta">
          <span className="note-row__author">{note.author}</span>
          <span aria-hidden="true"> · </span>
          <time dateTime={note.updatedAt} title={`Updated ${formatAbsolute(note.updatedAt)}`}>
            <span className="visually-hidden">updated </span>
            {formatRelative(note.updatedAt, now)}
          </time>
        </span>
      </button>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="note-list note-list--skeleton" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="note-row note-row--skeleton">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--meta" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Presentational list of notes with its loading, empty and error states.
 *
 * States (derived from props, owned by the screen):
 * - initial load: `loading && !loaded`               -> skeleton rows
 * - first load failed: `error && !loaded`            -> error state + retry
 * - refresh failed: `error && loaded`                -> banner above kept rows
 * - refreshing: `loading && loaded`                  -> rows stay, aria-busy
 * - empty: `loaded && notes.length === 0`            -> copy depends on status/query
 */
export function NoteList({
  notes,
  status,
  query,
  selectedId,
  loaded,
  loading,
  error,
  onSelect,
  onRetry,
  onCreate,
  onClearSearch,
  onShowActive,
  now = Date.now(),
}) {
  if (!loaded && loading) {
    return (
      <div className="note-list-region">
        <p className="visually-hidden" role="status">
          Loading notes…
        </p>
        <SkeletonRows />
      </div>
    );
  }

  if (!loaded && error) {
    return (
      <div className="note-list-region">
        <EmptyState
          icon="alert"
          tone="danger"
          title={error.title}
          action={
            <Button variant="secondary" icon="restore" onClick={onRetry} pending={loading} pendingLabel="Retrying…">
              Try again
            </Button>
          }
        >
          <span role="alert">{error.detail}</span>
        </EmptyState>
      </div>
    );
  }

  const trimmed = query.trim();
  let empty = null;
  if (loaded && notes.length === 0) {
    if (trimmed) {
      empty = (
        <EmptyState
          icon="search"
          title={`No ${status} notes match “${trimmed}”`}
          action={
            <Button variant="secondary" onClick={onClearSearch}>
              Clear search
            </Button>
          }
        >
          Try a different word, or check the {status === 'active' ? 'Archived' : 'Active'} tab.
        </EmptyState>
      );
    } else if (status === 'archived') {
      empty = (
        <EmptyState
          icon="archive"
          title="Nothing archived"
          action={
            <Button variant="secondary" onClick={onShowActive}>
              Show active notes
            </Button>
          }
        >
          Archive notes you no longer need day to day. They stay searchable here and can be restored any time.
        </EmptyState>
      );
    } else {
      empty = (
        <EmptyState
          title="No notes yet"
          action={
            <Button variant="primary" icon="plus" onClick={onCreate}>
              Write the first note
            </Button>
          }
        >
          Capture handovers, meeting notes and checklists so the whole team can find them.
        </EmptyState>
      );
    }
  }

  return (
    <div className="note-list-region" aria-busy={loading || undefined}>
      {loading ? <div className="progress" aria-hidden="true" /> : null}
      {error ? (
        <InlineAlert
          tone="danger"
          className="note-list__alert"
          title={error.title}
          actions={
            <Button size="sm" variant="secondary" onClick={onRetry} pending={loading} pendingLabel="Retrying…">
              Try again
            </Button>
          }
        >
          {error.detail} Showing the last notes that loaded.
        </InlineAlert>
      ) : null}
      {empty ?? (
        <ul className="note-list">
          {notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              query={trimmed}
              selected={note.id === selectedId}
              onSelect={onSelect}
              now={now}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
