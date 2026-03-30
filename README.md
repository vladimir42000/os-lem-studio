# os-lem Studio

React/Vite frontend + FastAPI backend adapter for os-lem.

## Quick start

Assumptions:
- you are in the repository root
- Python virtual environment is available at `venv/`
- Node dependencies are installed under `frontend/`
- the os-lem package is available in the active Python environment

## Backend startup

Activate the Python environment, then start the backend:

```bash
source venv/bin/activate
cd backend
python server.py
```

Backend endpoint:
- `http://localhost:8000/api/simulate`

## Frontend startup

From the repository root:

```bash
npm --prefix frontend run dev
```

Frontend dev server:
- Vite will print the local URL, typically `http://localhost:5173`

## Backend regression tests

Install the Python test dependencies, then run the backend regression test file:

```bash
source venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_backend_simulation_response_regressions.py -q
```

## Notes

- `status.md`, `status.sh`, `studio_*_probe.txt`, and frontend `*.tsbuildinfo` files are local/generated artifacts and are ignored.
- This repository-level README is intentionally narrow and operational.
