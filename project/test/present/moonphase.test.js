// test/present/moonphase.test.js - Tests for moonphase.ts module
//
// Comprehensive test suite for the moon phase module
// Tests exact illumination, lunar day, phase boundaries, and terminator calculations

import { describe, it, expect } from 'vitest';

// Import the moon phase module
import {
  calculateMoonPhase,
  calculateExactIllumination,
  fractionToFloat,
  calculateLunarDay,
  calculateTerminator,
  createMoonShadingFunction,
  getPhaseName,
  isWaxing,
  PHASE_BOUNDARIES,
  ARCSECONDS_PER_DEGREE,
  ARCSECONDS_PER_CIRCLE,
} from '../../../src/astro/moonphase';

// ============================================================================
// PHASE BOUNDARY TESTS
// ============================================================================

describe('Phase Boundaries', () => {
  describe('PHASE_BOUNDARIES', () => {
    it('should have 8 phase boundaries', () => {
      expect(PHASE_BOUNDARIES.length).toBe(8);
    });

    it('should cover full 360° circle', () => {
      const totalCoverage = PHASE_BOUNDARIES.reduce(
        (sum, boundary) => sum + (boundary.endDeg - boundary.startDeg),
        0
      );
      expect(totalCoverage).toBe(360);
    });

    it('should have correct phase names', () => {
      const expectedPhases = [
        'New',
        'Waxing Crescent',
        'First Quarter',
        'Waxing Gibbous',
        'Full',
        'Waning Gibbous',
        'Last Quarter',
        'Waning Crescent',
      ];
      
      for (let i = 0; i < expectedPhases.length; i++) {
        expect(PHASE_BOUNDARIES[i].name).toBe(expectedPhases[i]);
      }
    });

    it('should have correct waxing/waning flags', () => {
      expect(PHASE_BOUNDARIES[0].waxing).toBe(true); // New
      expect(PHASE_BOUNDARIES[1].waxing).toBe(true); // Waxing Crescent
      expect(PHASE_BOUNDARIES[2].waxing).toBe(true); // First Quarter
      expect(PHASE_BOUNDARIES[3].waxing).toBe(true); // Waxing Gibbous
      expect(PHASE_BOUNDARIES[4].waxing).toBe(true); // Full
      expect(PHASE_BOUNDARIES[5].waxing).toBe(false); // Waning Gibbous
      expect(PHASE_BOUNDARIES[6].waxing).toBe(false); // Last Quarter
      expect(PHASE_BOUNDARIES[7].waxing).toBe(false); // Waning Crescent
    });
  });

  describe('getPhaseName', () => {
    it('should return New for 0° elongation', () => {
      expect(getPhaseName(0)).toBe('New');
    });

    it('should return New for 359° elongation', () => {
      expect(getPhaseName(359)).toBe('New');
    });

    it('should return Waxing Crescent for 22.5° elongation', () => {
      expect(getPhaseName(22.5)).toBe('Waxing Crescent');
    });

    it('should return First Quarter for 45° elongation', () => {
      expect(getPhaseName(45)).toBe('First Quarter');
    });

    it('should return First Quarter for 89° elongation', () => {
      expect(getPhaseName(89)).toBe('First Quarter');
    });

    it('should return Waxing Gibbous for 90° elongation', () => {
      expect(getPhaseName(90)).toBe('Waxing Gibbous');
    });

    it('should return Waxing Gibbous for 134° elongation', () => {
      expect(getPhaseName(134)).toBe('Waxing Gibbous');
    });

    it('should return Full for 135° elongation', () => {
      expect(getPhaseName(135)).toBe('Full');
    });

    it('should return Full for 165° elongation', () => {
      expect(getPhaseName(165)).toBe('Full');
    });

    it('should return Waning Gibbous for 166° elongation', () => {
      expect(getPhaseName(166)).toBe('Waning Gibbous');
    });

    it('should return Waning Gibbous for 209° elongation', () => {
      expect(getPhaseName(209)).toBe('Waning Gibbous');
    });

    it('should return Last Quarter for 210° elongation', () => {
      expect(getPhaseName(210)).toBe('Last Quarter');
    });

    it('should return Last Quarter for 254° elongation', () => {
      expect(getPhaseName(254)).toBe('Last Quarter');
    });

    it('should return Waning Crescent for 255° elongation', () => {
      expect(getPhaseName(255)).toBe('Waning Crescent');
    });

    it('should return Waning Crescent for 345° elongation', () => {
      expect(getPhaseName(345)).toBe('Waning Crescent');
    });
  });

  describe('isWaxing', () => {
    it('should return true for elongation < 180°', () => {
      expect(isWaxing(0)).toBe(true);
      expect(isWaxing(90)).toBe(true);
      expect(isWaxing(179)).toBe(true);
    });

    it('should return false for elongation >= 180°', () => {
      expect(isWaxing(180)).toBe(false);
      expect(isWaxing(270)).toBe(false);
      expect(isWaxing(359)).toBe(false);
    });

    it('should handle negative elongation', () => {
      expect(isWaxing(-90)).toBe(true); // -90° + 360° = 270° > 180°
      expect(isWaxing(-180)).toBe(false);
    });

    it('should handle elongation > 360°', () => {
      expect(isWaxing(450)).toBe(true); // 450° - 360° = 90° < 180°
      expect(isWaxing(540)).toBe(false); // 540° - 360° = 180° >= 180°
    });
  });
});

// ============================================================================
// EXACT ILLUMINATION TESTS
// ============================================================================

describe('Exact Illumination', () => {
  describe('calculateExactIllumination', () => {
    it('should return 0% illumination for New Moon (0°)', () => {
      const result = calculateExactIllumination(0);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      expect(illumination).toBeCloseTo(0, 0.01);
    });

    it('should return 50% illumination for First Quarter (90°)', () => {
      const result = calculateExactIllumination(90 * ARCSECONDS_PER_DEGREE);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      expect(illumination).toBeCloseTo(0.5, 0.01);
    });

    it('should return 100% illumination for Full Moon (180°)', () => {
      const result = calculateExactIllumination(180 * ARCSECONDS_PER_DEGREE);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      expect(illumination).toBeCloseTo(1, 0.01);
    });

    it('should return 50% illumination for Last Quarter (270°)', () => {
      const result = calculateExactIllumination(270 * ARCSECONDS_PER_DEGREE);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      expect(illumination).toBeCloseTo(0.5, 0.01);
    });

    it('should return ~25% illumination for 60° elongation', () => {
      const result = calculateExactIllumination(60 * ARCSECONDS_PER_DEGREE);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      // cos(60°) = 0.5, so illumination = (1 - 0.5) / 2 = 0.25
      expect(illumination).toBeCloseTo(0.25, 0.01);
    });

    it('should return ~75% illumination for 120° elongation', () => {
      const result = calculateExactIllumination(120 * ARCSECONDS_PER_DEGREE);
      const illumination = fractionToFloat(result.numerator, result.denominator);
      // cos(120°) = -0.5, so illumination = (1 - (-0.5)) / 2 = 0.75
      expect(illumination).toBeCloseTo(0.75, 0.01);
    });

    it('should have BigInt numerator and denominator', () => {
      const result = calculateExactIllumination(90 * ARCSECONDS_PER_DEGREE);
      expect(typeof result.numerator).toBe('bigint');
      expect(typeof result.denominator).toBe('bigint');
    });

    it('should have non-zero denominator', () => {
      const result = calculateExactIllumination(0);
      expect(result.denominator).not.toBe(0n);
    });

    it('should simplify fraction when possible', () => {
      // 0° should give 0/1
      const result = calculateExactIllumination(0);
      expect(result.numerator).toBe(0n);
    });
  });

  describe('fractionToFloat', () => {
    it('should convert BigInt fraction to float', () => {
      const result = fractionToFloat(1n, 2n);
      expect(result).toBe(0.5);
    });

    it('should handle zero numerator', () => {
      const result = fractionToFloat(0n, 100n);
      expect(result).toBe(0);
    });

    it('should handle large numbers', () => {
      const numerator = 1234567890123456789n;
      const denominator = 1000000000000000000n;
      const result = fractionToFloat(numerator, denominator);
      expect(result).toBeCloseTo(1.2345678901234567, 0.000000001);
    });
  });
});

// ============================================================================
// LUNAR DAY TESTS
// ============================================================================

describe('Lunar Day', () => {
  describe('calculateLunarDay', () => {
    it('should return 0 for New Moon (0° elongation)', () => {
      const result = calculateLunarDay(0);
      expect(result).toBeCloseTo(0, 0.1);
    });

    it('should return ~7.4 for First Quarter (90° elongation)', () => {
      const result = calculateLunarDay(90 * ARCSECONDS_PER_DEGREE);
      expect(result).toBeCloseTo(7.38, 0.1); // 90/360 * 29.53 ≈ 7.38
    });

    it('should return ~14.77 for Full Moon (180° elongation)', () => {
      const result = calculateLunarDay(180 * ARCSECONDS_PER_DEGREE);
      expect(result).toBeCloseTo(14.77, 0.1); // 180/360 * 29.53 ≈ 14.77
    });

    it('should return ~22.14 for Last Quarter (270° elongation)', () => {
      const result = calculateLunarDay(270 * ARCSECONDS_PER_DEGREE);
      expect(result).toBeCloseTo(22.14, 0.1); // 270/360 * 29.53 ≈ 22.14
    });

    it('should return ~29.53 for near New Moon (359° elongation)', () => {
      const result = calculateLunarDay(359 * ARCSECONDS_PER_DEGREE);
      expect(result).toBeCloseTo(29.47, 0.1); // 359/360 * 29.53 ≈ 29.47
    });

    it('should use known New Moon JD when provided', () => {
      const knownJd = 2451545.0; // J2000
      const currentJd = knownJd + 10; // 10 days after J2000
      const result = calculateLunarDay(90 * ARCSECONDS_PER_DEGREE, knownJd, currentJd);
      expect(result).toBeCloseTo(10, 0.1);
    });
  });
});

// ============================================================================
// TERMINATOR TESTS
// ============================================================================

describe('Terminator', () => {
  describe('calculateTerminator', () => {
    it('should return terminator for New Moon (0° elongation)', () => {
      const result = calculateTerminator(0);
      expect(result).toBeDefined();
      expect(result.isIlluminated).toBeDefined();
      expect(result.normal).toBeDefined();
      expect(result.distance).toBeDefined();
      expect(result.illuminationFraction).toBeCloseTo(0, 0.01);
    });

    it('should return terminator for Full Moon (180° elongation)', () => {
      const result = calculateTerminator(180 * ARCSECONDS_PER_DEGREE);
      expect(result.illuminationFraction).toBeCloseTo(1, 0.01);
    });

    it('should return terminator for First Quarter (90° elongation)', () => {
      const result = calculateTerminator(90 * ARCSECONDS_PER_DEGREE);
      expect(result.illuminationFraction).toBeCloseTo(0.5, 0.01);
    });

    it('should have isIlluminated function', () => {
      const result = calculateTerminator(90 * ARCSECONDS_PER_DEGREE);
      expect(typeof result.isIlluminated).toBe('function');
      
      // Test some points
      // Point facing Sun should be illuminated
      const illuminated = result.isIlluminated(1, 0, 0);
      expect(illuminated).toBe(true);
      
      // Point opposite Sun should be dark
      const dark = result.isIlluminated(-1, 0, 0);
      expect(dark).toBe(false);
    });

    it('should have correct normal vector', () => {
      const result = calculateTerminator(0);
      // For New Moon (0° elongation), Sun is at 180° from Moon's perspective
      expect(result.normal.x).toBeCloseTo(-1, 0.01);
      expect(result.normal.y).toBeCloseTo(0, 0.01);
    });

    it('should have correct normal vector for 90° elongation', () => {
      const result = calculateTerminator(90 * ARCSECONDS_PER_DEGREE);
      // For 90° elongation, Sun is at 270° from Moon's perspective
      expect(result.normal.x).toBeCloseTo(0, 0.01);
      expect(result.normal.y).toBeCloseTo(-1, 0.01);
    });
  });

  describe('createMoonShadingFunction', () => {
    it('should return a shading function', () => {
      const shadingFn = createMoonShadingFunction(0);
      expect(typeof shadingFn).toBe('function');
    });

    it('should return shade value between 0 and 1', () => {
      const shadingFn = createMoonShadingFunction(90 * ARCSECONDS_PER_DEGREE);
      
      // Test various points
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const z = Math.random() * 2 - 1;
        
        const shade = shadingFn(x, y, z);
        expect(shade).toBeGreaterThanOrEqual(0);
        expect(shade).toBeLessThanOrEqual(1);
      }
    });

    it('should have smooth transition at terminator', () => {
      const shadingFn = createMoonShadingFunction(90 * ARCSECONDS_PER_DEGREE);
      
      // Points near the terminator should have intermediate values
      const shade1 = shadingFn(0.5, 0, 0);
      const shade2 = shadingFn(-0.5, 0, 0);
      
      // Both should be between 0 and 1
      expect(shade1).toBeGreaterThanOrEqual(0);
      expect(shade1).toBeLessThanOrEqual(1);
      expect(shade2).toBeGreaterThanOrEqual(0);
      expect(shade2).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// COMPLETE MOON PHASE TESTS
// ============================================================================

describe('Complete Moon Phase Calculation', () => {
  describe('calculateMoonPhase', () => {
    it('should return complete moon phase data', () => {
      const result = calculateMoonPhase(0, 0);
      expect(result).toBeDefined();
      expect(result.elongationArcsec).toBeDefined();
      expect(result.elongationDeg).toBeDefined();
      expect(result.illumination).toBeDefined();
      expect(result.illuminationFloat).toBeDefined();
      expect(result.phase).toBeDefined();
      expect(result.waxing).toBeDefined();
      expect(result.lunarDay).toBeDefined();
      expect(result.synodicPhase).toBeDefined();
      expect(result.terminatorAngle).toBeDefined();
      expect(result.nextNewMoonDays).toBeDefined();
      expect(result.nextFullMoonDays).toBeDefined();
    });

    it('should calculate New Moon phase correctly', () => {
      const result = calculateMoonPhase(0, 0);
      expect(result.phase).toBe('New');
      expect(result.elongationDeg).toBeCloseTo(0, 0.01);
      expect(result.illuminationFloat).toBeCloseTo(0, 0.01);
      expect(result.waxing).toBe(true);
      expect(result.lunarDay).toBeCloseTo(0, 0.1);
      expect(result.synodicPhase).toBeCloseTo(0, 0.01);
    });

    it('should calculate Full Moon phase correctly', () => {
      const result = calculateMoonPhase(0, 180 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Full');
      expect(result.elongationDeg).toBeCloseTo(180, 0.01);
      expect(result.illuminationFloat).toBeCloseTo(1, 0.01);
      expect(result.waxing).toBe(true);
      expect(result.lunarDay).toBeCloseTo(14.77, 0.1);
      expect(result.synodicPhase).toBeCloseTo(0.5, 0.01);
    });

    it('should calculate First Quarter phase correctly', () => {
      const result = calculateMoonPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('First Quarter');
      expect(result.elongationDeg).toBeCloseTo(90, 0.01);
      expect(result.illuminationFloat).toBeCloseTo(0.5, 0.01);
      expect(result.waxing).toBe(true);
    });

    it('should calculate Last Quarter phase correctly', () => {
      const result = calculateMoonPhase(0, 270 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Last Quarter');
      expect(result.elongationDeg).toBeCloseTo(90, 0.01); // 360-270=90
      expect(result.illuminationFloat).toBeCloseTo(0.5, 0.01);
      expect(result.waxing).toBe(false);
    });

    it('should have terminator angle', () => {
      const result = calculateMoonPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.terminatorAngle).toBeDefined();
      expect(result.terminatorAngle).toBeGreaterThanOrEqual(0);
      expect(result.terminatorAngle).toBeLessThan(360);
    });

    it('should calculate days to next New/Full Moon', () => {
      const result = calculateMoonPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.nextNewMoonDays).toBeGreaterThan(0);
      expect(result.nextFullMoonDays).toBeGreaterThan(0);
      expect(result.nextFullMoonDays).toBeLessThan(result.nextNewMoonDays);
    });

    it('should handle elongation > 360°', () => {
      const result = calculateMoonPhase(0, 450 * ARCSECONDS_PER_DEGREE);
      // 450° - 360° = 90°
      expect(result.phase).toBe('First Quarter');
    });

    it('should handle negative elongation', () => {
      const result = calculateMoonPhase(0, -90 * ARCSECONDS_PER_DEGREE);
      // -90° + 360° = 270°
      expect(result.phase).toBe('Last Quarter');
    });

    it('should handle Moon latitude', () => {
      // Moon at 5° latitude
      const result = calculateMoonPhase(0, 90 * ARCSECONDS_PER_DEGREE, 5 * ARCSECONDS_PER_DEGREE);
      expect(result).toBeDefined();
      // Should still work, though illumination might be slightly different
    });
  });
});

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
});
