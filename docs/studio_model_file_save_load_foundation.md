# Studio canonical model save/load foundation

This patch adds a bounded canonical-model round-trip path in the frontend.

## In scope
- export the current canonical model as a JSON file
- load a previously exported canonical model JSON file
- keep the thin-runner path using the same canonical model source as the inspection surface

## Out of scope
- YAML editor
- broad project/session persistence
- topology support expansion
- backend API changes

## Truth posture
- the canonical model file format is currently JSON as a YAML-equivalent inspection and round-trip surface
- loading a canonical model creates a thin-runner override for the current canonical model path
- this does not broaden runtime support claims or topology claims
