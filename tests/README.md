# Backend test bootstrap

This repository keeps backend regression coverage lightweight.

## Install dev/test dependencies

```bash
python -m pip install -r requirements-dev.txt
```

## Run the backend simulation response regression test

```bash
python -m pytest tests/test_backend_simulation_response_regressions.py -q
```

The targeted regression file covers `/api/simulate` response stability, including:
- stable top-level response shape
- optional iterable-valued attributes present but `None`
- JSON-safe serialization of NumPy-backed values
