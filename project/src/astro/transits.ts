// src/astro/transits.ts - Transits Module
//
// Pure TypeScript module for transit calculations.
// All calculations use integer arcseconds for precision.
// 
// This module provides:
// - Transit-to-natal aspect calculations
// - Exact hit date estimation
// - CRAM resonance detection
// - Timeline event generation
//
// ============================================================================
// CONSTANTS AND TYPES
// ============================================================================

const ARCSECONDS_PER_DEGREE = 3600;
const ARCSECONDS_PER_CIRCLE = 360 * ARCSECONDS_PER_DEGREE;
const ARCSECONDS_PER_DAY = 86400; // Not exactly right, but for rate calculations

/**
 * Planet names
 */
export type PlanetName = 
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn'
  | 'Uranus' | 'Neptune' | 'Pluto' | 'NorthNode' | 'SouthNode' | 'Chiron' | 'Lilith';

/**
 * Transit aspect result
 */
export interface TransitAspect {
  transitPlanet: PlanetName;
  natalPlanet: PlanetName;
  aspect: string;
  orbArcsec: number;
  exact: boolean;
  applying: boolean;
  separating: boolean;
  stationery: boolean;
  separationArcsec: number;
  exactHitDate: Date | null; // Estimated date when aspect will be exact
  exactHitJd: number | null; // Estimated Julian Day when aspect will be exact
}

/**
 * Transit position data
 */
export interface TransitPosition {
  name: PlanetName;
  lonArcsec: number;
  latArcsec: number;
  speedArcsecPerDay: number; // Can be negative for retrograde
  retrograde: boolean;
}

/**
 * Natal position data
 */
export interface NatalPosition {
  name: PlanetName;
  lonArcsec: number;
  latArcsec: number;
  sign: number; // 0-11
}

/**
 * CRAM resonance event
 */
export interface CramResonanceEvent {
  timestamp: Date;
  jd: number;
  transitPlanet: PlanetName;
  natalPlanet: PlanetName;
  lane: number; // 0-10 (mod 11)
  residue: number; // Residue value
  windingIndex: number;
  separationArcsec: number;
  aspect: string;
}

/**
 * Transit table row for display
 */
export interface TransitTableRow {
  transitPlanet: PlanetName;
  natalPlanet: PlanetName;
  aspect: string;
  orb: number; // In degrees
  applying: boolean;
  separating: boolean;
  exactHitDate: Date | null;
  separationDeg: number;
}

/**
 * Transit timeline event
 */
export interface TransitTimelineEvent {
  date: Date;
  jd: number;
  events: CramResonanceEvent[];
}

// ============================================================================
// IMPORT TRADITIONAL ASPECTS
// ============================================================================

// Import from traditional.ts (we'll reference the values directly here for now)
// In practice, these would be imported from the traditional.ts module

const TRADITIONAL_ASPECTS = [
  { name: 'Conjunction', angleArcsec: 0, orbArcsec: 8 * ARCSECONDS_PER_DEGREE, family: 'cardinal' },
  { name: 'Opposition', angleArcsec: 180 * ARCSECONDS_PER_DEGREE, orbArcsec: 8 * ARCSECONDS_PER_DEGREE, family: 'cardinal' },
  { name: 'Trine', angleArcsec: 120 * ARCSECONDS_PER_DEGREE, orbArcsec: 7 * ARCSECONDS_PER_DEGREE, family: 'classical' },
  { name: 'Square', angleArcsec: 90 * ARCSECONDS_PER_DEGREE, orbArcsec: 7 * ARCSECONDS_PER_DEGREE, family: 'classical' },
  { name: 'Sextile', angleArcsec: 60 * ARCSECONDS_PER_DEGREE, orbArcsec: 5 * ARCSECONDS_PER_DEGREE, family: 'classical' },
  { name: 'Quincunx', angleArcsec: 150 * ARCSECONDS_PER_DEGREE, orbArcsec: 3 * ARCSECONDS_PER_DEGREE, family: 'minor' },
  { name: 'Semisquare', angleArcsec: 45 * ARCSECONDS_PER_DEGREE, orbArcsec: 2 * ARCSECONDS_PER_DEGREE, family: 'minor' },
  { name: 'Quintile', angleArcsec: 72 * ARCSECONDS_PER_DEGREE, orbArcsec: 2 * ARCSECONDS_PER_DEGREE, family: 'quintile' },
  { name: 'BiQuintile', angleArcsec: 144 * ARCSECONDS_PER_DEGREE, orbArcsec: 2 * ARCSECONDS_PER_DEGREE, family: 'quintile' },
  { name: 'Semisextile', angleArcsec: 30 * ARCSECONDS_PER_DEGREE, orbArcsec: 2 * ARCSECONDS_PER_DEGREE, family: 'minor' },
  { name: 'Sesquiquadrate', angleArcsec: 135 * ARCSECONDS_PER_DEGREE, orbArcsec: 2 * ARCSECONDS_PER_DEGREE, family: 'minor' },
  { name: 'Novile', angleArcsec: 40 * ARCSECONDS_PER_DEGREE, orbArcsec: Math.round(1.5 * ARCSECONDS_PER_DEGREE), family: 'novile' },
  { name: 'Decile', angleArcsec: 36 * ARCSECONDS_PER_DEGREE, orbArcsec: Math.round(1.2 * ARCSECONDS_PER_DEGREE), family: 'decile' },
  { name: 'Tridecile', angleArcsec: 108 * ARCSECONDS_PER_DEGREE, orbArcsec: Math.round(1.2 * ARCSECONDS_PER_DEGREE), family: 'tridecile' },
];

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

/**
 * Convert Julian Day to Date
 */
function jdToDate(jd: number): Date {
  // JD 2440587.5 = 1970-01-01T00:00:00Z (Unix epoch)
  const milliseconds = (jd - 2440587.5) * 86400000;
  return new Date(milliseconds);
}

/**
 * Convert Date to Julian Day
 */
function dateToJd(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

// ============================================================================
// TRANSIT CALCULATIONS
// ============================================================================

/**
 * Calculate all transits from transiting planets to natal points
 */
export function calculateTransitToNatal(
  transitPositions: TransitPosition[],
  natalPositions: NatalPosition[],
  aspects: typeof TRADITIONAL_ASPECTS = TRADITIONAL_ASPECTS
): TransitAspect[] {
  const results: TransitAspect[] = [];
  
  for (const transit of transitPositions) {
    for (const natal of natalPositions) {
      // Skip same planet
      if (transit.name === natal.name) continue;
      
      // Calculate separation
      const separation = angularSeparationArcsec(transit.lonArcsec, natal.lonArcsec);
      
      // Find nearest aspect
      const aspect = findNearestAspect(separation, aspects);
      
      if (aspect) {
        // Determine applying/separating
        const phase = determinePhase(
          transit.lonArcsec,
          natal.lonArcsec,
          transit.speedArcsecPerDay,
          0, // Natal planets are stationary
          aspect.angleArcsec
        );
        
        // Calculate exact hit date
        const exactHit = calculateExactHit(
          transit.lonArcsec,
          natal.lonArcsec,
          transit.speedArcsecPerDay,
          aspect.angleArcsec
        );
        
        results.push({
          transitPlanet: transit.name,
          natalPlanet: natal.name,
          aspect: aspect.name,
          orbArcsec: aspect.orbArcsec,
          exact: separation === 0,
          applying: phase === 'applying',
          separating: phase === 'separating',
          stationery: phase === 'stationary',
          separationArcsec: separation,
          exactHitDate: exactHit ? jdToDate(exactHit.jd) : null,
          exactHitJd: exactHit ? exactHit.jd : null,
        });
      }
    }
  }
  
  return results;
}

/**
 * Find the nearest aspect for a given separation
 */
function findNearestAspect(
  separationArcsec: number,
  aspects: typeof TRADITIONAL_ASPECTS
): { name: string; angleArcsec: number; orbArcsec: number } | null {
  let best: { name: string; angleArcsec: number; orbArcsec: number; sep: number } | null = null;
  
  for (const aspect of aspects) {
    const target1 = aspect.angleArcsec;
    const target2 = ARCSECONDS_PER_CIRCLE - aspect.angleArcsec;
    
    const sep1 = angularSeparationArcsec(separationArcsec, target1);
    const sep2 = angularSeparationArcsec(separationArcsec, target2);
    const minSep = Math.min(sep1, sep2);
    
    if (minSep <= aspect.orbArcsec) {
      if (!best || minSep < best.sep) {
        best = {
          name: aspect.name,
          angleArcsec: aspect.angleArcsec,
          orbArcsec: aspect.orbArcsec,
          sep: minSep,
        };
      }
    }
  }
  
  return best ?? null;
}

/**
 * Determine if an aspect is applying, separating, or stationary
 */
function determinePhase(
  transitLon: number,
  natalLon: number,
  transitSpeed: number,
  natalSpeed: number,
  targetAngle: number
): 'applying' | 'separating' | 'stationary' {
  const relSpeed = transitSpeed - natalSpeed;
  
  // If relative speed is zero, aspect is stationary
  if (relSpeed === 0) {
    return 'stationary';
  }
  
  // Current separation
  const currentSep = angularSeparationArcsec(transitLon, natalLon);
  
  // Separation after a small time step (1 minute = 1/1440 day)
  const stepDays = 1 / 1440;
  const transitLonFuture = normalizeArcsec(transitLon + Math.round(transitSpeed * stepDays * ARCSECONDS_PER_DAY));
  const natalLonFuture = natalLon; // Natal is stationary
  const futureSep = angularSeparationArcsec(transitLonFuture, natalLonFuture);
  
  // Distance to target
  const distToTargetCurrent = Math.min(
    angularSeparationArcsec(currentSep, targetAngle),
    angularSeparationArcsec(currentSep, ARCSECONDS_PER_CIRCLE - targetAngle)
  );
  
  const distToTargetFuture = Math.min(
    angularSeparationArcsec(futureSep, targetAngle),
    angularSeparationArcsec(futureSep, ARCSECONDS_PER_CIRCLE - targetAngle)
  );
  
  if (distToTargetFuture < distToTargetCurrent) {
    return 'applying';
  } else if (distToTargetFuture > distToTargetCurrent) {
    return 'separating';
  }
  
  return 'stationary';
}

/**
 * Calculate when a transit will be exact
 */
function calculateExactHit(
  transitLon: number,
  natalLon: number,
  transitSpeed: number,
  targetAngle: number
): { jd: number; separationArcsec: number } | null {
  // Only calculate if transit is applying
  const phase = determinePhase(transitLon, natalLon, transitSpeed, 0, targetAngle);
  if (phase !== 'applying') {
    return null;
  }
  
  // Current separation
  const currentSep = angularSeparationArcsec(transitLon, natalLon);
  
  // Distance to exact aspect
  const distToTarget = angularSeparationArcsec(currentSep, targetAngle);
  
  // Time to exact aspect (in days)
  // Note: transitSpeed is in arcseconds/day
  const timeToExactDays = distToTarget / Math.abs(transitSpeed);
  
  // If speed is negative (retrograde), we need to check direction
  const relSpeed = transitSpeed; // Natal is stationary
  
  // Only calculate if transit is moving toward the aspect
  if (timeToExactDays < 0) {
    return null;
  }
  
  // For now, return a dummy result
  // In practice, you would need the current JD to calculate the exact date
  return {
    jd: 0, // Would be currentJd + timeToExactDays
    separationArcsec: 0,
  };
}

// ============================================================================
// CRAM RESONANCE DETECTION
// ============================================================================

/**
 * CRAM basis primes: 2, 3, 5, 7, 11, 13, 17, 19
 */
const CRAM_BASIS = [2, 3, 5, 7, 11, 13, 17, 19];
const CRAM_PRODUCT = CRAM_BASIS.reduce((a, b) => a * b, 1); // 9699690

/**
 * Calculate residues for a given value
 */
function calculateResidues(valueArcsec: number): Record<number, number> {
  const result: Record<number, number> = {};
  
  for (const prime of CRAM_BASIS) {
    result[prime] = Math.floor(valueArcsec) % prime;
  }
  
  return result;
}

/**
 * Detect CRAM resonance events
 * 
 * A resonance event occurs when a transit's arcsecond separation lands on
 * a register boundary of the CRAM basis (residue match within tolerance).
 */
export function detectCramResonance(
  transitAspects: TransitAspect[],
  currentJd: number,
  toleranceArcsec: number = 60 // 1 arcminute tolerance
): CramResonanceEvent[] {
  const events: CramResonanceEvent[] = [];
  
  for (const aspect of transitAspects) {
    // Calculate residues for the separation
    const residues = calculateResidues(aspect.separationArcsec);
    
    // Check each basis prime for resonance
    for (const prime of CRAM_BASIS) {
      const residue = residues[prime];
      const registerBoundary = 0; // Register boundary is at residue 0
      
      // Check if residue is within tolerance of boundary
      if (Math.abs(residue) <= toleranceArcsec || Math.abs(residue - prime) <= toleranceArcsec) {
        // Calculate winding index
        const windingIndex = Math.floor(aspect.separationArcsec / prime);
        
        // Calculate lane (mod 11)
        const lane = Math.floor(aspect.separationArcsec) % 11;
        
        events.push({
          timestamp: new Date(),
          jd: currentJd,
          transitPlanet: aspect.transitPlanet,
          natalPlanet: aspect.natalPlanet,
          lane,
          residue,
          windingIndex,
          separationArcsec: aspect.separationArcsec,
          aspect: aspect.aspect,
        });
      }
    }
  }
  
  return events;
}

/**
 * Generate a timeline of CRAM resonance events
 */
export function generateResonanceTimeline(
  transitAspects: TransitAspect[],
  startJd: number,
  endJd: number,
  intervalDays: number = 1,
  toleranceArcsec: number = 60
): TransitTimelineEvent[] {
  const timeline: TransitTimelineEvent[] = [];
  
  // For now, just create events at the current time
  // In practice, you would:
  // 1. Advance each transit position by the time interval
  // 2. Recalculate aspects
  // 3. Detect resonance events
  // 4. Add to timeline
  
  const currentEvents = detectCramResonance(transitAspects, startJd, toleranceArcsec);
  
  if (currentEvents.length > 0) {
    timeline.push({
      date: jdToDate(startJd),
      jd: startJd,
      events: currentEvents,
    });
  }
  
  return timeline;
}

// ============================================================================
// TRANSIT TABLE FOR DISPLAY
// ============================================================================

/**
 * Convert transit aspects to display-ready table rows
 */
export function transitAspectsToTable(
  transitAspects: TransitAspect[]
): TransitTableRow[] {
  return transitAspects.map(aspect => ({
    transitPlanet: aspect.transitPlanet,
    natalPlanet: aspect.natalPlanet,
    aspect: aspect.aspect,
    orb: aspect.orbArcsec / ARCSECONDS_PER_DEGREE,
    applying: aspect.applying,
    separating: aspect.separating,
    exactHitDate: aspect.exactHitDate,
    separationDeg: aspect.separationArcsec / ARCSECONDS_PER_DEGREE,
  }));
}

// ============================================================================
// LIVE SKY WATCHER
// ============================================================================

/**
 * Transiting body positions for live sky watcher
 * This would be updated every minute
 */
export interface LiveSkyData {
  timestamp: Date;
  jd: number;
  planets: TransitPosition[];
  aspectsToNatal: TransitAspect[];
  cramEvents: CramResonanceEvent[];
}

/**
 * Create a live sky watcher that updates positions
 * This is a placeholder - in practice, you would use the actual ephemeris
 */
export function createLiveSkyWatcher(
  natalPositions: NatalPosition[],
  updateIntervalMs: number = 60000 // 1 minute
): {
  start: () => void;
  stop: () => void;
  getCurrentData: () => LiveSkyData | null;
} {
  let timer: NodeJS.Timeout | null = null;
  let currentData: LiveSkyData | null = null;
  
  return {
    start: () => {
      // In practice, this would calculate current positions
      // and set up a timer to update every minute
      
      // For now, just create a dummy update
      timer = setInterval(() => {
        // Update current data
        // This would call calculateTransitToNatal with current positions
      }, updateIntervalMs);
    },
    
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    
    getCurrentData: () => currentData,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ARCSECONDS_PER_DEGREE,
  ARCSECONDS_PER_CIRCLE,
  normalizeArcsec,
  angularSeparationArcsec,
  jdToDate,
  dateToJd,
  TRADITIONAL_ASPECTS,
};
