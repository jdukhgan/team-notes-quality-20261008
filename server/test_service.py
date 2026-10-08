from contextlib import closing
import http.client
import json
from pathlib import Path
import subprocess
import sqlite3
import sys
import tempfile
import threading
import time
import unittest

from server.service import create_server


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / 'notes.sqlite3'
        self.httpd = create_server('127.0.0.1', 0, self.db)
        self.thread = threading.Thread(target=self.httpd.serve_forever)
        self.thread.start()
        self.port = self.httpd.server_port

    def tearDown(self):
        self.httpd.shutdown()
        self.thread.join()
        self.httpd.server_close()
        self.tmp.cleanup()

    def request(self, method, path='/api/notes', data=None, raw=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        body = json.dumps(data) if data is not None else raw
        conn.request(method, path, body, headers or {'Content-Type': 'application/json'})
        response = conn.getresponse()
        payload = response.read()
        conn.close()
        return response.status, json.loads(payload)

    def create(self, **changes):
        data = dict(title='  Fictional launch  ', body='First line\n\n  Second line  ', author='  Mira Example  ')
        data.update(changes)
        status, payload = self.request('POST', data=data)
        self.assertEqual(status, 201, payload)
        return payload['note']

    def test_create_edit_archive_restore_and_search(self):
        note = self.create()
        self.assertIs(type(note['id']), int)
        self.assertEqual(note['title'], 'Fictional launch')
        self.assertEqual(note['author'], 'Mira Example')
        self.assertEqual(note['body'], 'First line\n\n  Second line  ')
        self.assertFalse(note['archived'])
        self.assertTrue(note['createdAt'].endswith('Z'))
        status, result = self.request('PATCH', f"/api/notes/{note['id']}", dict(body='New fictional text', archived=True))
        self.assertEqual(status, 200)
        self.assertEqual(result['note']['createdAt'], note['createdAt'])
        self.assertGreater(result['note']['updatedAt'], note['updatedAt'])
        self.assertEqual(self.request('GET', '/api/notes?q=NEW%20FICTIONAL')[1]['notes'], [])
        self.assertEqual(self.request('GET', '/api/notes?status=archived&q=NEW%20FICTIONAL')[1]['notes'], [result['note']])
        self.assertEqual(self.request('PATCH', f"/api/notes/{note['id']}", dict(archived=False))[0], 200)
        self.assertEqual(self.request('GET', '/api/notes?q=launch')[1]['notes'][0]['id'], note['id'])

    def test_validation_and_failed_write_integrity(self):
        note = self.create()
        invalid = [dict(title=' '), dict(author=''), dict(body='\n '), dict(title='x'*121), dict(author='x'*81), dict(body='x'*20001), dict(archived=1), dict(id=12), dict(body=None), {}, []]
        for change in invalid:
            with self.subTest(change=str(change)[:50]):
                status, error = self.request('PATCH', f"/api/notes/{note['id']}", change)
                self.assertEqual(status, 400)
                self.assertIn('code', error['error'])
                current = self.request('GET', '/api/notes?q=Fictional%20launch')[1]['notes'][0]
                self.assertEqual(current, note)
        before = self.request('GET')[1]
        self.assertEqual(self.request('POST', data=dict(title='ok', body='ok'))[0], 400)
        self.assertEqual(self.request('GET')[1], before)

    def test_search_is_literal_unicode_and_ordering(self):
        first = self.create(title="100% Straße ' OR 1=1 --", body='fictional')
        second = self.create(title='Another', body='literal_under_score')
        self.assertEqual(self.request('GET', '/api/notes?q=STRASSE')[1]['notes'], [first])
        self.assertEqual(self.request('GET', '/api/notes?q=%25')[1]['notes'], [first])
        self.assertEqual(self.request('GET', '/api/notes?q=_')[1]['notes'], [second])
        self.assertEqual([n['id'] for n in self.request('GET')[1]['notes'][:2]], [second['id'], first['id']])

    def test_missing_malformed_bounded_requests_and_health(self):
        self.assertEqual(self.request('GET', '/api/health'), (200, {'status': 'ready'}))
        self.assertEqual(self.request('PATCH', '/api/notes/99999', dict(title='Missing'))[0], 404)
        self.assertEqual(self.request('GET', '/api/notes?status=other')[0], 400)
        self.assertEqual(self.request('POST', raw='{')[0], 400)
        self.assertEqual(self.request('POST', raw='x'*262145)[0], 413)
        self.assertEqual(self.request('POST', raw='{}', headers={'Content-Type':'text/plain'})[0], 415)
        self.assertEqual(self.request('DELETE')[0], 405)
        self.assertEqual(self.request('TRACE')[0], 405)
        self.assertEqual(self.request('GET', '/api/unknown')[0], 404)

    def test_database_failure_rolls_back_and_can_retry(self):
        note = self.create()
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("CREATE TRIGGER reject_update BEFORE UPDATE ON notes BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        status, result = self.request('PATCH', f"/api/notes/{note['id']}", dict(title='Changed'))
        self.assertEqual(status, 503)
        self.assertEqual(result['error']['code'], 'storage_unavailable')
        self.assertEqual(self.request('GET', '/api/notes?q=Fictional%20launch')[1]['notes'], [note])
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('DROP TRIGGER reject_update')
        self.assertEqual(self.request('PATCH', f"/api/notes/{note['id']}", dict(title='Retry succeeds'))[0], 200)

    def test_limits_and_empty_database_not_reseeded(self):
        note = self.create(title='x'*120, author='x'*80, body='x'*20000)
        self.assertEqual(len(note['body']), 20000)
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('DELETE FROM notes')
        from server.service import bootstrap
        bootstrap(self.db)
        self.assertEqual(self.request('GET')[1]['notes'], [])

    def test_safe_static_serving(self):
        root = Path(self.tmp.name) / 'dist'
        root.mkdir()
        (root / 'index.html').write_text('<h1>Fictional app</h1>')
        (Path(self.tmp.name) / 'secret.txt').write_text('private')
        (root / 'leak.txt').symlink_to(Path(self.tmp.name) / 'secret.txt')
        other = create_server('127.0.0.1', 0, self.db, root)
        thread = threading.Thread(target=other.serve_forever)
        thread.start()
        try:
            for path, status in [('/', 200), ('/notes/42', 200), ('/%2e%2e/secret.txt', 404), ('/leak.txt', 404), ('/missing.js', 404)]:
                conn = http.client.HTTPConnection('127.0.0.1', other.server_port)
                conn.request('GET', path)
                response = conn.getresponse()
                self.assertEqual(response.status, status, path)
                response.read()
                conn.close()
        finally:
            other.shutdown()
            thread.join()
            other.server_close()

    def test_real_stop_restart_preserves_records_and_seed_count(self):
        # Release in-process server before starting the real command on its port.
        self.httpd.shutdown()
        self.thread.join()
        self.httpd.server_close()
        def start():
            process = subprocess.Popen([sys.executable, '-m', 'server.service', '--host', '127.0.0.1', '--port', str(self.port), '--db', str(self.db)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        self.fail(process.stderr.read().decode())
                    try:
                        if self.request('GET', '/api/health')[0] == 200:
                            return process
                    except OSError:
                        time.sleep(.02)
                self.fail('Service never became ready')
            except BaseException:
                process.terminate()
                process.wait(timeout=5)
                process.stderr.close()
                raise
        def stop(process):
            process.terminate()
            process.wait(timeout=5)
            process.stderr.close()
        process = start()
        try:
            note = self.create(title='Restart evidence')
            archived = self.request('PATCH', f"/api/notes/{note['id']}", dict(archived=True))[1]['note']
            before = self.request('GET')[1]
        finally:
            stop(process)
        process = start()
        try:
            self.assertEqual(self.request('GET')[1], before)
            self.assertEqual(self.request('GET', '/api/notes?status=archived')[1]['notes'], [archived])
            self.assertEqual(self.request('PATCH', f"/api/notes/{note['id']}", dict(archived=False))[0], 200)
        finally:
            stop(process)


if __name__ == '__main__':
    unittest.main()
