// test/present/traditional.test.js - Tests for traditional.ts module
//
// Comprehensive test suite for the traditional astrology module
// Tests all new aspects, traditional orbs, mutual reception, etc.

import { describe, it, expect } from 'vitest';

// Import the traditional module
// Note: In a real setup, this would be an ES module import
// For testing, we'll import the functions directly
import {
  TRADITIONAL_ASPECTS,
  TRADITIONAL_ORBS,
  SOLAR_ORBS,
  nearestTraditionalAspect,
  nearestAspectWithTraditionalOrbs,
  isApplying,
  checkMutualReception,
  findAllMutualReceptions,
  checkTranslationOfLight,
  checkCollectionOfLight,
  findLightConfigurations,
  checkSolarCondition,
  checkAllSolarConditions,
  determineSect,
  checkHayz,
  checkAllHayz,
  calculateAlmuten,
  calculateLordOfGeniture,
  calculateFirdaria,
  calculateAnnualProfection,
  calculateZodiacalReleasing,
  calculateAllTimeLords,
  LUNAR_MANSIONS,
  findLunarMansion,
  planetsInLunarMansions,
  FIXED_STARS,
  findFixedStarConjunctions,
  calculateEnhancedLunarPhase,
  DOMICILE_RULERS,
  EXALTATION_RULERS,
} from '../../../src/astro/traditional';

// ============================================================================
// HELPER CONSTANTS
// ============================================================================

const ARCSECONDS_PER_DEGREE = 3600;
const ARCSECONDS_PER_CIRCLE = 360 * ARCSECONDS_PER_DEGREE;

// ============================================================================
// ASPECT TESTS
// ============================================================================

describe('Traditional Aspects', () => {
  describe('TRADITIONAL_ASPECTS array', () => {
    it('should include all major aspects', () => {
      const majorAspects = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
      for (const aspect of majorAspects) {
        expect(TRADITIONAL_ASPECTS.some(a => a.name === aspect)).toBe(true);
      }
    });

    it('should include new minor aspects', () => {
      const newAspects = ['Semisextile', 'Sesquiquadrate', 'Novile', 'Decile', 'Tridecile'];
      for (const aspect of newAspects) {
        expect(TRADITIONAL_ASPECTS.some(a => a.name === aspect)).toBe(true);
      }
    });

    it('should include declination aspects', () => {
      expect(TRADITIONAL_ASPECTS.some(a => a.name === 'Parallel')).toBe(true);
      expect(TRADITIONAL_ASPECTS.some(a => a.name === 'Contra-Parallel')).toBe(true);
    });

    it('should have correct angles for new aspects', () => {
      const semisextile = TRADITIONAL_ASPECTS.find(a => a.name === 'Semisextile');
      expect(semisextile).toBeDefined();
      expect(semisextile.angleArcsec).toBe(30 * ARCSECONDS_PER_DEGREE);

      const sesquiquadrate = TRADITIONAL_ASPECTS.find(a => a.name === 'Sesquiquadrate');
      expect(sesquiquadrate).toBeDefined();
      expect(sesquiquadrate.angleArcsec).toBe(135 * ARCSECONDS_PER_DEGREE);

      const novile = TRADITIONAL_ASPECTS.find(a => a.name === 'Novile');
      expect(novile).toBeDefined();
      expect(novile.angleArcsec).toBe(40 * ARCSECONDS_PER_DEGREE);

      const decile = TRADITIONAL_ASPECTS.find(a => a.name === 'Decile');
      expect(decile).toBeDefined();
      expect(decile.angleArcsec).toBe(36 * ARCSECONDS_PER_DEGREE);

      const tridecile = TRADITIONAL_ASPECTS.find(a => a.name === 'Tridecile');
      expect(tridecile).toBeDefined();
      expect(tridecile.angleArcsec).toBe(108 * ARCSECONDS_PER_DEGREE);
    });
  });

  describe('nearestTraditionalAspect', () => {
    it('should detect exact conjunction', () => {
      const result = nearestTraditionalAspect(0, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Conjunction');
      expect(result.sepArcsec).toBe(0);
      expect(result.exact).toBe(true);
    });

    it('should detect semisextile (30°)', () => {
      const result = nearestTraditionalAspect(30 * ARCSECONDS_PER_DEGREE, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Semisextile');
    });

    it('should detect sesquiquadrate (135°)', () => {
      const result = nearestTraditionalAspect(135 * ARCSECONDS_PER_DEGREE, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Sesquiquadrate');
    });

    it('should detect novile (40°)', () => {
      const result = nearestTraditionalAspect(40 * ARCSECONDS_PER_DEGREE, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Novile');
    });

    it('should detect decile (36°)', () => {
      const result = nearestTraditionalAspect(36 * ARCSECONDS_PER_DEGREE, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Decile');
    });

    it('should detect tridecile (108°)', () => {
      const result = nearestTraditionalAspect(108 * ARCSECONDS_PER_DEGREE, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Tridecile');
    });

    it('should detect parallel (0° declination)', () => {
      const result = nearestTraditionalAspect(0, 0, 0, 0);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Conjunction'); // Parallel is 0° in declination
    });

    it('should detect contra-parallel (180° declination)', () => {
      const result = nearestTraditionalAspect(0, 0, 0, 180 * ARCSECONDS_PER_DEGREE);
      expect(result).not.toBeNull();
      // Should detect Opposition or Contra-Parallel
      expect(['Opposition', 'Contra-Parallel']).toContain(result.name);
    });

    it('should return null when no aspect is within orb', () => {
      const result = nearestTraditionalAspect(10 * ARCSECONDS_PER_DEGREE, 0);
      // 10° is not close to any standard aspect
      expect(result).toBeNull();
    });
  });

  describe('nearestAspectWithTraditionalOrbs', () => {
    it('should use traditional orbs per planet', () => {
      const result = nearestAspectWithTraditionalOrbs(
        10 * ARCSECONDS_PER_DEGREE, // 10° separation
        0,
        'Moon',
        'Sun',
        true
      );
      // Moon has 12°30' orb, Sun has 17° orb
      // 10° should be within orb
      expect(result).not.toBeNull();
    });

    it('should use larger orb when planets have different orbs', () => {
      const result = nearestAspectWithTraditionalOrbs(
        8 * ARCSECONDS_PER_DEGREE, // 8° separation
        0,
        'Mars', // 8° orb
        'Saturn', // 9° orb
        true
      );
      expect(result).not.toBeNull();
      // Should be within Saturn's 9° orb
    });
  });
});

// ============================================================================
// APPLYING/SEPARATING TESTS
// ============================================================================

describe('Applying/Separating Detection', () => {
  describe('isApplying', () => {
    it('should detect applying aspect when transit is moving toward natal', () => {
      // Transit at 10°, moving toward 0° at 1°/day
      const result = isApplying(
        10 * ARCSECONDS_PER_DEGREE, // Transit at 10°
        0, // Natal at 0°
        -1 * ARCSECONDS_PER_DEGREE, // Transit moving backward (toward 0°)
        0, // Natal stationary
        0 // Target: conjunction at 0°
      );
      expect(result).toBe('applying');
    });

    it('should detect separating aspect when transit is moving away from natal', () => {
      // Transit at 10°, moving away from 0° at 1°/day
      const result = isApplying(
        10 * ARCSECONDS_PER_DEGREE, // Transit at 10°
        0, // Natal at 0°
        1 * ARCSECONDS_PER_DEGREE, // Transit moving forward (away from 0°)
        0, // Natal stationary
        0 // Target: conjunction at 0°
      );
      expect(result).toBe('separating');
    });

    it('should detect stationary aspect when relative speed is zero', () => {
      const result = isApplying(
        10 * ARCSECONDS_PER_DEGREE,
        0,
        0, // Transit stationary
        0,
        0
      );
      expect(result).toBe('stationary');
    });
  });
});

// ============================================================================
// TRADITIONAL ORBS TESTS
// ============================================================================

describe('Traditional Orbs', () => {
  describe('TRADITIONAL_ORBS', () => {
    it('should have correct orb for Moon (12°30\')', () => {
      expect(TRADITIONAL_ORBS.Moon).toBe(12 * ARCSECONDS_PER_DEGREE + 30 * 60);
    });

    it('should have correct orb for Sun', () => {
      // Sun has 17° orb for under the beams
      expect(TRADITIONAL_ORBS.Sun).toBe(17 * ARCSECONDS_PER_DEGREE);
    });

    it('should have correct orb for Mercury', () => {
      expect(TRADITIONAL_ORBS.Mercury).toBe(7 * ARCSECONDS_PER_DEGREE);
    });

    it('should have correct orb for Venus', () => {
      expect(TRADITIONAL_ORBS.Venus).toBe(8 * ARCSECONDS_PER_DEGREE);
    });

    it('should have correct orb for Mars', () => {
      expect(TRADITIONAL_ORBS.Mars).toBe(8 * ARCSECONDS_PER_DEGREE);
    });

    it('should have correct orb for Jupiter', () => {
      expect(TRADITIONAL_ORBS.Jupiter).toBe(9 * ARCSECONDS_PER_DEGREE);
    });

    it('should have correct orb for Saturn', () => {
      expect(TRADITIONAL_ORBS.Saturn).toBe(9 * ARCSECONDS_PER_DEGREE);
    });
  });

  describe('SOLAR_ORBS', () => {
    it('should have cazimi orb of 17 arcminutes', () => {
      expect(SOLAR_ORBS.cazimi).toBe(17 * 60); // 17 arcminutes
    });

    it('should have combust orb of 8°30\'', () => {
      expect(SOLAR_ORBS.combust).toBe(8 * ARCSECONDS_PER_DEGREE + 30 * 60);
    });

    it('should have underTheBeams orb of 17°', () => {
      expect(SOLAR_ORBS.underTheBeams).toBe(17 * ARCSECONDS_PER_DEGREE);
    });
  });
});

// ============================================================================
// MUTUAL RECEPTION TESTS
// ============================================================================

describe('Mutual Reception', () => {
  describe('checkMutualReception', () => {
    it('should detect domicile mutual reception between Mars and Venus', () => {
      // Mars in Taurus (Venus' domicile), Venus in Aries (Mars' domicile)
      const result = checkMutualReception('Mars', 'Venus', 1, 0); // Taurus=1, Aries=0
      expect(result.type).toBe('domicile');
      expect(result.planetA).toBe('Mars');
      expect(result.planetB).toBe('Venus');
    });

    it('should detect no mutual reception for unrelated planets', () => {
      // Sun in Leo (its own domicile), Moon in Cancer (its own domicile)
      const result = checkMutualReception('Sun', 'Moon', 4, 3); // Leo=4, Cancer=3
      expect(result.type).toBe('none');
    });

    it('should detect domicile mutual reception between Mercury and Venus', () => {
      // Mercury in Taurus (Venus' domicile), Venus in Gemini (Mercury's domicile)
      const result = checkMutualReception('Mercury', 'Venus', 1, 2); // Taurus=1, Gemini=2
      expect(result.type).toBe('domicile');
    });
  });

  describe('findAllMutualReceptions', () => {
    it('should find multiple mutual receptions in a chart', () => {
      const planets = [
        { name: 'Mars', sign: 1 }, // Mars in Taurus
        { name: 'Venus', sign: 0 }, // Venus in Aries
        { name: 'Mercury', sign: 2 }, // Mercury in Gemini
        { name: 'Sun', sign: 4 }, // Sun in Leo
      ];
      
      const receptions = findAllMutualReceptions(planets);
      expect(receptions.length).toBeGreaterThan(0);
      
      // Should find Mars-Venus mutual reception
      expect(receptions.some(r => r.planetA === 'Mars' && r.planetB === 'Venus')).toBe(true);
    });

    it('should return empty array when no mutual receptions exist', () => {
      const planets = [
        { name: 'Sun', sign: 4 }, // Sun in Leo (its own domicile)
        { name: 'Moon', sign: 3 }, // Moon in Cancer (its own domicile)
      ];
      
      const receptions = findAllMutualReceptions(planets);
      expect(receptions.length).toBe(0);
    });
  });
});

// ============================================================================
// TRANSLATION AND COLLECTION OF LIGHT TESTS
// ============================================================================

describe('Translation and Collection of Light', () => {
  describe('checkTranslationOfLight', () => {
    it('should detect translation when planet C aspects both A and B', () => {
      // A at 0°, B at 60° (sextile), C at 30° (aspects both)
      const result = checkTranslationOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 60 * ARCSECONDS_PER_DEGREE, 30 * ARCSECONDS_PER_DEGREE
      );
      expect(result).not.toBeNull();
      expect(result.type).toBe('translation');
      expect(result.collector).toBe('Mercury');
    });

    it('should return null when C does not aspect A', () => {
      const result = checkTranslationOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 60 * ARCSECONDS_PER_DEGREE, 90 * ARCSECONDS_PER_DEGREE
      );
      expect(result).toBeNull();
    });

    it('should return null when C does not aspect B', () => {
      const result = checkTranslationOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 60 * ARCSECONDS_PER_DEGREE, 120 * ARCSECONDS_PER_DEGREE
      );
      expect(result).toBeNull();
    });

    it('should return null when A and B are not in aspect', () => {
      const result = checkTranslationOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 10 * ARCSECONDS_PER_DEGREE, 5 * ARCSECONDS_PER_DEGREE
      );
      expect(result).toBeNull();
    });
  });

  describe('checkCollectionOfLight', () => {
    it('should detect collection when A and B both aspect C', () => {
      // A at 0°, B at 60°, C at 30° (both aspect C)
      const result = checkCollectionOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 60 * ARCSECONDS_PER_DEGREE, 30 * ARCSECONDS_PER_DEGREE
      );
      expect(result).not.toBeNull();
      expect(result.type).toBe('collection');
      expect(result.collector).toBe('Mercury');
    });

    it('should return null when A does not aspect C', () => {
      const result = checkCollectionOfLight(
        'Sun', 'Moon', 'Mercury',
        0, 60 * ARCSECONDS_PER_DEGREE, 90 * ARCSECONDS_PER_DEGREE
      );
      expect(result).toBeNull();
    });
  });

  describe('findLightConfigurations', () => {
    it('should find translation and collection configurations', () => {
      const planets = [
        { name: 'Sun', lon: 0 },
        { name: 'Moon', lon: 60 * ARCSECONDS_PER_DEGREE },
        { name: 'Mercury', lon: 30 * ARCSECONDS_PER_DEGREE },
        { name: 'Venus', lon: 120 * ARCSECONDS_PER_DEGREE },
      ];
      
      const configurations = findLightConfigurations(planets);
      expect(configurations.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SOLAR CONDITION TESTS
// ============================================================================

describe('Solar Conditions', () => {
  describe('checkSolarCondition', () => {
    it('should detect cazimi when planet is within 17 arcminutes of Sun', () => {
      const result = checkSolarCondition(
        0, // Planet at 0°
        0, // Sun at 0°
        'Mercury'
      );
      expect(result.condition).toBe('cazimi');
      expect(result.isExact).toBe(true);
    });

    it('should detect cazimi at boundary (17 arcminutes)', () => {
      const result = checkSolarCondition(
        17 * 60, // Planet at 17 arcminutes
        0, // Sun at 0°
        'Mercury'
      );
      expect(result.condition).toBe('cazimi');
    });

    it('should detect combust when planet is within 8°30\' of Sun', () => {
      const result = checkSolarCondition(
        8 * ARCSECONDS_PER_DEGREE + 15 * 60, // Planet at 8°15'
        0, // Sun at 0°
        'Mercury'
      );
      expect(result.condition).toBe('combust');
    });

    it('should detect under the beams when planet is within 17° of Sun', () => {
      const result = checkSolarCondition(
        16 * ARCSECONDS_PER_DEGREE, // Planet at 16°
        0, // Sun at 0°
        'Mercury'
      );
      expect(result.condition).toBe('underTheBeams');
    });

    it('should detect free when planet is beyond 17° of Sun', () => {
      const result = checkSolarCondition(
        20 * ARCSECONDS_PER_DEGREE, // Planet at 20°
        0, // Sun at 0°
        'Mercury'
      );
      expect(result.condition).toBe('free');
    });
  });

  describe('checkAllSolarConditions', () => {
    it('should check solar conditions for all planets', () => {
      const planets = [
        { name: 'Sun', lon: 0 },
        { name: 'Moon', lon: 10 * ARCSECONDS_PER_DEGREE },
        { name: 'Mercury', lon: 5 * ARCSECONDS_PER_DEGREE },
        { name: 'Venus', lon: 20 * ARCSECONDS_PER_DEGREE },
      ];
      
      const conditions = checkAllSolarConditions(planets);
      expect(conditions.Moon).toBeDefined();
      expect(conditions.Mercury).toBeDefined();
      expect(conditions.Venus).toBeDefined();
      expect(conditions.Moon.condition).toBe('combust');
      expect(conditions.Venus.condition).toBe('free');
    });
  });
});

// ============================================================================
// SECT AND HAYZ TESTS
// ============================================================================

describe('Sect and Hayz', () => {
  describe('determineSect', () => {
    it('should determine day chart when Sun is above horizon', () => {
      // Sun at 270° (10th house), Ascendant at 0°
      const result = determineSect(270, 0, 'auto');
      expect(result).toBe('day');
    });

    it('should determine night chart when Sun is below horizon', () => {
      // Sun at 90° (4th house), Ascendant at 0°
      const result = determineSect(90, 0, 'auto');
      expect(result).toBe('night');
    });

    it('should respect explicit day sect', () => {
      const result = determineSect(90, 0, 'day');
      expect(result).toBe('day');
    });

    it('should respect explicit night sect', () => {
      const result = determineSect(270, 0, 'night');
      expect(result).toBe('night');
    });
  });

  describe('checkHayz', () => {
    it('should detect hayz for diurnal planets in day chart', () => {
      // Jupiter in day chart, above horizon
      const result = checkHayz(
        270 * ARCSECONDS_PER_DEGREE, // Jupiter at 270°
        0, // Sun at 0°
        0, // Ascendant at 0°
        'day'
      );
      // Jupiter should be in hayz (above horizon in day chart)
      expect(result).toBe(true);
    });

    it('should detect hayz for nocturnal planets in night chart', () => {
      // Moon in night chart, below horizon
      const result = checkHayz(
        90 * ARCSECONDS_PER_DEGREE, // Moon at 90°
        0, // Sun at 0°
        0, // Ascendant at 0°
        'night'
      );
      // Moon should be in hayz (below horizon in night chart)
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// ALMUTEN AND LORD OF GENITURE TESTS
// ============================================================================

describe('Almuten and Lord of Geniture', () => {
  describe('calculateAlmuten', () => {
    it('should calculate almuten for a chart', () => {
      const planets = [
        { name: 'Sun', lon: 4 * 30 * ARCSECONDS_PER_DEGREE }, // Sun in Leo (its domicile)
        { name: 'Moon', lon: 3 * 30 * ARCSECONDS_PER_DEGREE }, // Moon in Cancer (its domicile)
        { name: 'Mars', lon: 0 * 30 * ARCSECONDS_PER_DEGREE }, // Mars in Aries (its domicile)
      ];
      
      const almuten = calculateAlmuten(planets);
      expect(almuten).toBeDefined();
      expect(almuten.score).toBeGreaterThan(0);
      expect(almuten.dignityBreakdown).toBeDefined();
    });

    it('should return highest scoring planet', () => {
      const planets = [
        { name: 'Sun', lon: 4 * 30 * ARCSECONDS_PER_DEGREE }, // Sun in Leo (domicile = 5)
        { name: 'Moon', lon: 3 * 30 * ARCSECONDS_PER_DEGREE }, // Moon in Cancer (domicile = 5)
        { name: 'Mars', lon: 0 * 30 * ARCSECONDS_PER_DEGREE }, // Mars in Aries (domicile = 5)
      ];
      
      const almuten = calculateAlmuten(planets);
      // All have score 5, should return one of them
      expect(['Sun', 'Moon', 'Mars']).toContain(almuten.planet);
    });
  });

  describe('calculateLordOfGeniture', () => {
    it('should return Ascendant ruler for day chart', () => {
      // Ascendant in Aries (Mars rules Aries)
      const result = calculateLordOfGeniture(0, 3, 'day'); // Asc=0° (Aries), Moon=3 (Cancer)
      expect(result).toBe('Mars');
    });

    it('should return Moon ruler for night chart', () => {
      // Moon in Cancer (Moon rules Cancer)
      const result = calculateLordOfGeniture(0, 3, 'night'); // Asc=0° (Aries), Moon=3 (Cancer)
      expect(result).toBe('Moon');
    });
  });
});

// ============================================================================
// TIME LORDS TESTS
// ============================================================================

describe('Time Lords', () => {
  describe('calculateFirdaria', () => {
    it('should calculate correct firdar for age 0-11 (Saturn)', () => {
      const result = calculateFirdaria(5, 'day'); // Age 5, day chart
      expect(result.lord).toBe('Saturn');
      expect(result.years).toBe(0);
      expect(result.endAge).toBe(11);
    });

    it('should calculate correct firdar for age 12-23 (Jupiter)', () => {
      const result = calculateFirdaria(15, 'day'); // Age 15, day chart
      expect(result.lord).toBe('Jupiter');
      expect(result.years).toBe(11);
      expect(result.endAge).toBe(23);
    });

    it('should handle night chart firdaria order', () => {
      const result = calculateFirdaria(5, 'night'); // Age 5, night chart
      expect(result.lord).toBe('Moon'); // First in night order
    });
  });

  describe('calculateAnnualProfection', () => {
    it('should calculate correct profection lord for age 0', () => {
      // Ascendant in Aries (0), age 0
      const result = calculateAnnualProfection(0, 0);
      expect(result.lord).toBe('Mars'); // Mars rules Aries
      expect(result.years).toBe(0);
      expect(result.endAge).toBe(1);
    });

    it('should calculate correct profection lord for age 1', () => {
      // Ascendant in Aries (0), age 1
      const result = calculateAnnualProfection(1, 0);
      expect(result.lord).toBe('Venus'); // Venus rules Taurus (1st house from Aries)
    });
  });

  describe('calculateZodiacalReleasing', () => {
    it('should return releasing lord for current age', () => {
      const result = calculateZodiacalReleasing(25, 4, 10); // Age 25, Fortune in Leo, Spirit in Sagittarius
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('zodiacalReleasing');
    });
  });

  describe('calculateAllTimeLords', () => {
    it('should return multiple time lords', () => {
      const result = calculateAllTimeLords(25, 0, 3, 4, 10, 'day');
      expect(result.length).toBeGreaterThan(0);
      
      // Should include profection and firdaria
      const hasProfection = result.some(l => l.type === 'profection');
      const hasFirdaria = result.some(l => l.type === 'firdaria');
      expect(hasProfection).toBe(true);
      expect(hasFirdaria).toBe(true);
    });
  });
});

// ============================================================================
// LUNAR MANSIONS TESTS
// ============================================================================

describe('Lunar Mansions', () => {
  describe('LUNAR_MANSIONS', () => {
    it('should have 28 mansions', () => {
      expect(LUNAR_MANSIONS.length).toBe(28);
    });

    it('should cover full circle', () => {
      const lastMansion = LUNAR_MANSIONS[LUNAR_MANSIONS.length - 1];
      expect(lastMansion.endArcsec).toBe(ARCSECONDS_PER_CIRCLE);
    });

    it('should have correct rulers', () => {
      // First few mansions
      expect(LUNAR_MANSIONS[0].name).toBe('Alnath');
      expect(LUNAR_MANSIONS[0].ruler).toBe('Mars');
      
      expect(LUNAR_MANSIONS[1].name).toBe('Albuth');
      expect(LUNAR_MANSIONS[1].ruler).toBe('Venus');
    });
  });

  describe('findLunarMansion', () => {
    it('should find correct mansion for 0°', () => {
      const mansion = findLunarMansion(0);
      expect(mansion.index).toBe(0);
      expect(mansion.name).toBe('Alnath');
    });

    it('should find correct mansion for 15°', () => {
      const mansion = findLunarMansion(15 * ARCSECONDS_PER_DEGREE);
      expect(mansion.index).toBe(0); // Still in first mansion
    });

    it('should find correct mansion for 180°', () => {
      const mansion = findLunarMansion(180 * ARCSECONDS_PER_DEGREE);
      expect(mansion.index).toBe(13); // Alghafr starts at 180°
    });
  });

  describe('planetsInLunarMansions', () => {
    it('should group planets by mansion', () => {
      const planets = [
        { name: 'Sun', lon: 0 },
        { name: 'Moon', lon: 10 * ARCSECONDS_PER_DEGREE },
        { name: 'Mercury', lon: 100 * ARCSECONDS_PER_DEGREE },
      ];
      
      const mansions = planetsInLunarMansions(planets);
      expect(mansions[0]).toContain('Sun');
      expect(mansions[0]).toContain('Moon');
    });
  });
});

// ============================================================================
// FIXED STARS TESTS
// ============================================================================

describe('Fixed Stars', () => {
  describe('FIXED_STARS', () => {
    it('should include major fixed stars', () => {
      const starNames = ['Regulus', 'Spica', 'Algol', 'Aldebaran', 'Antares', 'Fomalhaut', 'Sirius'];
      for (const name of starNames) {
        expect(FIXED_STARS.some(s => s.name === name)).toBe(true);
      }
    });

    it('should have positions for all stars', () => {
      for (const star of FIXED_STARS) {
        expect(star.longitudeArcsec).toBeDefined();
        expect(star.declinationArcsec).toBeDefined();
        expect(star.magnitude).toBeDefined();
        expect(star.nature).toBeDefined();
      }
    });
  });

  describe('findFixedStarConjunctions', () => {
    it('should find conjunctions within orb', () => {
      const planets = [
        { name: 'Sun', lon: 148 * ARCSECONDS_PER_DEGREE }, // Near Regulus at 148°
      ];
      
      const conjunctions = findFixedStarConjunctions(planets, 2 * ARCSECONDS_PER_DEGREE);
      expect(conjunctions.length).toBeGreaterThan(0);
      expect(conjunctions[0].star).toBe('Regulus');
    });

    it('should not find conjunctions outside orb', () => {
      const planets = [
        { name: 'Sun', lon: 0 }, // Far from any star
      ];
      
      const conjunctions = findFixedStarConjunctions(planets, 2 * ARCSECONDS_PER_DEGREE);
      expect(conjunctions.length).toBe(0);
    });
  });
});

// ============================================================================
// ENHANCED LUNAR PHASE TESTS
// ============================================================================

describe('Enhanced Lunar Phase', () => {
  describe('calculateEnhancedLunarPhase', () => {
    it('should calculate New Moon phase', () => {
      const result = calculateEnhancedLunarPhase(0, 0);
      expect(result.phase).toBe('New');
      expect(result.elongationDeg).toBe(0);
      expect(result.illuminationFloat).toBeCloseTo(0, 0.01);
      expect(result.waxing).toBe(true);
    });

    it('should calculate Full Moon phase', () => {
      const result = calculateEnhancedLunarPhase(0, 180 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Full');
      expect(result.elongationDeg).toBeCloseTo(180, 0.01);
      expect(result.illuminationFloat).toBeCloseTo(1, 0.01);
      expect(result.waxing).toBe(true);
    });

    it('should calculate First Quarter phase', () => {
      const result = calculateEnhancedLunarPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('First Quarter');
      expect(result.illuminationFloat).toBeCloseTo(0.5, 0.01);
      expect(result.waxing).toBe(true);
    });

    it('should calculate Last Quarter phase', () => {
      const result = calculateEnhancedLunarPhase(0, 270 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Last Quarter');
      expect(result.illuminationFloat).toBeCloseTo(0.5, 0.01);
      expect(result.waxing).toBe(false);
    });

    it('should calculate Waxing Crescent phase', () => {
      const result = calculateEnhancedLunarPhase(0, 30 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Waxing Crescent');
      expect(result.waxing).toBe(true);
    });

    it('should calculate Waning Gibbous phase', () => {
      const result = calculateEnhancedLunarPhase(0, 210 * ARCSECONDS_PER_DEGREE);
      expect(result.phase).toBe('Waning Gibbous');
      expect(result.waxing).toBe(false);
    });

    it('should have exact illumination as BigInt fraction', () => {
      const result = calculateEnhancedLunarPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.illumination.numerator).toBeDefined();
      expect(result.illumination.denominator).toBeDefined();
      expect(result.illumination.denominator).not.toBe(0n);
    });

    it('should calculate lunar day', () => {
      const result = calculateEnhancedLunarPhase(0, 90 * ARCSECONDS_PER_DEGREE);
      expect(result.lunarDay).toBeCloseTo(7.38, 0.1); // ~7.4 days (quarter of 29.53)
    });
  });
});

// ============================================================================
// DOMICILE AND EXALTATION TESTS
// ============================================================================

describe('Domicile and Exaltation Rulers', () => {
  describe('DOMICILE_RULERS', () => {
    it('should have 12 signs', () => {
      expect(DOMICILE_RULERS.length).toBe(12);
    });

    it('should have correct rulers for cardinal signs', () => {
      expect(DOMICILE_RULERS[0]).toBe('Mars'); // Aries
      expect(DOMICILE_RULERS[3]).toBe('Moon'); // Cancer
      expect(DOMICILE_RULERS[6]).toBe('Venus'); // Libra
      expect(DOMICILE_RULERS[9]).toBe('Saturn'); // Capricorn
    });

    it('should have correct rulers for fixed signs', () => {
      expect(DOMICILE_RULERS[1]).toBe('Venus'); // Taurus
      expect(DOMICILE_RULERS[4]).toBe('Sun'); // Leo
      expect(DOMICILE_RULERS[7]).toBe('Saturn'); // Aquarius
      expect(DOMICILE_RULERS[10]).toBe('Jupiter'); // Pisces
    });

    it('should have correct rulers for mutable signs', () => {
      expect(DOMICILE_RULERS[2]).toBe('Mercury'); // Gemini
      expect(DOMICILE_RULERS[5]).toBe('Mercury'); // Virgo
      expect(DOMICILE_RULERS[8]).toBe('Jupiter'); // Sagittarius
      expect(DOMICILE_RULERS[11]).toBe('Neptune'); // Pisces (modern)
    });
  });

  describe('EXALTATION_RULERS', () => {
    it('should have entries for all signs (some null)', () => {
      expect(EXALTATION_RULERS.length).toBe(12);
    });

    it('should have correct exaltation rulers', () => {
      expect(EXALTATION_RULERS[0]).toBe('Sun'); // Aries
      expect(EXALTATION_RULERS[1]).toBe('Moon'); // Taurus
      expect(EXALTATION_RULERS[3]).toBe(null); // Cancer (Moon's domicile)
    });
  });
});
