# Studio Bass Reflex Combined System SPL Validation Path

Decision: **NOT READY — exact blocker identified**

## Current repo truth

The current Studio bass reflex translator emits a minimum vented-box candidate with these first-class observations:

- `zin`
- `spl_front`
- `spl_port`

The backend response path is already generic enough to return arbitrary series IDs through:

- `data.frequencies_hz`
- `data.series`
- `data.properties`

That means the remaining blocker is narrower than before.

## Decisive conclusion

Studio still does **not** have a validated first-class **combined bass-reflex system SPL** path.

Separate `spl_front` and `spl_port` traces are not, by themselves, a truthful system SPL observable. A magnitude-only overlay or arithmetic magnitude sum would not be acceptable as physics truth for Studio ungating.

## What is not the blocker

The following are **not** the deciding blocker for first truthful BR support:

- displacement
- group delay
- backend JSON response shape
- basic impedance exposure

Impedance is already an acceptable companion validation observable for the first BR runnable line.

## Exact blocker

A truthful BR system SPL path still requires one of these to be validated:

1. a **kernel-native summed radiation observable** that directly represents the combined system SPL, or
2. another **validated phase-aware system-pressure contract** that can be exposed without pretending separate traces are already the system response

The current translator/backend line does not yet prove either path.

## Consequence for Studio behavior

Bass Reflex should remain:

- visible
- guided
- honestly gated

Closed Box remains the only stable runnable topology in the current Studio line.

## Smallest next patch

Recommended next patch:

- `audit/studio-bass-reflex-kernel-summed-observable-contract`

That patch should answer one concrete question:

- Does the current os-lem kernel already support a truthful summed-radiation / combined-system SPL observable that Studio can emit and consume directly?

If yes, the following patch can wire it into Studio and prepare BR ungating.
If no, the repo should state that exact kernel-contract gap directly before more BR runtime work.
