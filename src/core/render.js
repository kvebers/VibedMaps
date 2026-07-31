import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { scaleSequential, scaleDiverging, scaleQuantile, scaleSqrt } from 'd3-scale'
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'
import { feature } from 'topojson-client'
import { ISO3_TO_NUMERIC } from './isoNumeric.js'
import { REGIONS } from './regions.js'
import { getInterpolator, getCategoricalColors } from './colorSchemes.js'
import { hexCorners, resolveHexPositions } from './hexgrid.js'
import { clusterSimilarValues } from './textSimilarity.js'

/** Magnitude used for symbol sizing — categorical (string) values all size the same. */
function magnitudeOf(value) {
  return typeof value === 'number' ? Math.abs(value) : 1
}

const SVG_NS = 'http://www.w3.org/2000/svg'
export const NO_DATA_COLOR = '#e2e2e2'
const OUTLINE_FILL = '#f0f0f0'
const OUTLINE_STROKE = '#dcdcdc'

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
 * Builds the shared geography for a render: the filtered feature set and a
 * projection/path generator fit to the region (or a fixed crop box for
 * regions where auto-fitting to feature shapes would be misleading — see
 * regions.js).
 * @param {{ worldTopology: object, regionId?: string, width: number, height: number }} options
 */
function buildGeoContext({ worldTopology, regionId, width, height }) {
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
  return { features, pathGenerator }
}

/**
 * Picks a color scale from d3-scale-chromatic based on mapData.scale.
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean, bins?: number }} [options]
 * @returns {{ scale: (v: number | string) => string, domain: [number, number] | string[], type: 'sequential' | 'diverging' | 'categorical', clusters?: Array<{ key: string, label: string, members: string[] }> }}
 */
export function getColorScale(mapData, options = {}) {
  const { schemeId, binned = false, bins = 6 } = options
  const values = mapData.data.map((d) => d.value)

  if (mapData.scale === 'categorical') {
    // Group spelling variants of the same answer (e.g. "hei" vs "hej") so
    // they land in the same color category, then cycle through the fixed
    // palette by index — a world map can easily produce more distinct
    // clusters (30+) than any palette has visually distinct colors (~10),
    // so reuse across unrelated clusters is expected, not a bug.
    const uniqueValues = [...new Set(values.map(String))]
    const clusters = clusterSimilarValues(uniqueValues)
    const palette = getCategoricalColors(schemeId)
    const colorByKey = new Map(clusters.map((c, i) => [c.key, palette[i % palette.length]]))
    const keyByValue = new Map()
    for (const cluster of clusters) {
      for (const member of cluster.members) keyByValue.set(member, cluster.key)
    }
    const scale = (v) => colorByKey.get(keyByValue.get(String(v))) ?? palette[0]
    return { scale, domain: clusters.map((c) => c.label), type: 'categorical', clusters }
  }

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
 * Builds numeric-ISO -> value and numeric-ISO -> iso3 lookups by joining AI
 * data onto the standard ISO 3166-1 numeric codes that world-atlas TopoJSON
 * keys features by.
 * @param {import('./schema').MapData} mapData
 */
function buildDataMaps(mapData) {
  const valueByNumeric = new Map()
  const iso3ByNumeric = new Map()
  const reasoningByNumeric = new Map()
  for (const d of mapData.data) {
    const numeric = ISO3_TO_NUMERIC[d.iso3]
    if (numeric) {
      valueByNumeric.set(numeric, d.value)
      iso3ByNumeric.set(numeric, d.iso3)
      if (d.reasoning) reasoningByNumeric.set(numeric, d.reasoning)
    }
  }
  return { valueByNumeric, iso3ByNumeric, reasoningByNumeric }
}

function resetSvg(svgEl, width, height) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild)
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svgEl.setAttribute('width', String(width))
  svgEl.setAttribute('height', String(height))
}

function appendTitle(el, text) {
  const title = document.createElementNS(SVG_NS, 'title')
  title.textContent = text
  el.appendChild(title)
}

/**
 * Appends a value label positioned at (x, y). `box` is the label's country/
 * symbol's on-screen footprint *before* any zoom transform — stashed as data
 * attributes (plus the "value-label" class) so the live zoom handler in
 * MapView can re-evaluate fit as the user zooms in, instead of the fit
 * decision being frozen at whatever zoom level the map happened to render at.
 */
function appendValueLabel(g, x, y, text, box = {}) {
  const { boxW = Infinity, boxH = Infinity } = box
  const el = document.createElementNS(SVG_NS, 'text')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('text-anchor', 'middle')
  el.setAttribute('dominant-baseline', 'middle')
  el.setAttribute('fill', '#111827')
  el.setAttribute('paint-order', 'stroke')
  el.setAttribute('stroke', '#ffffff')
  el.setAttribute('stroke-width', '3')
  el.setAttribute('class', 'value-label')
  el.dataset.boxW = String(boxW)
  el.dataset.boxH = String(boxH)
  if (!labelFits(text, boxW, boxH)) el.style.display = 'none'
  el.textContent = text
  g.appendChild(el)
  return el
}

function formatLabelValue(value) {
  if (typeof value !== 'number') return String(value)
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/**
 * Whether a label roughly fits within a country/symbol's on-screen box —
 * used both at initial render (skip labels that would overflow a tiny
 * country at the current zoom level) and live, by MapView's zoom handler,
 * to reveal labels for countries that only become big enough once zoomed in.
 * @param {string} text
 * @param {number} boxW
 * @param {number} boxH
 * @param {number} [fontSize]
 */
export function labelFits(text, boxW, boxH, fontSize = 9) {
  const estimatedWidth = text.length * fontSize * 0.6
  return boxW >= estimatedWidth && boxH >= fontSize * 1.4
}

function tooltipText(name, value, unit, reasoning) {
  if (value === undefined) return `${name}: no data`
  const base = `${name}: ${value} ${unit}`
  return reasoning ? `${base}\n${reasoning}` : base
}

/**
 * Renders a choropleth (color-fills each country by value) into an existing
 * <svg> element. Framework-agnostic — only touches the DOM node it's given.
 * @param {SVGSVGElement} svgEl
 * @param {{ mapData: import('./schema').MapData, worldTopology: object, width: number, height: number, regionId?: string, showValues?: boolean, schemeId?: string, binned?: boolean, bins?: number }} options
 * @returns {{ colorScale: object, hitAreas: Array<{ iso3: string, name: string, value: number, element: Element, cx: number, cy: number }> }}
 */
export function renderChoropleth(
  svgEl,
  { mapData, worldTopology, width, height, regionId, showValues = false, schemeId, binned = false, bins = 6 },
) {
  resetSvg(svgEl, width, height)
  const { features, pathGenerator } = buildGeoContext({ worldTopology, regionId, width, height })
  const { valueByNumeric, iso3ByNumeric, reasoningByNumeric } = buildDataMaps(mapData)
  const colorScale = getColorScale(mapData, { schemeId, binned, bins })

  const g = document.createElementNS(SVG_NS, 'g')
  const labelsG = document.createElementNS(SVG_NS, 'g')
  labelsG.setAttribute('style', 'pointer-events: none; font: 9px sans-serif;')
  const hitAreas = []

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
    const reasoning = reasoningByNumeric.get(f.id)
    // Only give no-data countries a native tooltip: countries with data get an
    // interactive hit area with a custom React tooltip in MapView, and adding
    // a <title> on top of that made hover show both at once.
    if (value === undefined) appendTitle(path, tooltipText(name, value, mapData.unit, reasoning))
    g.appendChild(path)

    if (value !== undefined) {
      const [cx, cy] = pathGenerator.centroid(f)
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        if (showValues) {
          const label = formatLabelValue(value)
          const bounds = pathGenerator.bounds(f)
          const boxW = bounds[1][0] - bounds[0][0]
          const boxH = bounds[1][1] - bounds[0][1]
          appendValueLabel(labelsG, cx, cy, label, { boxW, boxH })
        }
        hitAreas.push({ iso3: iso3ByNumeric.get(f.id), name, value, reasoning, element: path, cx, cy })
      }
    }
  }
  svgEl.appendChild(g)
  svgEl.appendChild(labelsG)

  return { colorScale, hitAreas }
}

/**
 * Renders faint country outlines as context underneath a symbol-based mode
 * (bubble, cartogram). Not interactive.
 */
function renderOutlines(svgEl, features, pathGenerator) {
  const g = document.createElementNS(SVG_NS, 'g')
  for (const f of features) {
    const d = pathGenerator(f)
    if (!d) continue
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', OUTLINE_FILL)
    path.setAttribute('stroke', OUTLINE_STROKE)
    path.setAttribute('stroke-width', '0.5')
    g.appendChild(path)
  }
  svgEl.appendChild(g)
}

/**
 * Proportional-symbol map: a circle per country, centered on its geographic
 * centroid, sized by |value| (area-accurate via a sqrt scale) and colored by
 * the same color scale as the choropleth.
 * @param {SVGSVGElement} svgEl
 * @param {{ mapData: import('./schema').MapData, worldTopology: object, width: number, height: number, regionId?: string, showValues?: boolean, schemeId?: string, binned?: boolean, bins?: number }} options
 * @returns {{ colorScale: object, hitAreas: Array<{ iso3: string, name: string, value: number, element: Element, cx: number, cy: number }> }}
 */
export function renderBubble(
  svgEl,
  { mapData, worldTopology, width, height, regionId, showValues = false, schemeId, binned = false, bins = 6 },
) {
  resetSvg(svgEl, width, height)
  const { features, pathGenerator } = buildGeoContext({ worldTopology, regionId, width, height })
  renderOutlines(svgEl, features, pathGenerator)

  const { valueByNumeric, iso3ByNumeric, reasoningByNumeric } = buildDataMaps(mapData)
  const colorScale = getColorScale(mapData, { schemeId, binned, bins })
  const maxAbs = Math.max(...mapData.data.map((d) => magnitudeOf(d.value)), 1)
  const rScale = scaleSqrt().domain([0, maxAbs]).range([2, Math.min(width, height) * 0.06])

  const g = document.createElementNS(SVG_NS, 'g')
  const labelsG = document.createElementNS(SVG_NS, 'g')
  labelsG.setAttribute('style', 'pointer-events: none; font: 9px sans-serif;')
  const hitAreas = []

  for (const f of features) {
    const value = valueByNumeric.get(f.id)
    if (value === undefined) continue
    const [cx, cy] = pathGenerator.centroid(f)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue

    const r = rScale(magnitudeOf(value))
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(cx))
    circle.setAttribute('cy', String(cy))
    circle.setAttribute('r', String(r))
    circle.setAttribute('fill', colorScale.scale(value))
    circle.setAttribute('fill-opacity', '0.8')
    circle.setAttribute('stroke', colorScale.scale(value))
    circle.setAttribute('stroke-width', '1')

    const name = f.properties?.name ?? ''
    const reasoning = reasoningByNumeric.get(f.id)
    g.appendChild(circle)

    if (showValues) {
      const label = formatLabelValue(value)
      appendValueLabel(labelsG, cx, cy, label, { boxW: r * 1.6, boxH: r * 1.6 })
    }
    hitAreas.push({ iso3: iso3ByNumeric.get(f.id), name, value, reasoning, element: circle, cx, cy })
  }
  svgEl.appendChild(g)
  svgEl.appendChild(labelsG)

  return { colorScale, hitAreas }
}

/**
 * Dorling cartogram: like the bubble map, but circles push apart from each
 * other (via a d3-force collision simulation, ticked synchronously — no
 * animation) so same-sized circles never overlap, while staying pulled
 * toward their true geographic position.
 * @param {SVGSVGElement} svgEl
 * @param {{ mapData: import('./schema').MapData, worldTopology: object, width: number, height: number, regionId?: string, showValues?: boolean, schemeId?: string, binned?: boolean, bins?: number }} options
 * @returns {{ colorScale: object, hitAreas: Array<{ iso3: string, name: string, value: number, element: Element, cx: number, cy: number }> }}
 */
export function renderCartogram(
  svgEl,
  { mapData, worldTopology, width, height, regionId, showValues = false, schemeId, binned = false, bins = 6 },
) {
  resetSvg(svgEl, width, height)
  const { features, pathGenerator } = buildGeoContext({ worldTopology, regionId, width, height })
  renderOutlines(svgEl, features, pathGenerator)

  const { valueByNumeric, iso3ByNumeric, reasoningByNumeric } = buildDataMaps(mapData)
  const colorScale = getColorScale(mapData, { schemeId, binned, bins })
  const maxAbs = Math.max(...mapData.data.map((d) => magnitudeOf(d.value)), 1)
  const rScale = scaleSqrt().domain([0, maxAbs]).range([3, Math.min(width, height) * 0.07])

  const nodes = []
  for (const f of features) {
    const value = valueByNumeric.get(f.id)
    if (value === undefined) continue
    const [x, y] = pathGenerator.centroid(f)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    nodes.push({ f, value, x, y, ox: x, oy: y, r: rScale(magnitudeOf(value)) })
  }

  const simulation = forceSimulation(nodes)
    .force('x', forceX((d) => d.ox).strength(0.12))
    .force('y', forceY((d) => d.oy).strength(0.12))
    .force('collide', forceCollide((d) => d.r + 1))
    .stop()
  for (let i = 0; i < 200; i++) simulation.tick()

  const g = document.createElementNS(SVG_NS, 'g')
  const labelsG = document.createElementNS(SVG_NS, 'g')
  labelsG.setAttribute('style', 'pointer-events: none; font: 9px sans-serif;')
  const hitAreas = []

  for (const node of nodes) {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(node.x))
    circle.setAttribute('cy', String(node.y))
    circle.setAttribute('r', String(node.r))
    circle.setAttribute('fill', colorScale.scale(node.value))
    circle.setAttribute('fill-opacity', '0.85')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', '1')

    const name = node.f.properties?.name ?? ''
    const reasoning = reasoningByNumeric.get(node.f.id)
    g.appendChild(circle)

    if (showValues) {
      const label = formatLabelValue(node.value)
      appendValueLabel(labelsG, node.x, node.y, label, { boxW: node.r * 1.6, boxH: node.r * 1.6 })
    }
    hitAreas.push({
      iso3: iso3ByNumeric.get(node.f.id),
      name,
      value: node.value,
      reasoning,
      element: circle,
      cx: node.x,
      cy: node.y,
    })
  }
  svgEl.appendChild(g)
  svgEl.appendChild(labelsG)

  return { colorScale, hitAreas }
}

/**
 * Hexbin / tile-grid map: each country becomes an equal-size hexagon,
 * snapped onto a hex grid near its true geographic position (colliding
 * countries spiral outward to the nearest free cell). Removes size bias
 * entirely — a small, high-value country reads exactly the same as a huge
 * low-value one.
 * @param {SVGSVGElement} svgEl
 * @param {{ mapData: import('./schema').MapData, worldTopology: object, width: number, height: number, regionId?: string, showValues?: boolean, schemeId?: string, binned?: boolean, bins?: number }} options
 * @returns {{ colorScale: object, hitAreas: Array<{ iso3: string, name: string, value: number, element: Element, cx: number, cy: number }> }}
 */
export function renderHexbin(
  svgEl,
  { mapData, worldTopology, width, height, regionId, showValues = false, schemeId, binned = false, bins = 6 },
) {
  resetSvg(svgEl, width, height)
  const { features, pathGenerator } = buildGeoContext({ worldTopology, regionId, width, height })
  const { valueByNumeric, iso3ByNumeric, reasoningByNumeric } = buildDataMaps(mapData)
  const colorScale = getColorScale(mapData, { schemeId, binned, bins })

  const candidates = []
  for (const f of features) {
    const value = valueByNumeric.get(f.id)
    if (value === undefined) continue
    const [x, y] = pathGenerator.centroid(f)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    candidates.push({ f, value, x, y })
  }

  const hexSize = Math.max(8, Math.min(width, height) / (Math.sqrt(Math.max(candidates.length, 1)) * 3.4))
  const resolved = resolveHexPositions(candidates, hexSize)

  // Fit the resolved grid (which can end up larger or offset from the
  // original geo extent once collisions spread things out) back into the canvas.
  const xs = resolved.map((p) => p.px)
  const ys = resolved.map((p) => p.py)
  const bbox = {
    x0: Math.min(...xs) - hexSize,
    x1: Math.max(...xs) + hexSize,
    y0: Math.min(...ys) - hexSize,
    y1: Math.max(...ys) + hexSize,
  }
  const bboxW = Math.max(bbox.x1 - bbox.x0, 1)
  const bboxH = Math.max(bbox.y1 - bbox.y0, 1)
  const fitScale = Math.min(width / bboxW, height / bboxH) * 0.95
  const tx = width / 2 - ((bbox.x0 + bbox.x1) / 2) * fitScale
  const ty = height / 2 - ((bbox.y0 + bbox.y1) / 2) * fitScale

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${fitScale})`)
  const labelsG = document.createElementNS(SVG_NS, 'g')
  labelsG.setAttribute('style', 'pointer-events: none; font: 9px sans-serif;')
  const hitAreas = []

  for (const p of resolved) {
    const corners = hexCorners(p.px, p.py, hexSize * 0.92)
    const polygon = document.createElementNS(SVG_NS, 'polygon')
    polygon.setAttribute('points', corners.map(([x, y]) => `${x},${y}`).join(' '))
    polygon.setAttribute('fill', colorScale.scale(p.value))
    polygon.setAttribute('stroke', '#ffffff')
    polygon.setAttribute('stroke-width', String(1 / fitScale))

    const name = p.f.properties?.name ?? ''
    const reasoning = reasoningByNumeric.get(p.f.id)
    g.appendChild(polygon)

    // Screen-space (post-transform) center, for tooltips/labels/hit testing.
    const screenCx = p.px * fitScale + tx
    const screenCy = p.py * fitScale + ty
    if (showValues) {
      const label = formatLabelValue(p.value)
      const hexScreenSize = hexSize * fitScale
      appendValueLabel(labelsG, screenCx, screenCy, label, { boxW: hexScreenSize * 1.5, boxH: hexScreenSize * 1.5 })
    }
    hitAreas.push({
      iso3: iso3ByNumeric.get(p.f.id),
      name,
      value: p.value,
      reasoning,
      element: polygon,
      cx: screenCx,
      cy: screenCy,
    })
  }
  svgEl.appendChild(g)
  svgEl.appendChild(labelsG)

  return { colorScale, hitAreas }
}

const RENDERERS = {
  choropleth: renderChoropleth,
  bubble: renderBubble,
  cartogram: renderCartogram,
  hexbin: renderHexbin,
}

/**
 * Dispatches to the renderer for `options.displayMode` (default 'choropleth').
 * @param {SVGSVGElement} svgEl
 * @param {{ displayMode?: 'choropleth' | 'bubble' | 'cartogram' | 'hexbin' } & Record<string, unknown>} options
 */
export function renderMap(svgEl, { displayMode = 'choropleth', ...options }) {
  const renderer = RENDERERS[displayMode] || renderChoropleth
  return renderer(svgEl, options)
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

  if (mapData.scale === 'categorical') {
    const { scale, clusters } = getColorScale(mapData, { schemeId })
    // A world map can turn up 30+ distinct clusters — showing all of them
    // makes the legend unreadable, so only the most common ones get their
    // own swatch and the long tail is lumped into one "+N more" entry.
    const maxStops = 8
    const byFrequency = [...clusters].sort((a, b) => b.members.length - a.members.length)
    const shown = byFrequency.slice(0, maxStops)
    const stops = shown.map((c) => ({ value: c.label, color: scale(c.members[0]) }))
    const remaining = byFrequency.length - shown.length
    if (remaining > 0) stops.push({ value: `+${remaining} more`, color: null })
    return stops
  }

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
