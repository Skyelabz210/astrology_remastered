# Natal Worldline: CRAM Cyclic Time and an Idealized GR Clock

**Status:** Implemented research visualization; not a precision relativistic ephemeris.  
**Entry point:** `project/src/astro/worldline.js` and `project/worldline.jsx`

## 1. Purpose and separation of registers

The chart provides a birth event and a geodetic reference location. The panel constructs three related but mathematically distinct descriptions:

1. **Chart event:** the supplied birth timestamp, latitude and longitude.
2. **CRAM cyclic-time coordinate:** a birth-relative integer day index decomposed on the shell/anchor pair from the accompanying CRAM Arrow notes, M = 36 and A = 37.
3. **Relativistic clock estimate:** the proper-time rate of a hypothetical clock held at the birth coordinates on Earth's surface.

The existing Cylindrical Time Model (CTM) is also displayed as its own calendar register (Maya epoch JD 584283, Tzolk'in, Haab', Calendar Round and TCO phase). It is not substituted for the 36/37 CRAM register.

Astrological planetary positions do not enter the relativistic metric. This is a chart-anchored time/geography visualization, not a theory in which zodiac placements generate curvature.

## 2. CRAM arrow coordinate

Let `t₀` be the birth instant and `t` the target instant. The implementation obtains POSIX elapsed milliseconds from the parsed, explicit-offset ISO timestamps, then defines the whole-day coordinate

```text
N = floor((t − t₀) / 86,400 seconds)
r = N mod 36
K = floor(N / 36)
N = r + 36K
v₃₇ = (r − K) mod 37
```

`r` is the within-shell phase and `K` is the winding count. The signed anchor `v₃₇` implements the supplied arrow identity. At closed-shell states (`r = 0`), increasing `K` gives `v₃₇ = 0, 36, 35, 34, …`, which is the specified downward anchor progression.

The CRAM values are kept as `BigInt` until serialized as decimal strings. The displayed phase angle (10 degrees per whole-day tick) is only a visual mapping of the 36 discrete residues. The 36-day shell is a coordinate convention over the chart's history; it is not asserted to be a physical period of time.

## 3. Existing CTM calendar register

The panel reuses the repository's pre-existing `ctmState(jdNow, chart.jd)` calculation. Its calendar coordinates have their own epoch and definitions:

- Long Count based on the repository's Maya epoch, JD 584283.
- Tzolk'in position modulo 260.
- Haab' position modulo 365.
- Calendar Round position modulo 18,980.
- TCO phase on its existing default 30,030-state modulus.

These provide a second cyclical description next to the 36/37 CRAM coordinate. Displaying both is a side-by-side comparison, not a proof that their moduli or epochs are physically identical.

## 4. Relativistic proper-time estimate

For a stationary observer in the exterior Schwarzschild geometry, the metric gives gravitational time dilation. If the observer also moves azimuthally at angular rate `Ω`, with local tangential speed `v = Ωρ`, the idealized proper-time rate used here is

```text
dτ/dt = sqrt(1 − 2GM/(rc²) − v²/c²)
```

where:

- `G M = μ` is Earth's gravitational parameter.
- `r` is the approximate geocentric radius of the chart's surface reference point.
- `ρ` is its distance from Earth's rotation axis.
- `Ω` is Earth's nominal angular velocity.
- `c` is the speed of light.

The code computes the geodetic position from the WGS84 ellipsoid (semi-major axis 6,378,137 m; flattening 1/298.257223563), assumes zero elevation unless a future caller explicitly supplies one, and uses Earth's GM 3.986004418 × 10¹⁴ m³/s² and angular velocity 7.292115 × 10⁻⁵ rad/s. See the [ESA GODOT constants reference](https://godot.io.esa.int/).

The estimated proper-time interval is the coordinate interval multiplied by the constant rate at that reference point. This is intentionally a compact surface-clock comparison, not a full solution of Einstein's field equations for the rotating, oblate, deformable Earth.

### Omitted physics and time-scale limits

The current estimate omits Earth's J2 and higher gravity multipoles, frame dragging, ocean/solid-Earth tides, local terrain and geopotential, elevation uncertainty, polar motion, UT1/UTC Earth-orientation data, precession/nutation, and the full relativistic conversion between UTC, TAI, TT, TCG and related scales. Browser timestamps use POSIX milliseconds and do not represent leap seconds. The result must not be used for precision timing, navigation, geodesy or clock-transfer work.

The rotation trace in the UI is expressed relative to the natal meridian. It is not an ICRF/ITRF Earth-orientation solution; that would require UT1/GMST and IERS Earth-orientation parameters.

## 5. What the worldline represents

The modeled observer is held at the natal latitude and longitude for the entire interval. This is a reference worldline, not a reconstructed biography: the app does not know the subject's subsequent residences, travel, elevation changes, or actual motion relative to Earth.

The panel explicitly labels the result as a hypothetical birthplace clock. The chart's birth place and timestamp anchor it; the horoscope's planetary configurations do not determine the proper-time rate.

## 6. Verification

`project/test/present/worldline.test.js` checks:

- Exact decompositions at N = 0, 36, 37 and 72.
- The closed-shell signed-anchor progression.
- Floor decomposition for a negative interval (a target before birth).
- Coprimality of 36 and 37.
- Timelike/finite GR rate, proper time below coordinate time, altitude sensitivity and zero rotational speed at the pole.
- Explicit timestamp-offset and coordinate validation.
- Disclosure fields in the serialized result.

The tests validate the implementation and its declared approximations. They do not establish a new physical law, derive the CRAM arrow from general relativity, or prove that the 36/37 coordinates are a physical clock.
