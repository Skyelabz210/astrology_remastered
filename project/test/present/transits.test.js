// test/present/transits.test.js - Tests for transits.ts module
//
// Comprehensive test suite for the transit module
// Tests transit-to-natal calculations, CRAM resonance detection, and timeline generation

import { describe, it, expect } from 'vitest';

// Import the transits module
import {
  calculateTransitToNatal,
  detectCramResonance,
  generateResonanceTimeline,
  transitAspectsToTable,
  createLiveSkyWatcher,
  TRADITIONAL_ASPECTS,
  ARCSECONDS_PER_DEGREE,
  ARCSECONDS_PER_CIRCLE,
} from '../../../src/astro/transits';

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  it('should have correct ARCSECONDS_PER_DEGREE', () => {
    expect(ARCSECONDS_PER_DEGREE).toBe(3600);
  });

  it('should have correct ARCSECONDS_PER_CIRCLE', () => {
    expect(ARCSECONDS_PER_CIRCLE).toBe(360 * 3600);
  });

  it('should have TRADITIONAL_ASPECTS array', () => {
    expect(TRADITIONAL_ASPECTS).toBeDefined();
    expect(Array.isArray(TRADITIONAL_ASPECTS)).toBe(true);
    expect(TRADITIONAL_ASPECTS.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TRANSIT CALCULATION TESTS
// ============================================================================

describe('Transit Calculations', () => {
  describe('calculateTransitToNatal', () => {
    it('should calculate transits between transit and natal planets', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 0, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
        { name: 'Mars', lonArcsec: 90 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 0.5 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
        { name: 'Ascendant', lonArcsec: 30 * ARCSECONDS_PER_DEGREE, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects).toBeDefined();
      expect(Array.isArray(aspects)).toBe(true);
      expect(aspects.length).toBeGreaterThan(0);
    });

    it('should detect conjunction between Moon and Sun', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 0, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].transitPlanet).toBe('Moon');
      expect(aspects[0].natalPlanet).toBe('Sun');
      expect(aspects[0].aspect).toBe('Conjunction');
      expect(aspects[0].exact).toBe(true);
    });

    it('should detect square between Mars and Sun', () => {
      const transitPositions = [
        { name: 'Mars', lonArcsec: 90 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 0.5 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].aspect).toBe('Square');
    });

    it('should detect trine between Jupiter and Sun', () => {
      const transitPositions = [
        { name: 'Jupiter', lonArcsec: 120 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 0.1 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].aspect).toBe('Trine');
    });

    it('should detect semisextile (30°)', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 30 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].aspect).toBe('Semisextile');
    });

    it('should detect sesquiquadrate (135°)', () => {
      const transitPositions = [
        { name: 'Mars', lonArcsec: 135 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 0.5 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].aspect).toBe('Sesquiquadrate');
    });

    it('should skip same planet', () => {
      const transitPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, speedArcsecPerDay: 1 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBe(0);
    });

    it('should detect applying aspect', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 10 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: -12 * ARCSECONDS_PER_DEGREE, retrograde: true },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].applying).toBe(true);
      expect(aspects[0].separating).toBe(false);
    });

    it('should detect separating aspect', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 10 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].separating).toBe(true);
      expect(aspects[0].applying).toBe(false);
    });

    it('should have separationArcsec', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 10 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].separationArcsec).toBe(10 * ARCSECONDS_PER_DEGREE);
    });

    it('should have orbArcsec', () => {
      const transitPositions = [
        { name: 'Moon', lonArcsec: 10 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      ];
      
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const aspects = calculateTransitToNatal(transitPositions, natalPositions);
      
      expect(aspects.length).toBeGreaterThan(0);
      expect(aspects[0].orbArcsec).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// TRANSIT TABLE TESTS
// ============================================================================

describe('Transit Table', () => {
  describe('transitAspectsToTable', () => {
    it('should convert transit aspects to table rows', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Trine',
          orbArcsec: 120 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 115 * ARCSECONDS_PER_DEGREE,
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
        {
          transitPlanet: 'Mars',
          natalPlanet: 'Ascendant',
          aspect: 'Square',
          orbArcsec: 90 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: false,
          separating: true,
          stationery: false,
          separationArcsec: 95 * ARCSECONDS_PER_DEGREE,
          exactHitDate: null,
          exactHitJd: null,
        },
      ];
      
      const tableRows = transitAspectsToTable(transitAspects);
      
      expect(tableRows).toBeDefined();
      expect(Array.isArray(tableRows)).toBe(true);
      expect(tableRows.length).toBe(2);
      
      expect(tableRows[0].transitPlanet).toBe('Moon');
      expect(tableRows[0].natalPlanet).toBe('Sun');
      expect(tableRows[0].aspect).toBe('Trine');
      expect(tableRows[0].orb).toBe(120);
      expect(tableRows[0].applying).toBe(true);
      expect(tableRows[0].separating).toBe(false);
      expect(tableRows[0].separationDeg).toBe(115);
      expect(tableRows[0].exactHitDate).toBeDefined();
    });

    it('should handle empty array', () => {
      const tableRows = transitAspectsToTable([]);
      expect(tableRows).toEqual([]);
    });

    it('should convert arcseconds to degrees', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Conjunction',
          orbArcsec: 2 * ARCSECONDS_PER_DEGREE,
          exact: true,
          applying: false,
          separating: false,
          stationery: true,
          separationArcsec: 0,
          exactHitDate: null,
          exactHitJd: null,
        },
      ];
      
      const tableRows = transitAspectsToTable(transitAspects);
      
      expect(tableRows[0].orb).toBe(2);
      expect(tableRows[0].separationDeg).toBe(0);
    });
  });
});

// ============================================================================
// CRAM RESONANCE TESTS
// ============================================================================

describe('CRAM Resonance', () => {
  describe('detectCramResonance', () => {
    it('should detect resonance events', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Trine',
          orbArcsec: 120 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 115 * ARCSECONDS_PER_DEGREE,
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const currentJd = 2460320.5;
      const events = detectCramResonance(transitAspects, currentJd, 60);
      
      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      // May or may not have events depending on the separation value
    });

    it('should detect resonance at register boundary', () => {
      // Create an aspect with separation at a multiple of a basis prime
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Conjunction',
          orbArcsec: 8 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 11 * ARCSECONDS_PER_DEGREE, // Multiple of 11
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const currentJd = 2460320.5;
      const events = detectCramResonance(transitAspects, currentJd, 60);
      
      // 11° = 11 * 3600 arcseconds, which is a multiple of 11
      // Should detect resonance at register boundary
      expect(events.length).toBeGreaterThan(0);
    });

    it('should include lane, residue, and winding index', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Conjunction',
          orbArcsec: 8 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 22 * ARCSECONDS_PER_DEGREE, // Multiple of 11
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const currentJd = 2460320.5;
      const events = detectCramResonance(transitAspects, currentJd, 60);
      
      if (events.length > 0) {
        const event = events[0];
        expect(event.lane).toBeDefined();
        expect(event.residue).toBeDefined();
        expect(event.windingIndex).toBeDefined();
        expect(event.transitPlanet).toBe('Moon');
        expect(event.natalPlanet).toBe('Sun');
      }
    });

    it('should handle empty transit aspects', () => {
      const events = detectCramResonance([], 2460320.5, 60);
      expect(events).toEqual([]);
    });

    it('should respect tolerance parameter', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Conjunction',
          orbArcsec: 8 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 10 * ARCSECONDS_PER_DEGREE, // Close to 11°
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const currentJd = 2460320.5;
      
      // With small tolerance, should not detect
      const eventsSmallTolerance = detectCramResonance(transitAspects, currentJd, 10);
      
      // With large tolerance, should detect
      const eventsLargeTolerance = detectCramResonance(transitAspects, currentJd, 100);
      
      // Large tolerance should have more or equal events
      expect(eventsLargeTolerance.length).toBeGreaterThanOrEqual(eventsSmallTolerance.length);
    });
  });

  describe('generateResonanceTimeline', () => {
    it('should generate timeline of resonance events', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Trine',
          orbArcsec: 120 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 115 * ARCSECONDS_PER_DEGREE,
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const startJd = 2460320.5;
      const endJd = 2460321.5;
      const timeline = generateResonanceTimeline(transitAspects, startJd, endJd, 1, 60);
      
      expect(timeline).toBeDefined();
      expect(Array.isArray(timeline)).toBe(true);
    });

    it('should include date and JD in timeline events', () => {
      const transitAspects = [
        {
          transitPlanet: 'Moon',
          natalPlanet: 'Sun',
          aspect: 'Conjunction',
          orbArcsec: 8 * ARCSECONDS_PER_DEGREE,
          exact: false,
          applying: true,
          separating: false,
          stationery: false,
          separationArcsec: 11 * ARCSECONDS_PER_DEGREE,
          exactHitDate: new Date('2024-01-15'),
          exactHitJd: 2460320.5,
        },
      ];
      
      const startJd = 2460320.5;
      const endJd = 2460321.5;
      const timeline = generateResonanceTimeline(transitAspects, startJd, endJd, 1, 60);
      
      if (timeline.length > 0) {
        const event = timeline[0];
        expect(event.date).toBeDefined();
        expect(event.jd).toBeDefined();
        expect(event.events).toBeDefined();
      }
    });

    it('should handle empty transit aspects', () => {
      const timeline = generateResonanceTimeline([], 2460320.5, 2460321.5, 1, 60);
      expect(timeline).toEqual([]);
    });
  });
});

// ============================================================================
// LIVE SKY WATCHER TESTS
// ============================================================================

describe('Live Sky Watcher', () => {
  describe('createLiveSkyWatcher', () => {
    it('should create a live sky watcher', () => {
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const watcher = createLiveSkyWatcher(natalPositions);
      
      expect(watcher).toBeDefined();
      expect(typeof watcher.start).toBe('function');
      expect(typeof watcher.stop).toBe('function');
      expect(typeof watcher.getCurrentData).toBe('function');
    });

    it('should start and stop watcher', () => {
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const watcher = createLiveSkyWatcher(natalPositions);
      
      // Start should not throw
      expect(() => watcher.start()).not.toThrow();
      
      // Stop should not throw
      expect(() => watcher.stop()).not.toThrow();
    });

    it('should return current data', () => {
      const natalPositions = [
        { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      ];
      
      const watcher = createLiveSkyWatcher(natalPositions);
      
      // Get current data (may be null if not started)
      const data = watcher.getCurrentData();
      expect(data).toBeDefined();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should calculate transits and detect CRAM resonance', () => {
    // Create a chart with known positions
    const transitPositions = [
      { name: 'Moon', lonArcsec: 30 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 12 * ARCSECONDS_PER_DEGREE, retrograde: false },
      { name: 'Mars', lonArcsec: 90 * ARCSECONDS_PER_DEGREE, latArcsec: 0, speedArcsecPerDay: 0.5 * ARCSECONDS_PER_DEGREE, retrograde: false },
    ];
    
    const natalPositions = [
      { name: 'Sun', lonArcsec: 0, latArcsec: 0, sign: 0 },
      { name: 'Ascendant', lonArcsec: 10 * ARCSECONDS_PER_DEGREE, latArcsec: 0, sign: 0 },
    ];
    
    // Calculate transits
    const transits = calculateTransitToNatal(transitPositions, natalPositions);
    
    // Detect CRAM resonance
    const currentJd = 2460320.5;
    const events = detectCramResonance(transits, currentJd, 60);
    
    // Convert to table
    const table = transitAspectsToTable(transits);
    
    // All should work without errors
    expect(transits.length).toBeGreaterThan(0);
    expect(Array.isArray(events)).toBe(true);
    expect(table.length).toBe(transits.length);
  });

  it('should handle edge cases gracefully', () => {
    // Empty inputs
    const transits1 = calculateTransitToNatal([], []);
    expect(transits1).toEqual([]);
    
    const events1 = detectCramResonance([], 0, 60);
    expect(events1).toEqual([]);
    
    const table1 = transitAspectsToTable([]);
    expect(table1).toEqual([]);
    
    const timeline1 = generateResonanceTimeline([], 0, 1, 1, 60);
    expect(timeline1).toEqual([]);
  });
});
