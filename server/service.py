"""Team Notes HTTP/SQLite service. Python standard library only."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import parse_qs, unquote, urlsplit

MAX_REQUEST_BYTES = 262144
LIMITS = {'title': 120, 'author': 80, 'body': 20000}


class ApiError(Exception):
    def __init__(self, status, code, message, fields=None):
        self.status = status
        self.payload = {'error': {'code': code, 'message': message}}
        if fields:
            self.payload['error']['fields'] = fields


def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def validate(data, partial=False):
    if not isinstance(data, dict) or not data:
        raise ApiError(400, 'validation_error', 'Provide a nonempty JSON object.')
    allowed = set(LIMITS) | ({'archived'} if partial else set())
    fields = {key: 'This field cannot be changed.' for key in data if key not in allowed}
    result = {}
    for key, limit in LIMITS.items():
        if partial and key not in data:
            continue
        value = data.get(key)
        if not isinstance(value, str):
            fields[key] = 'Enter text.'
            continue
        if key != 'body':
            value = value.strip()
        if not value.strip():
            fields[key] = 'This field is required.'
        elif len(value) > limit:
            fields[key] = f'Use at most {limit} characters.'
        else:
            result[key] = value
    if 'archived' in data and partial:
        if type(data['archived']) is not bool:
            fields['archived'] = 'Use true or false.'
        else:
            result['archived'] = int(data['archived'])
    if fields:
        raise ApiError(400, 'validation_error', 'Check the highlighted fields.', fields)
    return result


@contextmanager
def connection(path):
    db = sqlite3.connect(path, timeout=5)
    db.row_factory = sqlite3.Row
    db.create_function('contains_fold', 2, lambda text, query: query.casefold() in text.casefold(), deterministic=True)
    try:
        with db:
            yield db
    finally:
        db.close()


def bootstrap(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connection(path) as db:
        # A transaction guards schema detection and seeding against simultaneous startups.
        db.execute('BEGIN IMMEDIATE')
        pristine = not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchone()
        db.execute('''CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
            createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        )''')
        db.execute('CREATE INDEX IF NOT EXISTS notes_status_order ON notes(archived, updatedAt DESC, id DESC)')
        if pristine:
            stamp = now()
            db.executemany('INSERT INTO notes(title,body,author,createdAt,updatedAt) VALUES(?,?,?,?,?)', [
                ('Welcome to the fictional team', 'Share plans, decisions, and small discoveries here.\n\nAll examples are fictional.', 'Mira Example', stamp, stamp),
                ('Thursday studio check-in', 'Bring one idea for the imaginary launch.\nKeep the discussion brief and kind.', 'Rowan Demo', stamp, stamp),
            ])
        db.execute('PRAGMA user_version = 1')


def note_json(row):
    result = dict(row)
    result['archived'] = bool(result['archived'])
    return result


class NotesServer(ThreadingHTTPServer):
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format, *args):
        # Avoid logging request bodies or query contents.
        pass

    def send_error(self, code, message=None, explain=None):
        # Keep parser-level and unknown-method failures in the API error shape.
        if code == 501:
            code, error_code, message = 405, 'method_not_allowed', 'Method not allowed.'
        else:
            error_code = 'invalid_request'
            message = self.responses.get(code, ('Invalid request',))[0]
        self.close_connection = True
        self.send_json(code, {'error': {'code': error_code, 'message': message}})

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=True).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if getattr(self, 'command', None) != 'HEAD':
            self.wfile.write(body)

    def read_json(self):
        if self.headers.get('Transfer-Encoding'):
            raise ApiError(400, 'invalid_request', 'Transfer encoding is unsupported.')
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not re.fullmatch(r'[0-9]+', lengths[0]):
            raise ApiError(400, 'invalid_request', 'Provide one valid Content-Length.')
        length = int(lengths[0])
        if length > MAX_REQUEST_BYTES:
            raise ApiError(413, 'request_too_large', 'Request exceeds 262144 bytes.')
        if self.headers.get_content_type() != 'application/json':
            raise ApiError(415, 'unsupported_media_type', 'Use application/json.')
        try:
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError('Incomplete body')
            return json.loads(body.decode('utf-8'))
        except (ValueError, UnicodeError, RecursionError):
            raise ApiError(400, 'invalid_json', 'Provide valid UTF-8 JSON.') from None
        except TimeoutError:
            raise ApiError(408, 'request_timeout', 'Request body timed out.') from None

    def route(self):
        url = urlsplit(self.path)
        path = url.path
        with connection(self.server.db_path) as db:
            if path == '/api/health' and self.command == 'GET':
                db.execute('SELECT id FROM notes LIMIT 1').fetchone()
                return self.send_json(200, {'status': 'ready'})
            if path == '/api/notes' and self.command == 'GET':
                try:
                    params = parse_qs(url.query, keep_blank_values=True, max_num_fields=16)
                except ValueError:
                    raise ApiError(400, 'invalid_query', 'Too many query parameters.') from None
                status = params.get('status', ['active'])[0]
                if status not in ('active', 'archived'):
                    raise ApiError(400, 'validation_error', 'Use active or archived status.', {'status': 'Use active or archived.'})
                query = params.get('q', [''])[0]
                rows = db.execute('''SELECT * FROM notes WHERE archived=?
                    AND (contains_fold(title, ?) OR contains_fold(body, ?))
                    ORDER BY updatedAt DESC, id DESC''', (int(status == 'archived'), query, query)).fetchall()
                return self.send_json(200, {'notes': [note_json(row) for row in rows]})
            if path == '/api/notes' and self.command == 'POST':
                data = validate(self.read_json())
                stamp = now()
                cursor = db.execute('INSERT INTO notes(title,body,author,createdAt,updatedAt) VALUES(?,?,?,?,?)',
                                    (data['title'], data['body'], data['author'], stamp, stamp))
                result = note_json(db.execute('SELECT * FROM notes WHERE id=?', (cursor.lastrowid,)).fetchone())
                db.commit()
                return self.send_json(201, {'note': result})
            match = re.fullmatch(r'/api/notes/([0-9]+)', path)
            if match and self.command == 'PATCH':
                # SQLite IDs are signed 64-bit integers; larger identifiers are simply absent.
                number = match[1]
                if len(number) > 19 or int(number) > 9223372036854775807:
                    raise ApiError(404, 'not_found', 'Note not found.')
                note_id = int(number)
                data = validate(self.read_json(), partial=True)
                data['updatedAt'] = now()
                columns = ', '.join(f'{key}=?' for key in data)  # keys are validated constants
                cursor = db.execute(f'UPDATE notes SET {columns} WHERE id=?', (*data.values(), note_id))
                if cursor.rowcount != 1:
                    raise ApiError(404, 'not_found', 'Note not found.')
                result = note_json(db.execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone())
                db.commit()
                return self.send_json(200, {'note': result})
        if path.startswith('/api/'):
            if path in ('/api/notes', '/api/health') or match:
                raise ApiError(405, 'method_not_allowed', 'Method not allowed.')
            raise ApiError(404, 'not_found', 'Endpoint not found.')
        if self.command != 'GET':
            raise ApiError(405, 'method_not_allowed', 'Method not allowed.')
        return self.serve_static(path)

    def serve_static(self, path):
        root = self.server.static_dir
        if root is None:
            raise ApiError(404, 'not_found', 'Page not found.')
        decoded = unquote(path)
        if '\x00' in decoded or '\\' in decoded or '..' in decoded.split('/'):
            raise ApiError(404, 'not_found', 'Page not found.')
        target = (root / decoded.lstrip('/')).resolve()
        if not target.is_relative_to(root):
            raise ApiError(404, 'not_found', 'Page not found.')
        if not target.is_file() and not Path(decoded).suffix:
            target = (root / 'index.html').resolve()
        if not target.is_relative_to(root) or not target.is_file():
            raise ApiError(404, 'not_found', 'Page not found.')
        body = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if getattr(self, 'command', None) != 'HEAD':
            self.wfile.write(body)

    def dispatch(self):
        try:
            self.route()
        except ApiError as error:
            self.send_json(error.status, error.payload)
        except sqlite3.Error:
            self.send_json(503, {'error': {'code': 'storage_unavailable', 'message': 'Storage is unavailable. Try again.'}})
        except (ValueError, OSError):
            self.send_json(400, {'error': {'code': 'invalid_request', 'message': 'Request could not be processed.'}})

    do_GET = do_POST = do_PATCH = do_DELETE = do_PUT = do_OPTIONS = do_HEAD = dispatch


def create_server(host, port, db_path, static_dir=None):
    db_path = Path(db_path).expanduser().resolve()
    bootstrap(db_path)
    server = NotesServer((host, port), Handler)
    server.db_path = db_path
    server.static_dir = Path(static_dir).resolve() if static_dir else None
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default=os.getenv('NOTES_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.getenv('NOTES_PORT', '8000')))
    parser.add_argument('--db', default=os.getenv('NOTES_DB_PATH', str(Path.home() / '.local/share/team-notes/notes.sqlite3')))
    parser.add_argument('--static-dir', default=os.getenv('NOTES_STATIC_DIR'))
    args = parser.parse_args()
    server = create_server(args.host, args.port, args.db, args.static_dir)
    print(f'Team Notes listening on {args.host}:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
