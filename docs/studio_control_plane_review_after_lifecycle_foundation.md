# Studio control-plane review after lifecycle foundation

## Scope of this patch

This is a bounded control-plane review patch landed after acceptance of the lifecycle foundation.

It is intentionally **doc-first** and **review-first**.

It does not broaden capability. It does not change backend behavior. It does not change graph-workbench scope. It does not redesign the UI. It does not introduce any new workflow concept.

## Accepted lifecycle foundation state

The currently accepted foundation can be summarized as follows:

- `App.tsx` is the semantic authority for lifecycle truth.
- The displayed lifecycle outputs are produced from one upstream computation path rather than reconstructed in UI leaves.
- The surfaced lifecycle outputs are:
  - `canonicalModelSourceLabel`
  - `resultStateLabel`
  - `resultOwnershipLabel`
  - `rerunNeeded`
- Ownership and state are distinct concepts:
  - ownership answers what source produced the displayed result
  - state answers whether that result is current or stale relative to the active canonical source
- `RunnerStateSummary` and other downstream surfaces are expected to remain thin prop consumers.

This remains the correct foundation for the current thin-runner Studio posture.

## Constraints still in force

The following constraints remain in force after this review:

- canonical model remains the primary truth for the thin-runner workflow
- lifecycle truth remains centralized upstream
- downstream surfaces must not recreate lifecycle semantics from presentation strings
- loaded override is authoritative only while active
- explicit revert returns authority to the graph-derived canonical model
- stale/current semantics must be evaluated against the currently authoritative canonical source

## Forbidden expansion categories right now

The following categories remain out of scope right now:

- backend expansion
- topology or runtime broadening
- graph-workbench expansion
- YAML editor introduction
- UI redesign
- convenience cleanup that is not tied to lifecycle/control truth
- broad refactors that move or dilute lifecycle authority
- UI-side semantic reconstruction of runner truth

## Bounded lifecycle behavior summary

The current lifecycle/control foundation should continue to satisfy the following expected behavior summary.

| Transition | Canonical model source | Result state | Result ownership | Rerun needed |
| --- | --- | --- | --- | --- |
| no-result initialization | active source only | no result | no result yet | no |
| override -> run | loaded override | current | displayed result belongs to loaded override snapshot | no |
| override -> run -> revert | graph-derived after revert | stale until rerun | displayed result still belongs to earlier loaded override snapshot | yes |
| graph edit after run | graph-derived | stale after graph-derived canonical change | displayed result belongs to earlier graph-derived snapshot | yes |
| override replacement after run | new loaded override | stale until rerun | displayed result belongs to earlier snapshot, not the newly loaded one | yes |

This table is not a new feature surface. It is a control-plane expectation summary for later audits.

## Residual ambiguity review

No concrete contradiction requiring immediate product correction is identified by this review.

The accepted lifecycle foundation appears coherent enough to remain the active control-plane basis.

The main residual risk is not product-surface ambiguity but process drift:

- later patches could weaken operator visibility if probe output is too thin
- later patches could make audit harder if archive instructions are inconsistent
- later patches could reintroduce semantic duplication if lifecycle meaning drifts back into leaf components

That means the immediate need is continued control-plane discipline rather than new capability.

## Patch-delivery standard now expected

This review explicitly incorporates the newly approved delivery standard for future Studio patches.

### Archive expectations

Each future patch archive should include:

- `step0_apply_patch.sh`
- `step1_run_targeted_check.sh`
- `step2_write_probe.sh`
- short operator copy-paste instructions for extraction and execution

### step1 expectations

`step1_run_targeted_check.sh` should:

- state clearly what it is checking
- echo the exact command or commands it runs
- report an explicit pass or fail outcome
- stay bounded to the intended patch surface

### step2 expectations

`step2_write_probe.sh` should write a probe that includes, at minimum:

- patch name
- repo path
- current branch
- current HEAD
- `git status --short`
- touched files summary
- `git diff --stat` for the intended patch surface
- targeted check command list
- targeted check result summary
- concise change claim
- concise known limitation or caveat
- exact file list expected for auditor review
- one short suggested next audit focus when obvious

### Validation-matrix expectation

When a patch touches behavior that can be summarized as transition or state expectations, the patch should include a bounded expected-behavior summary or validation matrix rather than leaving that interpretation implicit.

## What kind of next step would later be acceptable

A later acceptable step would still need to be bounded and control-plane safe.

Examples of acceptable later steps, if explicitly approved:

- a tiny lifecycle validation patch that adds targeted tests only if repo patterns support that cleanly
- a small App-centered correction if a concrete lifecycle contradiction is demonstrated
- a process-hardening patch that improves operator or audit visibility without changing product meaning

Examples of still-unacceptable later steps right now:

- new capability work presented as cleanup
- graph-workbench growth under a lifecycle label
- runtime or topology broadening before control-plane calm is re-confirmed
- UI-surface logic that duplicates upstream lifecycle computation

## Review outcome

This control-plane review concludes:

- the lifecycle/control foundation remains accepted
- no immediate semantic contradiction was found that requires product correction in this patch
- present posture should remain validation-first and review-first
- future patch delivery should follow the richer operator/probe standard documented above

That is sufficient for the current paused-expansion posture.
