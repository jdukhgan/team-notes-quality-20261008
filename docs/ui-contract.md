# Team Notes — UI contract

Owner: UI Designer (`client/**`, this file). API wiring and persistence: Builder. Startup/build composition: Integration Builder.
This file is the project's design authority. Code is the source of truth for values: `client/src/styles/tokens.css` (tokens) and `client/src/notes/constraints.js` (field rules).

## 1. Visual direction: "quiet notebook"

Team Notes is a shared notebook for a small team, used for handovers, retros and checklists. People skim the list, then read or edit one note. The design keeps the content in front:

- **Surfaces:** warm paper background (`--color-bg`) with the active note on a raised "sheet" (`--color-surface`, `--shadow-md`). On phones the sheet fills the screen.
- **Type:** serif titles (`--font-serif`) give notes a document feel. All controls and body text use the system sans (`--font-sans`). Note bodies use `--leading-relaxed` and keep whitespace with `white-space: pre-wrap`.
- **Colour:** one deep teal accent (`--color-accent`) is used only for primary actions, selection and focus. Danger red is used only for errors. Text colours meet WCAG AA (≥ 4.5:1) and input borders ≥ 3:1 against their surfaces in both themes.
- **Density:** list rows show a 2-line title, a 2-line excerpt and one meta line, so about 6 notes fit on a laptop screen.
- No external fonts, images or services.

## 2. Tokens (`client/src/styles/tokens.css`)

| Group | Tokens |
| --- | --- |
| Colour | `--color-bg`, `surface`, `surface-raised`, `surface-sunken`, `surface-hover`, `border`, `border-strong`, `text`, `text-muted`, `text-subtle`, `accent`, `accent-hover`, `accent-contrast`, `accent-soft`, `accent-soft-text`, `selected`, `danger`, `danger-soft`, `danger-border`, `success`, `success-soft`, `warning`, `mark-bg`, `mark-text`, `focus`, `focus-halo`, `backdrop` |
| Type | `--font-sans`, `--font-serif`, `--font-mono`; `--text-xs`(12) `sm`(14) `md`(16) `lg`(18) `xl`(24) `2xl`(30); `--leading-tight/normal/relaxed`; `--weight-regular/medium/semibold` |
| Space | `--space-1`…`--space-12` (4px base) |
| Shape | `--radius-sm`(6) `md`(10) `lg`(14) `pill`; `--shadow-sm/md/lg` |
| Layout | `--header-height`, `--list-pane-width`, `--sheet-max-width`, `--control-height`(40px), `--tap-target`(44px) |
| Motion | `--duration-fast/normal`, `--ease-standard`; set to 0 under `prefers-reduced-motion` |

**Themes:** `<html data-theme="light|dark">` is always set. Before first paint, an inline script in `index.html` sets it in this order: the `?theme=` URL parameter, then the stored choice (`localStorage['team-notes-theme']`), then `prefers-color-scheme`. `useTheme()` keeps it in sync, and the header toggle stores an explicit choice. Components use only the `--color-*` tokens; no component contains literal colour values.

**Layouts** (`client/src/styles/layout.css`):
- desktop, ≥ 64rem: list pane 24rem plus a centred sheet (max 46rem)
- tablet, 48–64rem: list pane 19.5rem plus the sheet, with tighter padding
- phone, < 48rem: one pane at a time (`.app[data-pane=list|detail]`), an "All notes" back button, full-bleed sheet, a sticky full-width Save and 44px tap targets

## 3. Field rules (`client/src/notes/constraints.js`)

These match the API contract and must stay in sync with `server/**`.

| Field | Rule | Message |
| --- | --- | --- |
| title | required after trim, ≤ 120 code points (trimmed) | "Add a title." / "Keep the title to 120 characters or fewer." |
| body | must contain non-whitespace, ≤ 20,000 code points, **stored exactly as typed** | "Write something in the note." / "Keep the note to 20,000 characters or fewer." |
| author | required after trim, ≤ 80 code points (trimmed) | "Add who wrote this note." / "Keep the author name to 80 characters or fewer." |

- Length is counted in Unicode code points (`charCount`), which matches Python `len()`.
- Inputs have no `maxLength`, so pasted text is never silently cut off. Over-limit text shows a red counter and an inline error instead.
- `normalizeDraft()` trims title and author only.
- `compareNotes()` sorts by `updatedAt` descending, then `id` descending.

## 4. Component catalogue (`client/src/components/`)

All components are presentational and controlled. None of them fetch data or hold business state.

| Component | Key props | Owns |
| --- | --- | --- |
| `Button` | `variant` primary/secondary/ghost/danger, `size` md/sm, `icon`, `iconOnly`, `pending`, `pendingLabel`, `disabled` | Uses `aria-disabled` rather than `disabled`, so focus stays on the button while it is locked. Clicks are swallowed while pending or disabled. |
| `Field` | `label`, `value`, `onChange(value)`, `error`, `hint`, `limit`, `multiline`, `readOnly`, `ref` | Label, counter, and the `aria-invalid` / `aria-describedby` wiring for error and limit text |
| `SearchField` | `value`, `onChange`, `busy` | Clear button; Escape clears the search |
| `StatusFilter` | `value` active/archived, `onChange` | Native radio group (arrow keys work) |
| `NoteList` / `NoteListItem` | `notes`, `status`, `query`, `selectedId`, `loaded`, `loading`, `error`, `onSelect`, `onRetry`, `onCreate`, `onClearSearch`, `onShowActive` | Skeleton, first-load error, refresh-error banner, three empty states, `<mark>` search highlighting, `aria-current` on the selected row |
| `NoteEditor` | `mode` create/edit, `note`, `draft`, `errors`, `dirty`, `saving`, `archiving`, `failure`, `savedMessage`, `focusRequest`, `onDraftChange(field, value)`, `onSubmit`, `onDiscard`, `onArchive`, `onSaveAsNew`, `onDismissFailure`, `onBack` | Form layout, refs, Ctrl/⌘+Enter to save, sticky action bar |
| `NoteReader` | `note`, `restoring`, `failure`, `notice`, `focusRequest`, `onRestore`, `onDismissFailure`, `onBack` | Read-only view of an archived note |
| `NoteSheetPlaceholder` | `hasNotes` | Shown on wide layouts when nothing is selected |
| `InlineAlert` | `tone` danger/success/info, `title`, `actions`, `onDismiss` | `role="alert"` for danger, `role="status"` otherwise |
| `EmptyState`, `ConfirmDialog` (native `<dialog>`), `ThemeToggle` + `useTheme`, `Icon`, `Spinner` | — | — |

`focusRequest` is `{ target, nonce }`. Targets are `heading`, `title`, `body`, `author`, `save`, `archive` and `alert`. Each nonce is applied once.

## 5. State ownership: `client/src/notes/NotesScreen.jsx`

`NotesScreen({ api, theme, onToggleTheme })` is the only stateful container. It owns:
- status filter, search query (debounced 250 ms), and list `{ notes, loaded, loading, error, status }`
- selection mode (`none | create | edit | view`), the current note snapshot, `draft`, `baseline`, and `dirty` (draft ≠ baseline)
- `saving` / `archiving` flags, mirrored in refs as synchronous duplicate guards
- `failure`, `focusRequest`, the narrow-layout `pane`, the discard-confirm dialog, and a polite live-region announcement

The Builder should not add a second state store or a second error presentation. Integration only means passing a real `api`.

## 6. API adapter contract (`client/src/notes/api.js`)

```js
listNotes({ status: 'active'|'archived', q: string, signal: AbortSignal }) -> Promise<Note[]>
createNote({ title, body, author })                                      -> Promise<Note>
updateNote(id, patch /* any of title, body, author, archived */)          -> Promise<Note>
```

The HTTP adapter (Builder) must:
- Call `GET /api/notes?status=&q=`, `POST /api/notes`, and `PATCH /api/notes/:id`, and unwrap `{notes}` / `{note}`.
- Throw `new NotesApiError({ status, code, message, fields })` for non-2xx responses, reading `{error:{code,message,fields?}}`.
- Use `status: 0` for network or offline failures.
- Re-throw `AbortError` unchanged, because the screen aborts out-of-date list requests.
- Not retry automatically or show its own UI.

The screen sends only changed fields on save. Archive and restore send exactly `{ archived: true|false }`.

`describeFailure(action, error)` turns errors into copy:

| Case | Title | Detail | Behaviour |
| --- | --- | --- | --- |
| 400 + `fields` | "Couldn't save your changes." / "Couldn't create the note." | "Some fields need attention…" | Field errors shown inline; focus moves to the first invalid field |
| 404 on save/archive | same | "This note no longer exists…" | Draft kept; "Save as a new note" offered |
| status 0 (network) | per action | "Your draft is still here. Check your connection, then try again." (save) / "Nothing was changed. …" (archive/restore) | Controls unlock; retry with the same button |
| 5xx / other | per action | "…The notes service had a problem. Try again in a moment." | same |

## 7. Interaction contract

- **Pending:** Save shows "Saving…" with a spinner. Archive and Restore show "Archiving…" / "Restoring…". The pending button is `aria-disabled` and `aria-busy`, and fields become `readOnly`. Refs block repeat clicks, Enter and Ctrl+Enter, so only one request is ever made.
- **Failed save** (create or edit): the draft stays in the form exactly as typed and the list is unchanged. A danger alert appears directly above the action bar. Controls unlock and focus returns to **Save**, which is the retry. The alert can be dismissed.
- **Failed archive/restore:** the note and list are unchanged. A danger alert appears under the sheet header and focus returns to the **Archive/Restore** button.
- **Successful archive:** the note leaves the Active list. The sheet becomes the read-only archived view with a success notice, and focus stays in place on the new **Restore** button, which acts as undo. Restore reverses this.
- **Archive while there are unsaved edits** is blocked: the button is disabled and explains "Save or discard your changes before archiving." Archived notes are read-only until restored.
- **List load:** the first load shows a skeleton. If it fails, an error state with "Try again" appears. If a later refresh fails (for example, a search), the last notes stay visible under a danger banner with "Try again". Switching between the Active and Archived tabs never shows the other tab's notes. A search announces its match count politely.
- **Leaving unsaved edits:** selecting another note or "New note" opens "Discard unsaved changes?" with **Keep editing** focused. Unloading the page triggers `beforeunload`. Pressing "All notes" on a phone keeps the draft.
- **Validation:** runs on submit and then updates live. Focus moves to the first invalid field in the order title → body → author, and the error text is part of the field's accessible description.
- **Keyboard:** skip link to search; every control is reachable in a logical tab order; visible 2px focus ring with halo; Escape clears search and closes dialogs; Ctrl/⌘+Enter saves.

## 8. Fixtures and reference screen

`npm run dev` in `client/` starts the reference screen, backed by `createFixtureClient()` with fictional café-team notes. URL parameters:

| Parameter | Effect |
| --- | --- |
| `?scenario=populated` (default) | 7 active and 3 archived notes, including long, short (`Q`) and formatted content |
| `?scenario=empty` | no notes |
| `?scenario=loading` | list never resolves (skeleton) |
| `?scenario=list-error` | first list load fails (network) |
| `?scenario=save-error` | next save fails once (503), so the retry succeeds |
| `?scenario=archive-error` | next archive/restore fails once (network) |
| `?scenario=missing-note` | next update returns 404 |
| `?latency=ms` | simulated latency (default 450) |
| `?theme=light\|dark` | force theme |
| `?devtools=1` | floating fixture panel to toggle failures and latency live |

## 9. Integration steps (Builder)

1. Add `client/src/notes/httpClient.js` that exports `createHttpClient()` and implements §6.
2. In `client/src/main.jsx`, render `<App api={createHttpClient()} />`. `App` skips fixtures when `api` is given. Keep fixture mode available for tests and demos, for example behind `?fixtures=1`.
3. Development proxy: `vite.config.js` proxies `/api` to `NOTES_API_ORIGIN` (default `http://127.0.0.1:8000`). Adjust as needed. Production serving belongs to the Integration Builder.
4. Keep `NOTE_LIMITS` equal to the server limits. If a limit changes, update both sides.
5. Run `npm test` and `npm run build` in `client/`.
6. The Designer's final visual verdict is given on the integrated revision, through this design card.

## 10. Out of scope

Login, realtime updates, attachments, rich text, and external fonts or services.
