# Studio anchor observable truth hardening

## Purpose

This patch hardens the observable/runtime truth messaging for the current validated Closed Box anchor.

Studio already distinguishes between:
- exact validated runnable anchor
- seeded but gated paths
- composition mode not yet compilable
- invalid graph

This patch adds one more explicit truth layer:
- what observable/runtime basis is currently trusted for the runnable anchor
- how that trust drops immediately once the graph leaves the exact validated anchor

## Current truthful line

### Closed Box anchor

The only truthful runnable Studio anchor in the current line is the exact validated Closed Box seed and motif. When the graph is on that anchor, the trusted first-class Studio runtime basis is:
- SPL from the current validated anchor path
- impedance magnitude from the current validated anchor path

Other observables may still appear if returned by the backend, but they are not the basis of current anchor validation.

### Bass Reflex

Bass Reflex remains seeded and explicitly gated. The decisive blocker is still the absence of a validated first-class combined BR system SPL path.

### Transmission Line and Horn

Transmission Line and Horn remain seed-only and non-runnable in the current truthful line.

## Operator-facing outcome

The UI should now make it harder to misread runnable trust:
- runnable Closed Box anchor states why it is trusted
- leaving the exact anchor immediately drops observable/runtime trust
- gated states remain concise and factual
