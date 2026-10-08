# Team Notes API and service composition

Python 3.10+; standard library only. Run from repository root:

```sh
python3 -m server.service --host 127.0.0.1 --port 8000 --db /tmp/team-notes-dev/notes.sqlite3
python3 -m unittest discover -v
```

For a retained application database, use an absolute writable path outside tracked source, for example `/home/kandev/.local/share/team-notes/notes.sqlite3`. Preserve that path across restarts. The service creates parent directories and schema automatically. Two fictional examples are inserted only when the database has no application tables; an existing empty notes table is never reseeded. Bootstrap is transactional and schema version is `PRAGMA user_version=1`. No external database or runtime packages are required.

Flags override environment variables: `NOTES_HOST` (default `127.0.0.1`), `NOTES_PORT` (default `8000`), `NOTES_DB_PATH` (default `~/.local/share/team-notes/notes.sqlite3`), `NOTES_STATIC_DIR` (unset by default). Stop with Ctrl-C or SIGTERM; committed SQLite data survives both. Integration Builder owns final command/port/process supervision and retained preview.

Integration can either proxy `/api` from Vite to this service during development, or build the Designer-owned client and start:

```sh
python3 -m server.service --host 127.0.0.1 --port 8000 --db /absolute/runtime/notes.sqlite3 --static-dir client/dist
```

The backend does not build the frontend. Static serving confines resolved paths and symlinks to the configured directory, rejects parent traversal, serves existing assets with MIME types, and returns `index.html` for extensionless SPA routes. Missing assets return 404. API paths take priority. Use same-origin requests; CORS is not enabled. Bind to `0.0.0.0` only when the integration environment needs remote access. This is a small trusted-team service with no login or production TLS implementation.

## Data and validation

Each note has integer `id`, strings `title`, `body`, `author`, boolean `archived`, and UTC ISO strings `createdAt` and `updatedAt` ending in `Z`.

- `title` and `author` are required, trimmed and limited to 120 and 80 Unicode characters respectively.
- `body` is required and must contain non-whitespace text, with at most 20,000 Unicode characters. Its submitted formatting and surrounding whitespace are preserved.
- POST accepts only `title`, `body`, `author`; it creates an active note. PATCH accepts any nonempty subset of those fields and `archived` (strict JSON boolean).
- Unknown and read-only fields are rejected. An entire mutation is validated before its atomic write; rejected mutations leave all persisted fields and timestamps unchanged.

## Endpoints

| Method and path | Behavior | Success |
| --- | --- | --- |
| `GET /api/health` | Database query verifies readiness | `200 {"status":"ready"}` |
| `GET /api/notes?status=active&q=launch` | Status defaults active; supports active or archived. Literal Unicode case-insensitive substring search over title/body. Empty q matches all. Order updatedAt descending, then id descending. | `200 {"notes":[...]}` |
| `POST /api/notes` | Create required editable fields | `201 {"note":{...}}` |
| `PATCH /api/notes/:id` | Update supplied editable fields; archive/restore using true/false | `200 {"note":{...}}` |

Missing notes return 404. Missing routes return 404; unsupported methods on recognized API routes return 405. GET does not mutate data. PATCH preserves createdAt and refreshes updatedAt. No delete endpoint, authentication, realtime, attachments, rich text, or external services.

Send `Content-Type: application/json` and exactly one valid `Content-Length` on mutations. Maximum JSON body size is 262,144 bytes (413 on larger bodies); transfer encoding is unsupported. Connections have a 10-second timeout; timed-out body parsing returns 408. Malformed JSON/invalid input returns 400; wrong content type returns 415. Query parsing allows at most 16 fields. Request targets are also bounded by the standard-library HTTP parser. SQL values are bound parameters; wildcard characters in search are literal.

Errors have this shape; `fields` is optional and maps field names to useful text:

```json
{"error":{"code":"validation_error","message":"Check the highlighted fields.","fields":{"title":"This field is required."}}}
```

Other codes include `invalid_json`, `invalid_request`, `invalid_query`, `not_found`, `method_not_allowed`, `request_too_large`, `request_timeout`, and `unsupported_media_type`. SQLite failures return 503 `storage_unavailable` with retry guidance, without exposing database internals. Clients should retain drafts and loaded content on failed requests and reuse the Designer's error presentation.

## Reproducible functional and restart checks

`python3 -m unittest discover -v` runs real loopback HTTP against temporary file-backed SQLite databases. It checks create/edit/archive/restore, trimming and body formatting, search/filter/order, field limits and failed-validation integrity, malformed/bounded requests, missing records, readiness, safe static paths, seeding, and a forced SQLite failure with a successful retry.

The restart test releases its local server, starts `python3 -m server.service` as a separate process, creates and archives a fictional record, captures the active list, sends SIGTERM and waits for process termination, then starts a new process on the same database and port. It verifies the unchanged active list (no duplicate seeds), exact archived record including timestamps and flag, and successful restore. Both processes are stopped and reaped; temporary files are removed. Browser coverage is inapplicable to this backend prerequisite; independent Verifier must run service checks on the handed-off revision. These backend checks do not certify the future integrated UI.
