# Backend regression tests

## Bootstrap

From the repository root:

```bash
source venv/bin/activate
python -m pip install -r requirements-dev.txt
```

## Run the backend response regression test

```bash
python -m pytest tests/test_backend_simulation_response_regressions.py -q
```

This test file covers the `/api/simulate` response stability path, including:
- stable top-level response shape
- optional iterable-valued attributes that may be present but `None`
- JSON-safe serialization of NumPy-backed values exposed by the backend adapter
