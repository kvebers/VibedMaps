import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { scaleSequential, scaleDiverging, scaleQuantile } from 'd3-scale'
import { feature } from 'topojson-client'
import { ISO3_TO_NUMERIC } from './isoNumeric.js'
import { REGIONS } from './regions.js'
import { getInterpolator } from './colorSchemes.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
export const NO_DATA_COLOR = '#e2e2e2'

/**
 * @param {object} worldTopology TopoJSON topology (world-atlas countries-*.json)
 * @returns {Array<object>} GeoJSON Feature array
 */
export function getWorldFeatures(worldTopology) {
  return feature(worldTopology, worldTopology.objects.countries).features
}

/**
 * Restricts a feature array to the countries in a region preset.
 * @param {Array<object>} features
 * @param {string} [regionId]
 * @returns {Array<object>}
 */
export function filterFeaturesByRegion(features, regionId) {
  const region = REGIONS[regionId]
  if (!region || !region.iso3) return features
  const numericIds = new Set(region.iso3.map((iso3) => ISO3_TO_NUMERIC[iso3]).filter(Boolean))
  return features.filter((f) => numericIds.has(f.id))
}

/**
 * Picks a color scale from d3-scale-chromatic based on mapData.scale.
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean, bins?: number }} [options]
 * @returns {{ scale: (v: number) => string, domain: [number, number], type: 'sequential' | 'diverging' }}
 */
export function getColorScale(mapData, options = {}) {
  const { schemeId, binned = false, bins = 6 } = options
  const values = mapData.data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const interpolator = getInterpolator(mapData.scale, schemeId)

  if (mapData.scale === 'diverging') {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1
    const domain = [-maxAbs, maxAbs]
    if (binned) {
      const scale = scaleQuantile()
        .domain(values.length ? values : domain)
        .range(sampleColors(interpolator, bins))
      return { scale: (v) => scale(v), domain, type: 'diverging' }
    }
    const diverging = scaleDiverging(interpolator).domain([-maxAbs, 0, maxAbs])
    return { scale: diverging, domain, type: 'diverging' }
  }

  const domainMax = max === min ? min + 1 : max
  const domain = [min, domainMax]
  if (binned) {
    const scale = scaleQuantile()
      .domain(values.length ? values : domain)
      .range(sampleColors(interpolator, bins))
    return { scale: (v) => scale(v), domain, type: 'sequential' }
  }
  const sequential = scaleSequential(interpolator).domain(domain)
  return { scale: sequential, domain, type: 'sequential' }
}

/**
 * Samples `n` evenly-spaced colors from an interpolator, for discrete/binned scales.
 * @param {(t: number) => string} interpolator
 * @param {number} n
 * @returns {string[]}
 */
function sampleColors(interpolator, n) {
  const colors = []
  for (let i = 0; i < n; i++) colors.push(interpolator(n === 1 ? 0.5 : i / (n - 1)))
  return colors
}

/**
 * Builds a numeric-ISO -> value lookup by joining AI data onto the standard
 * ISO 3166-1 numeric codes that world-atlas TopoJSON keys features by.
 * @param {import('./schema').MapData} mapData
 */
function buildValueByNumericId(mapData) {
  const map = new Map()
  for (const d of mapData.data) {
    const numeric = ISO3_TO_NUMERIC[d.iso3]
    if (numeric) map.set(numeric, d.value)
  }
  return map
}

/**
 * Renders a choropleth into an existing <svg> element. Framework-agnostic —
 * only touches the DOM node it's given.
 * @param {SVGSVGElement} svgEl
 * @param {{ mapData: import('./schema').MapData, worldTopology: object, width: number, height: number, regionId?: string, showValues?: boolean, schemeId?: string, binned?: boolean, bins?: number }} options
 * @returns {{ scale: (v: number) => string, domain: [number, number], type: 'sequential' | 'diverging' }}
 */
export function renderChoropleth(
  svgEl,
  { mapData, worldTopology, width, height, regionId, showValues = false, schemeId, binned = false, bins = 6 },
) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild)
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svgEl.setAttribute('width', String(width))
  svgEl.setAttribute('height', String(height))

  const features = filterFeaturesByRegion(getWorldFeatures(worldTopology), regionId)
  const region = REGIONS[regionId]
  const projection = geoNaturalEarth1()
  if (region?.bounds) {
    // Fit to a fixed geographic box rather than the features' own shapes, so
    // a large country (e.g. Russia in Europe) doesn't dwarf the rest of the
    // region — it still renders, just cropped by the viewport past this box.
    const [[lon0, lat0], [lon1, lat1]] = region.bounds
    // Spherical winding for d3-geo's clip stream is the opposite of planar
    // GeoJSON: lon0,lat0 -> lon0,lat1 -> lon1,lat1 -> lon1,lat0 -> close.
    // Getting this backwards makes d3 treat the ring as covering the whole
    // sphere (its bounds collapse to the same as fitting the entire globe).
    projection.fitSize([width, height], {
      type: 'Polygon',
      coordinates: [
        [
          [lon0, lat0],
          [lon0, lat1],
          [lon1, lat1],
          [lon1, lat0],
          [lon0, lat0],
        ],
      ],
    })
  } else {
    projection.fitSize([width, height], { type: 'FeatureCollection', features })
  }
  const pathGenerator = geoPath(projection)
  const valueByNumeric = buildValueByNumericId(mapData)
  const colorScale = getColorScale(mapData, { schemeId, binned, bins })

  const g = document.createElementNS(SVG_NS, 'g')
  const labelsG = document.createElementNS(SVG_NS, 'g')
  labelsG.setAttribute('style', 'pointer-events: none; font: 9px sans-serif;')

  for (const f of features) {
    const d = pathGenerator(f)
    if (!d) continue

    const value = valueByNumeric.get(f.id)
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', value === undefined ? NO_DATA_COLOR : colorScale.scale(value))
    path.setAttribute('stroke', '#ffffff')
    path.setAttribute('stroke-width', '0.5')

    const name = f.properties?.name ?? ''
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent =
      value === undefined ? `${name}: no data` : `${name}: ${value} ${mapData.unit}`
    path.appendChild(title)

    g.appendChild(path)

    if (showValues && value !== undefined) {
      const [cx, cy] = pathGenerator.centroid(f)
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        const text = document.createElementNS(SVG_NS, 'text')
        text.setAttribute('x', String(cx))
        text.setAttribute('y', String(cy))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('dominant-baseline', 'middle')
        text.setAttribute('fill', '#111827')
        text.setAttribute('paint-order', 'stroke')
        text.setAttribute('stroke', '#ffffff')
        text.setAttribute('stroke-width', '3')
        text.textContent = formatLabelValue(value)
        labelsG.appendChild(text)
      }
    }
  }
  svgEl.appendChild(g)
  svgEl.appendChild(labelsG)

  return colorScale
}

function formatLabelValue(value) {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/**
 * Discrete legend stops for the given map data's color scale. In binned mode,
 * each stop covers a quantile bucket (`value`..`upper`) instead of a single
 * point on a continuous ramp.
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean, bins?: number, steps?: number }} [options]
 * @returns {Array<{ value: number, upper?: number, color: string }>}
 */
export function getLegendStops(mapData, options = {}) {
  const { schemeId, binned = false, bins = 6, steps = 6 } = options

  if (binned) {
    const values = mapData.data.map((d) => d.value)
    const interpolator = getInterpolator(mapData.scale, schemeId)
    const colors = sampleColors(interpolator, bins)
    const qScale = scaleQuantile()
      .domain(values.length ? values : [0, 1])
      .range(colors)
    const thresholds = qScale.quantiles()
    const edges = [Math.min(...values), ...thresholds, Math.max(...values)]
    return colors.map((color, i) => ({ value: edges[i], upper: edges[i + 1], color }))
  }

  const { scale, domain } = getColorScale(mapData, { schemeId })
  const [minV, maxV] = domain
  const stops = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const value = minV + t * (maxV - minV)
    stops.push({ value, color: scale(value) })
  }
  return stops
}
