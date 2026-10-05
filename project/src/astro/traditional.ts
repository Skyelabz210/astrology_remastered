// src/astro/traditional.ts - Traditional Astrology Module (Part 2)
//
// This is a continuation of the traditional.ts file, containing:
// - Solar conditions (cazimi, combust, under the beams)
// - Sect and hayz
// - Almuten of the chart
// - Lord of the Geniture
// - Time lords (annual profections, firdaria, zodiacal releasing)
// - 28 lunar mansions
// - Prenatal syzygy
// - Fixed stars
// - Enhanced lunar phase with exact illumination

import { ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE, PlanetName } from './traditional';

// ============================================================================
// SOLAR CONDITIONS
// ============================================================================

/**
 * Check solar condition for a planet relative to the Sun
 * Returns the condition and the separation in arcseconds
 */
export function checkSolarCondition(
  planetLon: number, // Planet longitude in arcseconds
  sunLon: number,     // Sun longitude in arcseconds
  planetName: PlanetName
): {
  condition: 'cazimi' | 'combust' | 'underTheBeams' | 'free';
  separationArcsec: number;
  isExact: boolean;
} {
  const separation = angularSeparationArcsec(planetLon, sunLon);
  
  // Cazimi: within 17 arcminutes (17 * 60 arcseconds) of the Sun
  if (separation <= 17 * 60) {
    return {
      condition: 'cazimi',
      separationArcsec: separation,
      isExact: separation === 0,
    };
  }
  
  // Combust: within 8°30' (8.5 degrees) of the Sun
  if (separation <= 8 * ARCSECONDS_PER_DEGREE + 30 * 60) {
    return {
      condition: 'combust',
      separationArcsec: separation,
      isExact: false,
    };
  }
  
  // Under the beams: within 17° of the Sun
  if (separation <= 17 * ARCSECONDS_PER_DEGREE) {
    return {
      condition: 'underTheBeams',
      separationArcsec: separation,
      isExact: false,
    };
  }
  
  return {
    condition: 'free',
    separationArcsec: separation,
    isExact: false,
  };
}

/**
 * Check solar conditions for all planets in a chart
 */
export function checkAllSolarConditions(
  planets: Array<{ name: PlanetName; lon: number }>
): Record<PlanetName, ReturnType<typeof checkSolarCondition>> {
  const sunLon = planets.find(p => p.name === 'Sun')?.lon ?? 0;
  const results: Record<PlanetName, ReturnType<typeof checkSolarCondition>> = {} as any;
  
  for (const planet of planets) {
    if (planet.name === 'Sun') continue;
    results[planet.name] = checkSolarCondition(planet.lon, sunLon, planet.name);
  }
  
  return results;
}

// ============================================================================
// SECT AND HAYZ
// ============================================================================

/**
 * Determine if a chart is diurnal (day) or nocturnal (night)
 * Based on Sun's position relative to Ascendant
 */
export function determineSect(
  sunLon: number,     // Sun longitude in degrees
  ascLon: number,     // Ascendant longitude in degrees
  sectOption: 'auto' | 'day' | 'night' = 'auto'
): 'day' | 'night' {
  if (sectOption !== 'auto') {
    return sectOption;
  }
  
  // Convert to arcseconds for consistency
  const sunArcsec = Math.round(sunLon * ARCSECONDS_PER_DEGREE);
  const ascArcsec = Math.round(ascLon * ARCSECONDS_PER_DEGREE);
  
  // Sun above horizon (houses 7-12) = day chart
  // Sun is in houses 7-12 when its longitude is more than 180° from Ascendant
  const elongation = angularSeparationArcsec(sunArcsec, ascArcsec);
  
  return elongation > 180 * ARCSECONDS_PER_DEGREE ? 'day' : 'night';
}

/**
 * Check if a planet is in hayz (in the same sect as the chart)
 */
export function checkHayz(
  planetLon: number,    // Planet longitude in arcseconds
  sunLon: number,       // Sun longitude in arcseconds
  ascLon: number,       // Ascendant longitude in arcseconds
  sect: 'day' | 'night'
): boolean {
  if (sect === 'day') {
    // Day chart: diurnal planets are in hayz
    const diurnalPlanets = ['Sun', 'Jupiter', 'Saturn'] as PlanetName[];
    // Check if planet is above the horizon (in houses 7-12)
    const elongation = angularSeparationArcsec(planetLon, ascLon);
    return elongation > 180 * ARCSECONDS_PER_DEGREE;
  } else {
    // Night chart: nocturnal planets are in hayz
    const nocturnalPlanets = ['Moon', 'Venus', 'Mars'] as PlanetName[];
    // Check if planet is below the horizon (in houses 1-6)
    const elongation = angularSeparationArcsec(planetLon, ascLon);
    return elongation <= 180 * ARCSECONDS_PER_DEGREE;
  }
}

/**
 * Check hayz for all planets in a chart
 */
export function checkAllHayz(
  planets: Array<{ name: PlanetName; lon: number }>,
  ascLon: number,
  sect: 'day' | 'night'
): Record<PlanetName, boolean> {
  const sunLon = planets.find(p => p.name === 'Sun')?.lon ?? 0;
  const results: Record<PlanetName, boolean> = {} as any;
  
  for (const planet of planets) {
    results[planet.name] = checkHayz(planet.lon, sunLon, ascLon, sect);
  }
  
  return results;
}

// ============================================================================
// ALMUTEN AND LORD OF THE GENITURE
// ============================================================================

/**
 * Dignity scores for each planet in each sign
 * Returns the dignity score (higher is better)
 */
function getDignityScore(planet: PlanetName, sign: number): number {
  // Domicile: 5 points
  const domicileSigns: Record<PlanetName, number[]> = {
    Sun: [4],
    Moon: [3],
    Mercury: [2, 5],
    Venus: [1, 6],
    Mars: [0, 7],
    Jupiter: [8, 11],
    Saturn: [9, 10],
    Uranus: [10],
    Neptune: [11],
    Pluto: [7],
    NorthNode: [],
    SouthNode: [],
    Chiron: [],
    Lilith: [],
  };
  
  if (domicileSigns[planet]?.includes(sign)) {
    return 5;
  }
  
  // Exaltation: 4 points
  const exaltationSigns: Record<PlanetName, number | null> = {
    Sun: 0,
    Moon: 1,
    Mercury: 5,
    Venus: 11,
    Mars: 9,
    Jupiter: 3,
    Saturn: 6,
    Uranus: null,
    Neptune: null,
    Pluto: null,
    NorthNode: null,
    SouthNode: null,
    Chiron: null,
    Lilith: null,
  };
  
  if (exaltationSigns[planet] === sign) {
    return 4;
  }
  
  // Triplicity: 3 points
  const triplicityRulers: Record<'day' | 'night', Record<string, PlanetName[]>> = {
    day: {
      Fire: ['Sun'],
      Earth: ['Venus'],
      Air: ['Saturn'],
      Water: ['Venus'],
    },
    night: {
      Fire: ['Jupiter'],
      Earth: ['Moon'],
      Air: ['Mercury'],
      Water: ['Mars'],
    },
  };
  
  const elements = ['Fire', 'Earth', 'Air', 'Water'];
  const element = elements[Math.floor(sign / 3)]; // 0-2=Fire, 3-5=Earth, 6-8=Air, 9-11=Water
  
  // For simplicity, we'll use day triplicity rulers
  if (triplicityRulers.day[element]?.includes(planet)) {
    return 3;
  }
  
  // Term: 2 points
  // Face: 1 point
  // For now, return 0 for neutral
  return 0;
}

/**
 * Calculate almuten (planet with most dignities) for a chart
 */
export function calculateAlmuten(
  planets: Array<{ name: PlanetName; lon: number }>
): AlmutenResult {
  const dignityBreakdown: Record<PlanetName, number> = {
    Sun: 0,
    Moon: 0,
    Mercury: 0,
    Venus: 0,
    Mars: 0,
    Jupiter: 0,
    Saturn: 0,
    Uranus: 0,
    Neptune: 0,
    Pluto: 0,
    NorthNode: 0,
    SouthNode: 0,
    Chiron: 0,
    Lilith: 0,
  };
  
  // Calculate dignity score for each planet in its sign
  for (const planet of planets) {
    const sign = Math.floor(planet.lon / (30 * ARCSECONDS_PER_DEGREE)) % 12;
    const score = getDignityScore(planet.name, sign);
    dignityBreakdown[planet.name] += score;
  }
  
  // Find planet with highest score
  let maxScore = -1;
  let almuten: PlanetName = 'Sun';
  
  for (const [planet, score] of Object.entries(dignityBreakdown)) {
    if (score > maxScore) {
      maxScore = score;
      almuten = planet as PlanetName;
    }
  }
  
  return {
    planet: almuten,
    score: maxScore,
    dignityBreakdown,
  };
}

/**
 * Calculate Lord of the Geniture
 * For day chart: ruler of the Ascendant
 * For night chart: ruler of the Moon
 */
export function calculateLordOfGeniture(
  ascSign: number,      // Ascendant sign (0-11)
  moonSign: number,     // Moon sign (0-11)
  sect: 'day' | 'night'
): PlanetName {
  if (sect === 'day') {
    // Day chart: Lord of the Geniture is the ruler of the Ascendant
    return DOMICILE_RULERS[ascSign];
  } else {
    // Night chart: Lord of the Geniture is the ruler of the Moon
    return DOMICILE_RULERS[moonSign];
  }
}

// ============================================================================
// TIME LORDS
// ============================================================================

/**
 * Firdaria table (from variants.js)
 * Years each planet rules in order
 */
export const FIRDARIA_YEARS: Array<{ lord: PlanetName; years: bigint }> = [
  { lord: 'Saturn', years: 11n },
  { lord: 'Jupiter', years: 12n },
  { lord: 'Mars', years: 7n },
  { lord: 'Sun', years: 19n },
  { lord: 'Venus', years: 8n },
  { lord: 'Mercury', years: 13n },
  { lord: 'Moon', years: 9n },
];

/**
 * Total firdaria cycle length
 */
export const FIRDARIA_CYCLE_YEARS = FIRDARIA_YEARS.reduce(
  (sum, entry) => sum + entry.years,
  0n
);

/**
 * Calculate current firdar (time lord) for a given age
 */
export function calculateFirdaria(
  ageYears: number,
  birthSect: 'day' | 'night' = 'day'
): TimeLordResult {
  // Firdaria starts differently for day and night charts
  // Day chart: Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon
  // Night chart: Moon, Mercury, Venus, Sun, Mars, Jupiter, Saturn
  
  const dayOrder = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'] as PlanetName[];
  const nightOrder = ['Moon', 'Mercury', 'Venus', 'Sun', 'Mars', 'Jupiter', 'Saturn'] as PlanetName[];
  
  const order = birthSect === 'day' ? dayOrder : nightOrder;
  
  // Convert age to bigint for precision
  const ageBig = BigInt(Math.floor(ageYears * 100)) / 100n; // Keep fractional years
  
  let accumulatedYears = 0n;
  
  for (let i = 0; i < order.length; i++) {
    const entry = FIRDARIA_YEARS.find(e => e.lord === order[i]);
    if (!entry) continue;
    
    const endAge = accumulatedYears + entry.years;
    
    if (ageBig < endAge) {
      return {
        lord: order[i],
        years: Number(accumulatedYears),
        endAge: Number(endAge),
        type: 'firdaria',
      };
    }
    
    accumulatedYears = endAge;
  }
  
  // If we've gone through the full cycle, start again
  return calculateFirdaria(Number(ageBig % Number(FIRDARIA_CYCLE_YEARS)), birthSect);
}

/**
 * Calculate annual profection lord for a given age
 */
export function calculateAnnualProfection(
  ageYears: number,
  ascSign: number // Ascendant sign (0-11)
): TimeLordResult {
  // Annual profection: each year is ruled by a planet based on the Ascendant
  // Age 0-1: Ascendant sign ruler
  // Age 1-2: 2nd house sign ruler
  // etc.
  
  const ageFloor = Math.floor(ageYears);
  const profectionSign = (ascSign + ageFloor) % 12;
  const lord = DOMICILE_RULERS[profectionSign];
  
  return {
    lord,
    years: ageFloor,
    endAge: ageFloor + 1,
    type: 'profection',
  };
}

/**
 * Calculate zodiacal releasing from Spirit (Lot of Fortune)
 */
export function calculateZodiacalReleasing(
  ageYears: number,
  fortuneSign: number, // Sign of the Lot of Fortune (0-11)
  spiritSign: number    // Sign of the Lot of Spirit (0-11)
): TimeLordResult[] {
  // Zodiacal releasing is a complex system with multiple levels
  // Level 1: From Fortune to Spirit
  // Level 2: From Spirit to next lot
  // etc.
  
  // For now, implement a simplified version
  const ageFloor = Math.floor(ageYears);
  const cycleLength = 12; // 12 years per cycle
  const positionInCycle = ageFloor % cycleLength;
  
  // Level 1 releasing (12-year cycle)
  const level1Sign = (fortuneSign + positionInCycle) % 12;
  const level1Lord = DOMICILE_RULERS[level1Sign];
  
  return [
    {
      lord: level1Lord,
      years: ageFloor - positionInCycle,
      endAge: ageFloor - positionInCycle + cycleLength,
      type: 'zodiacalReleasing',
    },
  ];
}

/**
 * Calculate all time lords for a given age
 */
export function calculateAllTimeLords(
  ageYears: number,
  ascSign: number,
  moonSign: number,
  fortuneSign: number,
  spiritSign: number,
  sect: 'day' | 'night'
): TimeLordResult[] {
  return [
    calculateAnnualProfection(ageYears, ascSign),
    calculateFirdaria(ageYears, sect),
    ...calculateZodiacalReleasing(ageYears, fortuneSign, spiritSign),
  ];
}

// ============================================================================
// 28 LUNAR MANSIONS
// ============================================================================

/**
 * 28 Arabic lunar mansions with their boundaries and rulers
 */
export const LUNAR_MANSIONS: LunarMansion[] = [
  { index: 0, name: 'Alnath', startArcsec: 0, endArcsec: 12 * ARCSECONDS_PER_DEGREE + 51 * 60, ruler: 'Mars', nature: 'harmful' },
  { index: 1, name: 'Albuth', startArcsec: 12 * ARCSECONDS_PER_DEGREE + 51 * 60, endArcsec: 25 * ARCSECONDS_PER_DEGREE + 42 * 60, ruler: 'Venus', nature: 'benefic' },
  { index: 2, name: 'Athoray', startArcsec: 25 * ARCSECONDS_PER_DEGREE + 42 * 60, endArcsec: 38 * ARCSECONDS_PER_DEGREE + 35 * 60, ruler: 'Saturn', nature: 'harmful' },
  { index: 3, name: 'Aldebaran', startArcsec: 38 * ARCSECONDS_PER_DEGREE + 35 * 60, endArcsec: 51 * ARCSECONDS_PER_DEGREE + 28 * 60, ruler: 'Mercury', nature: 'neutral' },
  { index: 4, name: 'Alhaqa', startArcsec: 51 * ARCSECONDS_PER_DEGREE + 28 * 60, endArcsec: 64 * ARCSECONDS_PER_DEGREE + 21 * 60, ruler: 'Jupiter', nature: 'benefic' },
  { index: 5, name: 'Alhana', startArcsec: 64 * ARCSECONDS_PER_DEGREE + 21 * 60, endArcsec: 77 * ARCSECONDS_PER_DEGREE + 14 * 60, ruler: 'Moon', nature: 'benefic' },
  { index: 6, name: 'Adhira', startArcsec: 77 * ARCSECONDS_PER_DEGREE + 14 * 60, endArcsec: 90 * ARCSECONDS_PER_DEGREE, ruler: 'Mars', nature: 'harmful' },
  { index: 7, name: 'Annaf', startArcsec: 90 * ARCSECONDS_PER_DEGREE, endArcsec: 102 * ARCSECONDS_PER_DEGREE + 51 * 60, ruler: 'Saturn', nature: 'harmful' },
  { index: 8, name: 'Adhdha', startArcsec: 102 * ARCSECONDS_PER_DEGREE + 51 * 60, endArcsec: 115 * ARCSECONDS_PER_DEGREE + 42 * 60, ruler: 'Jupiter', nature: 'benefic' },
  { index: 9, name: 'Albaldah', startArcsec: 115 * ARCSECONDS_PER_DEGREE + 42 * 60, endArcsec: 128 * ARCSECONDS_PER_DEGREE + 35 * 60, ruler: 'Mercury', nature: 'neutral' },
  { index: 10, name: 'Alkaid', startArcsec: 128 * ARCSECONDS_PER_DEGREE + 35 * 60, endArcsec: 141 * ARCSECONDS_PER_DEGREE + 28 * 60, ruler: 'Venus', nature: 'benefic' },
  { index: 11, name: 'Almuhassab', startArcsec: 141 * ARCSECONDS_PER_DEGREE + 28 * 60, endArcsec: 154 * ARCSECONDS_PER_DEGREE + 21 * 60, ruler: 'Mars', nature: 'harmful' },
  { index: 12, name: 'Alauwa', startArcsec: 154 * ARCSECONDS_PER_DEGREE + 21 * 60, endArcsec: 167 * ARCSECONDS_PER_DEGREE + 14 * 60, ruler: 'Sun', nature: 'benefic' },
  { index: 13, name: 'Asimakrab', startArcsec: 167 * ARCSECONDS_PER_DEGREE + 14 * 60, endArcsec: 180 * ARCSECONDS_PER_DEGREE, ruler: 'Mercury', nature: 'neutral' },
  { index: 14, name: 'Alghafr', startArcsec: 180 * ARCSECONDS_PER_DEGREE, endArcsec: 192 * ARCSECONDS_PER_DEGREE + 51 * 60, ruler: 'Saturn', nature: 'harmful' },
  { index: 15, name: 'Azubana', startArcsec: 192 * ARCSECONDS_PER_DEGREE + 51 * 60, endArcsec: 205 * ARCSECONDS_PER_DEGREE + 42 * 60, ruler: 'Venus', nature: 'benefic' },
  { index: 16, name: 'Alikil', startArcsec: 205 * ARCSECONDS_PER_DEGREE + 42 * 60, endArcsec: 218 * ARCSECONDS_PER_DEGREE + 35 * 60, ruler: 'Mercury', nature: 'neutral' },
  { index: 17, name: 'Alkalb', startArcsec: 218 * ARCSECONDS_PER_DEGREE + 35 * 60, endArcsec: 231 * ARCSECONDS_PER_DEGREE + 28 * 60, ruler: 'Jupiter', nature: 'benefic' },
  { index: 18, name: 'Alkaid', startArcsec: 231 * ARCSECONDS_PER_DEGREE + 28 * 60, endArcsec: 244 * ARCSECONDS_PER_DEGREE + 21 * 60, ruler: 'Saturn', nature: 'harmful' },
  { index: 19, name: 'Albaldah', startArcsec: 244 * ARCSECONDS_PER_DEGREE + 21 * 60, endArcsec: 257 * ARCSECONDS_PER_DEGREE + 14 * 60, ruler: 'Jupiter', nature: 'benefic' },
  { index: 20, name: 'Sadalsuud', startArcsec: 257 * ARCSECONDS_PER_DEGREE + 14 * 60, endArcsec: 270 * ARCSECONDS_PER_DEGREE, ruler: 'Mercury', nature: 'neutral' },
  { index: 21, name: 'Sadalbali', startArcsec: 270 * ARCSECONDS_PER_DEGREE, endArcsec: 282 * ARCSECONDS_PER_DEGREE + 51 * 60, ruler: 'Venus', nature: 'benefic' },
  { index: 22, name: 'Almuhassab', startArcsec: 282 * ARCSECONDS_PER_DEGREE + 51 * 60, endArcsec: 295 * ARCSECONDS_PER_DEGREE + 42 * 60, ruler: 'Mars', nature: 'harmful' },
  { index: 23, name: 'Alauwa', startArcsec: 295 * ARCSECONDS_PER_DEGREE + 42 * 60, endArcsec: 308 * ARCSECONDS_PER_DEGREE + 35 * 60, ruler: 'Moon', nature: 'benefic' },
  { index: 24, name: 'Asimakrab', startArcsec: 308 * ARCSECONDS_PER_DEGREE + 35 * 60, endArcsec: 321 * ARCSECONDS_PER_DEGREE + 28 * 60, ruler: 'Saturn', nature: 'harmful' },
  { index: 25, name: 'Alghafr', startArcsec: 321 * ARCSECONDS_PER_DEGREE + 28 * 60, endArcsec: 334 * ARCSECONDS_PER_DEGREE + 21 * 60, ruler: 'Mercury', nature: 'neutral' },
  { index: 26, name: 'Azubana', startArcsec: 334 * ARCSECONDS_PER_DEGREE + 21 * 60, endArcsec: 347 * ARCSECONDS_PER_DEGREE + 14 * 60, ruler: 'Venus', nature: 'benefic' },
  { index: 27, name: 'Alikil', startArcsec: 347 * ARCSECONDS_PER_DEGREE + 14 * 60, endArcsec: ARCSECONDS_PER_CIRCLE, ruler: 'Moon', nature: 'benefic' },
];

/**
 * Find which lunar mansion a given longitude falls in
 */
export function findLunarMansion(lonArcsec: number): LunarMansion {
  const normalizedLon = normalizeArcsec(lonArcsec);
  
  for (const mansion of LUNAR_MANSIONS) {
    if (normalizedLon >= mansion.startArcsec && normalizedLon < mansion.endArcsec) {
      return mansion;
    }
  }
  
  // Should never happen, but return the last mansion as fallback
  return LUNAR_MANSIONS[LUNAR_MANSIONS.length - 1];
}

/**
 * Find all planets in each lunar mansion
 */
export function planetsInLunarMansions(
  planets: Array<{ name: PlanetName; lon: number }>
): Record<number, PlanetName[]> {
  const result: Record<number, PlanetName[]> = {};
  
  for (const mansion of LUNAR_MANSIONS) {
    result[mansion.index] = [];
  }
  
  for (const planet of planets) {
    const mansion = findLunarMansion(planet.lon);
    result[mansion.index].push(planet.name);
  }
  
  return result;
}

// ============================================================================
// PRENATAL SYZYGY
// ============================================================================

/**
 * Find the last New or Full Moon before a given date (Julian Day)
 * This is a simplified calculation - in practice, you would need ephemeris data
 */
export function findPrenatalSyzygy(
  birthJd: number,
  sunLonAtBirth: number, // Sun longitude in arcseconds
  moonLonAtBirth: number // Moon longitude in arcseconds
): PrenatalSyzygy {
  // This is a placeholder implementation
  // In practice, you would:
  // 1. Calculate the Sun and Moon positions for days before birth
  // 2. Find the last time when Sun and Moon were in conjunction (New Moon) or opposition (Full Moon)
  // 3. Return that information
  
  // For now, return a dummy result
  const elongation = angularSeparationArcsec(sunLonAtBirth, moonLonAtBirth);
  const isFullMoon = elongation > 170 * ARCSECONDS_PER_DEGREE;
  
  return {
    type: isFullMoon ? 'fullMoon' : 'newMoon',
    jd: birthJd - 15, // Approximate (actual would be ~29.5 days for New Moon)
    longitudeArcsec: isFullMoon ? sunLonAtBirth + 180 * ARCSECONDS_PER_DEGREE : sunLonAtBirth,
    daysBeforeBirth: isFullMoon ? 14.75 : 29.5, // Approximate
  };
}

// ============================================================================
// FIXED STARS
// ============================================================================

/**
 * Major fixed stars with their positions
 * Positions are approximate and based on epoch J2000
 */
export const FIXED_STARS: FixedStar[] = [
  { name: 'Regulus', longitudeArcsec: 148 * ARCSECONDS_PER_DEGREE, declinationArcsec: 12 * ARCSECONDS_PER_DEGREE, magnitude: 1.35, nature: 'Jupiter/Mars' },
  { name: 'Spica', longitudeArcsec: 203 * ARCSECONDS_PER_DEGREE + 50 * 60, declinationArcsec: -11 * ARCSECONDS_PER_DEGREE, magnitude: 0.97, nature: 'Venus/Mercury' },
  { name: 'Algol', longitudeArcsec: 41 * ARCSECONDS_PER_DEGREE + 10 * 60, declinationArcsec: 40 * ARCSECONDS_PER_DEGREE + 55 * 60, magnitude: 2.12, nature: 'Saturn' },
  { name: 'Aldebaran', longitudeArcsec: 68 * ARCSECONDS_PER_DEGREE + 35 * 60, declinationArcsec: 16 * ARCSECONDS_PER_DEGREE + 31 * 60, magnitude: 0.85, nature: 'Mars' },
  { name: 'Antares', longitudeArcsec: 247 * ARCSECONDS_PER_DEGREE + 3 * 60, declinationArcsec: -26 * ARCSECONDS_PER_DEGREE + 26 * 60, magnitude: 0.96, nature: 'Mars' },
  { name: 'Fomalhaut', longitudeArcsec: 354 * ARCSECONDS_PER_DEGREE + 13 * 60, declinationArcsec: -29 * ARCSECONDS_PER_DEGREE + 35 * 60, magnitude: 1.16, nature: 'Venus/Mercury' },
  { name: 'Sirius', longitudeArcsec: 102 * ARCSECONDS_PER_DEGREE + 43 * 60, declinationArcsec: -16 * ARCSECONDS_PER_DEGREE + 43 * 60, magnitude: -1.46, nature: 'Jupiter' },
];

/**
 * Find conjunctions between planets and fixed stars
 */
export function findFixedStarConjunctions(
  planets: Array<{ name: PlanetName; lon: number; decl?: number }>,
  orbArcsec: number = 2 * ARCSECONDS_PER_DEGREE
): FixedStarConjunction[] {
  const conjunctions: FixedStarConjunction[] = [];
  
  for (const planet of planets) {
    for (const star of FIXED_STARS) {
      const separation = angularSeparationArcsec(planet.lon, star.longitudeArcsec);
      
      if (separation <= orbArcsec) {
        conjunctions.push({
          star: star.name,
          planet: planet.name,
          separationArcsec: separation,
          orbArcsec,
        });
      }
    }
  }
  
  return conjunctions;
}

// ============================================================================
// ENHANCED LUNAR PHASE
// ============================================================================

/**
 * Calculate enhanced lunar phase with exact illumination
 */
export function calculateEnhancedLunarPhase(
  sunLonArcsec: number,
  moonLonArcsec: number,
  moonLatArcsec: number = 0
): EnhancedLunarPhase {
  // Elongation (difference in longitude)
  const elongationArcsec = angularSeparationArcsec(sunLonArcsec, moonLonArcsec);
  const elongationDeg = elongationArcsec / ARCSECONDS_PER_DEGREE;
  
  // Illumination calculation using exact formula
  // illumination = (1 - cos(elongation)) / 2
  // For exact calculation, we use BigInt
  
  // Convert elongation to radians for calculation
  const elongationRad = elongationDeg * Math.PI / 180;
  const illuminationFloat = (1 - Math.cos(elongationRad)) / 2;
  
  // Convert to BigInt fraction (approximate)
  // For true exactness, we'd need to use trigonometric identities with integers
  // For now, we'll use a scaled integer approximation
  const scale = 1000000n;
  const numerator = BigInt(Math.round(illuminationFloat * Number(scale)));
  const denominator = scale;
  
  // Determine phase
  let phase: string;
  const waxing = elongationDeg < 180;
  
  if (elongationDeg < 15) {
    phase = 'New';
  } else if (elongationDeg < 45) {
    phase = 'Waxing Crescent';
  } else if (elongationDeg < 90) {
    phase = 'First Quarter';
  } else if (elongationDeg < 135) {
    phase = 'Waxing Gibbous';
  } else if (elongationDeg < 165) {
    phase = 'Full';
  } else if (elongationDeg < 210) {
    phase = 'Waning Gibbous';
  } else if (elongationDeg < 255) {
    phase = 'Last Quarter';
  } else if (elongationDeg < 300) {
    phase = 'Waning Crescent';
  } else {
    phase = 'New';
  }
  
  // Lunar day (age in current lunation)
  // This requires knowing the last New Moon, which we don't have here
  // For now, estimate based on elongation
  const synodicPhase = elongationDeg / 360;
  const lunarDay = synodicPhase * 29.53; // Approximate synodic month length
  
  return {
    elongationArcsec,
    elongationDeg,
    illumination: { numerator, denominator },
    illuminationFloat,
    phase,
    waxing,
    lunarDay,
    synodicPhase,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize arcseconds to [0, ARCSECONDS_PER_CIRCLE)
 */
function normalizeArcsec(arcsec: number): number {
  let result = arcsec % ARCSECONDS_PER_CIRCLE;
  if (result < 0) result += ARCSECONDS_PER_CIRCLE;
  return result;
}

/**
 * Compute the smallest angular separation between two positions in arcseconds
 */
function angularSeparationArcsec(a: number, b: number): number {
  const diff = normalizeArcsec(a - b);
  return Math.min(diff, ARCSECONDS_PER_CIRCLE - diff);
}

// Re-export DOMICILE_RULERS for external use
export { DOMICILE_RULERS, EXALTATION_RULERS };
