# Team Notes Quality

A shared notebook for a fictional team. Create and edit notes, search titles and
bodies, and archive or restore notes. React components follow the Designer's
[UI contract](docs/ui-contract.md); the Python standard-library service stores
notes in SQLite and serves the production client from the same origin.

Requires Python 3.10+ and Node ^22.13 or >=24 with npm. From the repository root:

```sh
bash scripts/build.sh
bash scripts/start.sh --host 127.0.0.1 --port 8000 --db /absolute/path/notes.sqlite3
```

Open http://127.0.0.1:8000. Keep the same DB path across restarts. Stop with
Ctrl-C or SIGTERM, wait for the process to exit, then repeat the start command.
Do not remove the DB to restart. Fictional initial notes seed once on a pristine
database. The database should live outside tracked source.

For development, start the API on port 8000, then run `npm run dev` in `client`.
`NOTES_API_ORIGIN` overrides Vite's API proxy target. The shipped application
always uses the real API; fixture adapters remain available to component tests.

```sh
cd client
npm test
npm run build
cd ..
python3 -m unittest discover -v
```

Tests cover validation, failure recovery, duplicate prevention, stale lists,
HTTP mapping, API operations, safe static serving and actual stop/restart
persistence. Browser verification must additionally inspect the production UI.

## Retained project preview

On the recorded worker `agteamnotes-quality01` (`192.168.1.78`), this integration
checkout serves http://192.168.1.78:8017. Health: `/api/health`.
The preview uses the ignored `runtime/notes.sqlite3` in this task checkout,
preserved across server restarts. It contains fictional notes only.

Start/restart from this checkout:

```sh
bash scripts/start.sh --host 0.0.0.0 --port 8017 --db "$PWD/runtime/notes.sqlite3"
python3 /home/kandev/.local/share/jlab/project-kit/preview_check.py http://192.168.1.78:8017/api/health
```

The task handoff records the retained process session and exact revision. Stop
that session with Ctrl-C (or SIGTERM its verified `server.service` process) and
confirm termination before restarting. Keep the DB for inspection. Preview
cleanup stops the process; remove `runtime/` only when its data is no longer
needed. This preview does not publish code to main or configure a shared domain.

See [API operations and configuration](docs/api-contract.md).
