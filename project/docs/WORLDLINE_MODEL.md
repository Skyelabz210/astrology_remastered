# Natal Worldline: Integrated QMNF / CRAM / Relativity

**Entry point:** `project/src/astro/worldline.js` and `project/worldline.jsx`

The natal chart supplies the origin event and geographic coordinates. The worldline panel combines the QMNF residue torus, CRAM winding coordinate, observer quotient, quadratic-reciprocity signature, calendar resonance, and an Earth-surface proper-time estimate in one birth-anchored experience.

## Exact substrate and residue torus

The safe basis is

```text
S = {2, 3, 5, 7, 11, 13}
M = product(S) = 30,030
Z/MZ ≅ Z/2Z × Z/3Z × Z/5Z × Z/7Z × Z/11Z × Z/13Z
```

For the chart-relative integer time coordinate `X`, the implementation retains exact `BigInt` arithmetic:

```text
r = X mod M
K = floor(X / M)
X = r + K·M
```

The six CRT residues are the torus coordinates. The integer `K` is the winding/lift coordinate carried alongside the residue state.

## K-elimination anchor

With `A = M + 1 = 30,031`, we have `M ≡ -1 (mod A)`. If `v_M = X mod M` and `v_A = X mod A`, then

```text
K ≡ (v_M − v_A) mod A
```

The engine computes this anchor coordinate and verifies it against the exact winding class.

## CRAM natal winding

The CRAM register remains birth-anchored and is calculated alongside QMNF:

```text
N = floor((t − t₀) / 86,400 seconds)
r₃₆ = N mod 36
K₃₆ = floor(N / 36)
v₃₇ = (r₃₆ − K₃₆) mod 37
```

The UI presents the 36/37 shell coordinate and the 30,030-state QMNF coordinate as one integrated timeline.

## Quadratic reciprocity signature

The implementation evaluates Legendre symbols for the safe-basis primes congruent to 3 modulo 4: `3, 7, 11`. For each unordered pair `(p,q)`, it records both symbols and the directed signature associated with the negative symbol. The panel renders all three pairwise signatures as part of the worldline's prime structure.

## Observer quotient and calendar resonance

The observer map is `X ↦ X mod 30,030`; the integer winding `K` retains the lift of that observable residue. The existing Maya Long Count, Tzolk’in, Haab’, Calendar Round and TCO calculations remain available as calendar-resonance coordinates in the same panel.

## Relativistic worldline layer

The natal latitude and longitude parameterize an Earth-surface reference observer. The current proper-time estimate uses

```text
dτ/dt = sqrt(1 − 2GM/(rc²) − v²/c²)
```

with WGS84 geodetic geometry, Earth's gravitational parameter, and nominal rotation rate. The result is presented with the natal time coordinates as the relativistic clock layer of the same worldline.

The estimate assumes zero elevation when none is supplied and uses POSIX timestamps (leap seconds omitted). It is an educational Earth-surface estimate rather than a precision clock-transfer, navigation, or geodesy solution; higher gravity multipoles, frame dragging, tides, local geopotential, Earth-orientation parameters and full relativistic time-scale conversion are not included.

## Verification

`project/test/present/worldline.test.js` covers CRAM shell transitions, negative-time floor decomposition, QMNF modulus and CRT residue bounds, anchor elimination, quadratic-reciprocity pair signatures, observer-quotient lift retention, and the existing proper-time and coordinate-validation behavior.
