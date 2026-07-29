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
} from 'd3-scale-chromatic'

/** @type {Array<{ id: string, label: string, interpolator: (t: number) => string }>} */
export const SEQUENTIAL_SCHEMES = [
  { id: 'ylgnbu', label: 'Yellow-Green-Blue', interpolator: interpolateYlGnBu },
  { id: 'blues', label: 'Blues', interpolator: interpolateBlues },
  { id: 'viridis', label: 'Viridis', interpolator: interpolateViridis },
  { id: 'ylorrd', label: 'Yellow-Orange-Red', interpolator: interpolateYlOrRd },
  { id: 'greens', label: 'Greens', interpolator: interpolateGreens },
]

/** @type {Array<{ id: string, label: string, interpolator: (t: number) => string }>} */
export const DIVERGING_SCHEMES = [
  { id: 'rdbu', label: 'Red-Blue', interpolator: interpolateRdBu },
  { id: 'piyg', label: 'Pink-Green', interpolator: interpolatePiYG },
  { id: 'brbg', label: 'Brown-Teal', interpolator: interpolateBrBG },
  { id: 'puor', label: 'Purple-Orange', interpolator: interpolatePuOr },
]

const DEFAULT_SEQUENTIAL = SEQUENTIAL_SCHEMES[0].id
const DEFAULT_DIVERGING = DIVERGING_SCHEMES[0].id

/**
 * @param {'sequential' | 'diverging'} scaleType
 * @returns {Array<{ id: string, label: string, interpolator: (t: number) => string }>}
 */
export function schemesFor(scaleType) {
  return scaleType === 'diverging' ? DIVERGING_SCHEMES : SEQUENTIAL_SCHEMES
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
