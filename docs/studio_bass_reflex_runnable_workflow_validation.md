# Studio Bass Reflex Runnable Workflow Validation

## Conclusion

**B. NOT READY — EXACT BLOCKER IDENTIFIED**

## Current repo-grounded truth

- Studio still gates **Run Simulation** to the Closed Box workflow only.
- The Studio translator now emits a minimum Bass Reflex candidate model with a driver, rear box volume, vent duct, front radiator, port radiator, impedance observation, and separate front/port SPL observations.
- The backend response path can already return the minimum first-class plot payload shape used by Studio (`frequencies_hz`, `series`, `properties`) and is not the deciding blocker for first BR support.
- Missing displacement and group delay are **not** the deciding blocker for first truthful BR support.

## Exact remaining blocker

The current translator emits **separate** `spl_front` and `spl_port` observations, but the current Studio workflow still lacks a **validated first-class Bass Reflex system SPL path**.

That means the repository does **not** yet establish one trustworthy answer to the question:

> What single SPL trace should Studio show as the truthful Bass Reflex system response?

Until that is validated end-to-end, ungating BR would risk presenting an incomplete or non-coherent SPL result as if it were the full Bass Reflex workflow.

## Explicit answers

### Can the current Studio Bass Reflex editor produce a truthful payload?

It can now produce a **minimum vented-box candidate payload**, but the repository does not yet validate that payload as a truthful **Studio-level runnable BR workflow**.

### Does translator support the necessary topology structure?

Partially yes.

The translator now emits the minimum vented-box candidate structure needed to proceed with validation:

- driver
- rear box volume
- front radiator
- vent duct
- port radiator
- impedance observation
- front SPL observation
- port SPL observation

### Does backend response shape already support the minimum BR plot workflow?

Yes for transport shape.

The backend can already return the payload structure needed for plotting (`frequencies_hz`, `series`, `properties`). The remaining issue is not JSON shape or transport.

### Are missing displacement/group delay blockers for first truthful BR support?

No.

They remain useful future observables, but they are **not** the deciding blocker for first truthful BR enablement.

## Smallest next implementation patch

`feat/studio-bass-reflex-system-spl-validation-path`

That patch should do exactly one thing:

- define and validate a **single truthful first-class BR SPL path** for Studio,
- verify it is coherent alongside impedance,
- and only then ungate BR in the Studio run workflow.

## What should remain true until then

- Closed Box remains the only stable runnable workflow.
- Bass Reflex remains visible and guided.
- Bass Reflex remains honestly gated.
- No UI wording should imply BR parity before the system SPL path is validated.
