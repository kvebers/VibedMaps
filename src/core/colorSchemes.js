import {
  interpolateYlGnBu,
  interpolateBlues,
  interpolateViridis,
  interpolateYlOrRd,
  interpolateGreens,
  interpolateRdBu,
  interpolatePiYG,
  interpolateBrBG,
  interpolatePuOr,
  schemeTableau10,
  schemeSet2,
} from 'd3-scale-chromatic'

// `colorblindSafe` follows ColorBrewer's classification (colorbrewer2.org)
// for the diverging ramps, and the fact that Viridis was purpose-built for
// color-vision deficiency by its designers; the remaining sequential ramps
// are single-hue lightness gradients, which read fine under all common CVD
// types.

/** @type {Array<{ id: string, label: string, interpolator: (t: number) => string, colorblindSafe: boolean }>} */
export const SEQUENTIAL_SCHEMES = [
  { id: 'ylgnbu', label: 'Yellow-Green-Blue', interpolator: interpolateYlGnBu, colorblindSafe: true },
  { id: 'blues', label: 'Blues', interpolator: interpolateBlues, colorblindSafe: true },
  { id: 'viridis', label: 'Viridis', interpolator: interpolateViridis, colorblindSafe: true },
  { id: 'ylorrd', label: 'Yellow-Orange-Red', interpolator: interpolateYlOrRd, colorblindSafe: true },
  { id: 'greens', label: 'Greens', interpolator: interpolateGreens, colorblindSafe: true },
]

/** @type {Array<{ id: string, label: string, interpolator: (t: number) => string, colorblindSafe: boolean }>} */
export const DIVERGING_SCHEMES = [
  { id: 'rdbu', label: 'Red-Blue', interpolator: interpolateRdBu, colorblindSafe: true },
  { id: 'piyg', label: 'Pink-Green', interpolator: interpolatePiYG, colorblindSafe: true },
  { id: 'brbg', label: 'Brown-Teal', interpolator: interpolateBrBG, colorblindSafe: true },
  { id: 'puor', label: 'Purple-Orange', interpolator: interpolatePuOr, colorblindSafe: true },
]

// Categorical (word/label) maps use a fixed palette of distinct colors keyed
// by array index rather than an interpolator over a numeric domain — see
// getCategoricalColors below.
/** @type {Array<{ id: string, label: string, colors: readonly string[], colorblindSafe: boolean }>} */
export const CATEGORICAL_SCHEMES = [
  { id: 'tableau10', label: 'Tableau 10', colors: schemeTableau10, colorblindSafe: false },
  { id: 'set2', label: 'Set 2', colors: schemeSet2, colorblindSafe: true },
]

const DEFAULT_SEQUENTIAL = SEQUENTIAL_SCHEMES[0].id
const DEFAULT_DIVERGING = DIVERGING_SCHEMES[0].id
const DEFAULT_CATEGORICAL = CATEGORICAL_SCHEMES[0].id

/**
 * @param {'sequential' | 'diverging' | 'categorical'} scaleType
 * @returns {Array<{ id: string, label: string, colorblindSafe: boolean }>}
 */
export function schemesFor(scaleType) {
  if (scaleType === 'categorical') return CATEGORICAL_SCHEMES
  return scaleType === 'diverging' ? DIVERGING_SCHEMES : SEQUENTIAL_SCHEMES
}

/**
 * Resolves a scheme id to its discrete color list, for categorical maps.
 * @param {string} [schemeId]
 * @returns {readonly string[]}
 */
export function getCategoricalColors(schemeId) {
  const found = CATEGORICAL_SCHEMES.find((s) => s.id === schemeId) || CATEGORICAL_SCHEMES.find((s) => s.id === DEFAULT_CATEGORICAL)
  return found.colors
}

/**
 * Resolves a scheme id to its interpolator, falling back to the default for
 * that scale type if the id is missing or unrecognized.
 * @param {'sequential' | 'diverging'} scaleType
 * @param {string} [schemeId]
 * @returns {(t: number) => string}
 */
export function getInterpolator(scaleType, schemeId) {
  const pool = schemesFor(scaleType)
  const fallbackId = scaleType === 'diverging' ? DEFAULT_DIVERGING : DEFAULT_SEQUENTIAL
  const found = pool.find((s) => s.id === schemeId) || pool.find((s) => s.id === fallbackId)
  return found.interpolator
}
