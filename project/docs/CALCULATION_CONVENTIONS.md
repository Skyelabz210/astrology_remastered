# Calculation conventions and precision

## Horizon and polar charts

The Ascendant is the eastern intersection of the geometric horizon and the ecliptic. The solver projects the candidate intersection onto the local east vector and selects its eastern antipode. This resolves the former 180-degree branch error at inhabited polar latitudes. It uses GAST and mean obliquity; its output is numerical astronomy, not an exact physical angle. The retained missing-module fallback uses approximate GMST and fixed J2000 obliquity and records that source on the chart.

With Astronomy Engine available, automatic sect uses the geocentric Sun's geometric altitude above the horizon, without atmospheric refraction or a sunrise/sunset limb threshold. Explicit day/night selections remain overrides. Physical solar altitude matters at polar latitude: flipping an erroneous western Ascendant alone does not repair sect. Without the ephemeris, sect remains a disclosed approximate ecliptic estimate.

Whole sign and Equal houses use this declared Ascendant. Porphyry additionally requires the ASC/IC/DSC/MC quadrant ordering to partition one circle; failed ordering falls back to Whole sign with a warning. Meridian and Morinus retain their latitude-independent cusp constructions. The other six quadrant systems retain their conservative 66.56-degree rejection/fallback policy: fixing their angular origin does not independently validate their polar non-angular cusps.

Exactly geographic poles do not supply a rising Ascendant. Coincident or tangent horizon/ecliptic geometry also lacks a unique rising intersection; these inputs raise an explicit unavailable-angle error rather than producing a fabricated chart. Historical polar astrology conventions vary; this implementation names its geometric choice.

Each natal chart records `anglesMode`, `angleSource`, `angleConvention`, `solarAltitude`, and `sectSource`; source/fallback warnings travel with the chart. The legacy global `ANGLES_MODE` identifies module availability, not a per-chart accuracy guarantee.

## Motion, aspect patterns and quantization

For real and mean-element positions, retrograde flags follow the signed speed computed from that same position model. Mean Lilith is mean lunar apogee, not a physical body's retrograde loop; its former opposition-based synthetic flag was incorrect. Synthetic demonstration positions remain labeled as demonstrations.

A Grand Cross is recognized by its two opposition axes and four square edges, independently of body ordering. All three possible opposition pairings are considered. Aspect orbs remain declared conventions.

Discrete lanes round continuous angles to the nearest arcsecond and normalize the circle before taking residues. The same wrap rule applies to planets and the Ascendant. Arithmetic exactness begins after that quantization; it does not erase ephemeris uncertainty.

## Integer registry versus traditional constructions

The exported `kp_sub` ID and divisor 249 are retained for compatibility as a **legacy uniform 249-cut proxy**. Actual KP sublord intervals are unequal. A nakshatra is 48,000 arcseconds; each sublord's interval is 48,000 × Vimshottari period / 120 = 400 × period arcseconds. All nine first-level widths are integral; their sum is 48,000 arcseconds. Non-closure of a uniform 249-way circle division does not establish a defect or factor 83 requirement for those actual intervals. Full KP sublord assignments, sign-boundary splitting and date-dependent ayanamsa remain unimplemented.

The exported `monomoiria` ID and divisor 4320 likewise preserve a legacy uniform 12-per-degree proxy. Traditional monomoiria assign rulers to single degrees. The proxy does not supply that traditional ruler mapping. Registry reports carry the explicit proxy convention instead of implying implemented traditional coverage.
