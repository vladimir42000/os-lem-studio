# Studio Bass Reflex runnability decision

Status: **B. NOT READY — EXACT BLOCKER(S) IDENTIFIED**

## Scope of this audit

This audit answers whether the current Bass Reflex Studio workflow can be made truthfully runnable from the current repo line with one bounded implementation patch.

The audit is grounded in the current accepted Studio direction and the actual local contracts already visible in the repository:

- `frontend/src/App.tsx`
- `frontend/src/translator.ts`
- `backend/server.py`
- the current closed-box request/response path already used successfully by Studio

## Decision

**Conclusion: NOT READY — EXACT BLOCKER(S) IDENTIFIED.**

A truthful runnable Bass Reflex Studio workflow cannot be enabled from the current line merely by lifting the UI gate. The current blocker is not plot rendering, not backend startup, and not the absence of displacement or group delay in the current UI. The blocker is that the Studio-to-model translation path does not yet emit a truthful ported-box topology for the backend/kernel to solve.

## Repo-grounded findings

### 1. Can the current Studio Bass Reflex editor produce a truthful payload?

**No.**

The current translator line only has a proven closed-box-style assembly path. The previously inspected `frontend/src/translator.ts` builds a model around:

- one driver
- one rear volume element
- one front radiator element
- observations for SPL and input impedance

That is sufficient for the current closed-box Studio line, but it is not sufficient for a truthful Bass Reflex payload.

A runnable Bass Reflex payload requires, at minimum, explicit translation of the vented path as actual model structure rather than as UI-only fields. In the current line, the guided Bass Reflex editor may expose parameters such as chamber volume, port area, and port length, but those parameters are not yet enough unless they are translated into the backend model as real elements and observation targets.

### 2. Does the translator support the necessary topology structure?

**Not yet.**

The current translator contract does not yet establish the minimum truthful vented-box topology structure needed for Bass Reflex. The exact gap is:

- no explicit vent/port element emission from the Studio Bass Reflex path
- no translator mapping from Bass Reflex editor fields into a backend model structure that represents the vented branch
- no established Studio-side observation targeting for the vented topology line

In practical terms, Bass Reflex is currently product-visible and editor-visible, but not model-emitting in a trustworthy end-to-end sense.

### 3. Does the backend response shape already support the minimum BR plot workflow?

**Yes, conditionally.**

The backend response shape used by Studio is already adequate for the first truthful Bass Reflex plot workflow **if** the translator emits a valid solvable Bass Reflex model and the backend/kernel returns the same class of stable outputs now used for closed box.

The current response line already supports:

- `data.frequencies_hz`
- `data.series`
- `data.properties`
- current/frozen comparison in the frontend
- the currently working SPL / impedance plotting path

So the current backend response shape is **not** the primary blocker for first truthful Bass Reflex support.

### 4. Are missing observables like displacement and group delay blockers for first truthful BR support?

**No.**

They are useful future observables, but they are not blockers for the first truthful Bass Reflex Studio support step.

For a first trustworthy BR workflow, the minimum acceptable plot workflow is:

- SPL
- impedance magnitude
- optionally phase if already available cleanly

The lack of displacement and group delay exposure in the current Studio line does not by itself prevent first truthful BR enablement.

### 5. What are the exact blockers?

The exact blockers are:

1. **Translator topology gap**
   - Bass Reflex editor state is not yet translated into a truthful vented-box backend payload.

2. **Unvalidated vented-path model contract**
   - the Studio line does not yet prove that the emitted Bass Reflex structure matches a currently supported `os-lem` model pattern in the same way closed box already does.

3. **Observation targeting for the BR line is not yet explicitly established in Studio translation**
   - even if the backend can solve an appropriate vented model, the Studio translator must still define the observation targets used by the current plot workflow.

## Smallest truthful next implementation patch

Recommended next patch:

- `feat/studio-bass-reflex-translator-minimum-runnable-path`

## Exact scope for that next patch

The next patch should be bounded to the minimum required to answer runnability in code, not in UI wording:

1. extend `frontend/src/translator.ts` so Bass Reflex editor state emits a real vented-box model structure
2. keep the current backend response contract unchanged if possible
3. keep the current plot workflow unchanged except for enabling BR only after the translator path is real
4. validate that SPL and impedance remain the minimum first-class BR workflow outputs
5. do not open TL/horn work
6. do not broaden into macro-template compiler architecture

## Outcome-oriented follow-up rule

After that next translator-focused patch, the line should immediately be tested against this decision question again:

- if the emitted BR payload solves cleanly and produces trustworthy SPL/impedance through the existing backend response path, enable runnable BR
- if not, keep BR gated and record the exact remaining kernel/contract blocker

## Final decision statement

**B. NOT READY — EXACT BLOCKER(S) IDENTIFIED**

Bass Reflex should remain honestly partial in Studio until the translator emits a truthful vented-box payload through the existing backend/kernel line. Missing displacement and group delay are not the deciding issue. The deciding issue is the absent or unvalidated model-emission path for the vented topology itself.
