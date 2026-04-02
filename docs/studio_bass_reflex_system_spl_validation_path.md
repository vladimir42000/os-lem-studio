# Studio Bass Reflex system SPL validation path

Status: **B. NOT READY — exact blocker identified**

## Decision

A truthful first-class Bass Reflex system SPL path is **not yet validated** on the current Studio line.

Bass Reflex should therefore remain gated in Studio.

## What current repo truth already provides

The current Studio translator emits a minimum Bass Reflex candidate with:
- `zin`
- `spl_front`
- `spl_port`

The backend response path is already generic enough to return these observations through `data.series` and impedance through `data.properties.zin_mag_ohm`.

## Exact blocker

The current line does **not** yet expose a validated first-class **combined Bass Reflex system SPL** trace.

Today the translator emits two separate radiation observations:
- driver/front radiator SPL
- port radiator SPL

That is not the same thing as a truthful single system SPL.

A truthful BR system SPL requires a validated combined radiation path. The current Studio/backend path does not yet provide a repo-proven `spl_system` observation, and Studio must not fabricate one by visually choosing only one branch or by naively summing display-ready SPL magnitudes.

## What is *not* the blocker

These are **not** the deciding blocker for first truthful BR support:
- displacement availability
- group delay availability

Those may matter later, but they do not decide the first BR runnability question.

## Smallest correct next capability patch

Recommended next patch:
- `feat/studio-bass-reflex-system-summed-observable-path`

That patch should do exactly one thing:
- establish and validate one truthful first-class BR system SPL observable path

Only after that path is validated should Studio consider ungating BR runtime.
