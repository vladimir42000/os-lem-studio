"""Start an isolated real backend, exercise the frontend runner, then stop it."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
url = f'http://127.0.0.1:{port}'
server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'server:app', '--app-dir', str(root / 'backend'), '--host', '127.0.0.1', '--port', str(port)], cwd=root)
try:
    for _ in range(100):
        if server.poll() is not None:
            raise RuntimeError('Backend exited before becoming ready')
        try:
            with urllib.request.urlopen(url + '/openapi.json', timeout=1):
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Backend did not become ready')
    subprocess.run(['node', 'scripts/test-workflow.mjs'], cwd=root, env={**os.environ, 'STUDIO_TEST_BACKEND_URL':url+'/api/simulate'}, check=True)
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
