# Studio result export foundation

This patch adds a bounded simulation-result export path aligned with the thin-runner line.

## Scope

- export the current in-memory simulation result from the frontend
- keep the export path thin and read-only
- avoid any new backend API breadth
- avoid report generation, session packaging, or topology expansion

## Current format

The current export format is JSON. The exported file contains:

- `exported_at`
- `export_type`
- `result`

where `result` is the current simulation result state already used by the plotting path.

## Truth posture

This patch does not broaden runtime capability claims. It only exposes a bounded export path for whatever result state is already truthfully available in the current Studio line.
