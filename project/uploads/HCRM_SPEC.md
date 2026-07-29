# HCRM Spec: Human-Celestial Register Map

## Role

HCRM is the human-domain mapping scaffold. The natal chart is treated as a register map: a birth event is projected into celestial bodies, signs, houses, aspects, and human/body domains.

## Required layer separation

```text
Layer A: exact input ledger
Layer B: exact register engine
Layer C: presentation UI
```

The UI may use decimal display and CSS geometry. Evidence ledgers and register computations must use integer arcseconds, rational pairs, and exact residues.

## Exact register basis

```text
2, 3, 5, 7, 11, 13, 17, 19
```

## Required exact fields

```text
longitude_arcsec
sign_index = longitude_arcsec // 108000
sign_arcsec = longitude_arcsec % 108000
valid_ecliptic_arcsec = longitude_arcsec < 1296000
```

## Gear classes

```text
G-zero: r17=0 and r19=0
G-pre:  r17=16 and r19=18
G-low:  exploratory only; requires null-rate report
```

HCRM is scaffolded at GREEN-2. It becomes evidentiary only when populated from exact ephemeris ledgers.
