// SVG -> string / PNG / JSON export helpers, plus JSON import parsing. No
// React imports; operates on plain data and DOM nodes so it can be reused
// outside the UI.

import { parseMapData } from './schema.js'
import { getLegendStops } from './render.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const BRAND_TEXT = 'VibedMaps'
const AI_CAPTION_TEXT = 'AI-generated, not real data'
const TEXT_COLOR = '#000000'
const MUTED_COLOR = '#590202'
const ACCENT_COLOR = '#bf0404'
const PADDING = 16
const TITLE_SIZE = 18
const UNIT_SIZE = 12
const EXPLANATION_SIZE = 11
const LEGEND_LABEL_SIZE = 10
const LINE_GAP = 1.4

function formatLegendValue(v) {
  if (typeof v !== 'number') return String(v)
  if (Math.abs(v) >= 1000) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

function measureText(ctx, text, font) {
  ctx.font = font
  return ctx.measureText(text).width
}

/** Greedy word-wrap using an actual canvas font measurement, so exported text wraps like the live UI. */
function wrapText(ctx, text, font, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measureText(ctx, candidate, font) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function textEl(x, y, text, { size = 12, weight = 'normal', italic = false, fill = TEXT_COLOR, anchor = 'start' } = {}) {
  const el = document.createElementNS(SVG_NS, 'text')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('font-size', String(size))
  el.setAttribute('font-family', 'sans-serif')
  el.setAttribute('font-weight', weight)
  if (italic) el.setAttribute('font-style', 'italic')
  el.setAttribute('fill', fill)
  el.setAttribute('text-anchor', anchor)
  el.textContent = text
  return el
}

function rectEl(x, y, w, h, fill) {
  const el = document.createElementNS(SVG_NS, 'rect')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  el.setAttribute('fill', fill)
  return el
}

/**
 * Composes a standalone, exportable SVG: the rendered map plus everything
 * that's shown alongside it in the live UI but otherwise lives in plain HTML
 * (title, unit, explanation, legend, "AI-generated" caption) — all of which
 * would otherwise be lost the moment the SVG/PNG leaves the app.
 * @param {SVGSVGElement} svgEl the live, rendered map <svg>
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean }} [options]
 * @returns {SVGSVGElement} a new, detached <svg> ready to serialize
 */
export function buildExportSvg(svgEl, mapData, options = {}) {
  const { schemeId, binned = false } = options
  const mapWidth = Number(svgEl.getAttribute('width')) || svgEl.clientWidth || 800
  const mapHeight = Number(svgEl.getAttribute('height')) || svgEl.clientHeight || 500
  const contentWidth = mapWidth - PADDING * 2

  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')

  const titleLines = mapData?.title ? wrapText(mctx, mapData.title, `600 ${TITLE_SIZE}px sans-serif`, contentWidth) : []
  const explanationLines = mapData?.explanation
    ? wrapText(mctx, mapData.explanation, `${EXPLANATION_SIZE}px sans-serif`, contentWidth)
    : []

  let legendStops = []
  if (mapData) {
    try {
      legendStops = getLegendStops(mapData, { schemeId, binned, bins: 6, steps: 6 })
    } catch {
      legendStops = []
    }
  }

  const headerHeight =
    PADDING +
    titleLines.length * TITLE_SIZE * LINE_GAP +
    (mapData?.unit ? UNIT_SIZE * LINE_GAP : 0) +
    (explanationLines.length ? explanationLines.length * EXPLANATION_SIZE * LINE_GAP + 6 : 0) +
    PADDING * 0.5
  const legendHeight = legendStops.length ? 16 + LEGEND_LABEL_SIZE * LINE_GAP + PADDING * 1.5 : PADDING
  const totalWidth = mapWidth
  const totalHeight = headerHeight + mapHeight + legendHeight

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('xmlns', SVG_NS)
  svg.setAttribute('width', String(totalWidth))
  svg.setAttribute('height', String(totalHeight))
  svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
  svg.appendChild(rectEl(0, 0, totalWidth, totalHeight, '#ffffff'))

  // Header: title, unit, explanation
  let cy = PADDING + TITLE_SIZE
  for (const line of titleLines) {
    svg.appendChild(textEl(PADDING, cy, line, { size: TITLE_SIZE, weight: '600' }))
    cy += TITLE_SIZE * LINE_GAP
  }
  if (mapData?.unit) {
    svg.appendChild(textEl(PADDING, cy, mapData.unit, { size: UNIT_SIZE, fill: MUTED_COLOR }))
    cy += UNIT_SIZE * LINE_GAP
  }
  if (explanationLines.length) {
    cy += 6
    for (const line of explanationLines) {
      svg.appendChild(textEl(PADDING, cy, line, { size: EXPLANATION_SIZE, fill: MUTED_COLOR }))
      cy += EXPLANATION_SIZE * LINE_GAP
    }
  }

  // Map content, moved into a translated group so it sits below the header.
  // Clipped to its own bounds so a panned/zoomed live map can never bleed
  // into the header/legend/caption area of the exported image.
  const clipId = 'export-map-clip'
  const clipPath = document.createElementNS(SVG_NS, 'clipPath')
  clipPath.setAttribute('id', clipId)
  clipPath.appendChild(rectEl(0, 0, mapWidth, mapHeight, 'none'))
  svg.appendChild(clipPath)

  const mapGroup = document.createElementNS(SVG_NS, 'g')
  mapGroup.setAttribute('transform', `translate(0, ${headerHeight})`)
  mapGroup.setAttribute('clip-path', `url(#${clipId})`)
  const mapClone = svgEl.cloneNode(true)
  while (mapClone.firstChild) mapGroup.appendChild(mapClone.firstChild)
  svg.appendChild(mapGroup)

  // Legend
  if (legendStops.length) {
    const ly = headerHeight + mapHeight + PADDING * 0.75
    if (mapData?.scale === 'categorical') {
      let lx = PADDING
      const font = `${LEGEND_LABEL_SIZE}px sans-serif`
      for (const stop of legendStops) {
        if (stop.color) svg.appendChild(rectEl(lx, ly, 12, 12, stop.color))
        const label = String(stop.value)
        svg.appendChild(textEl(lx + (stop.color ? 16 : 0), ly + 10, label, { size: LEGEND_LABEL_SIZE, fill: MUTED_COLOR }))
        lx += (stop.color ? 16 : 0) + measureText(mctx, label, font) + 16
      }
    } else if (binned) {
      let lx = PADDING
      const font = `${LEGEND_LABEL_SIZE}px sans-serif`
      for (const stop of legendStops) {
        svg.appendChild(rectEl(lx, ly, 12, 12, stop.color))
        const label = `${formatLegendValue(stop.value)}–${formatLegendValue(stop.upper)}`
        svg.appendChild(textEl(lx + 16, ly + 10, label, { size: LEGEND_LABEL_SIZE, fill: MUTED_COLOR }))
        lx += 16 + measureText(mctx, label, font) + 16
      }
    } else {
      const rampWidth = Math.min(220, contentWidth)
      const stepW = rampWidth / legendStops.length
      legendStops.forEach((stop, i) => {
        svg.appendChild(rectEl(PADDING + i * stepW, ly, stepW, 12, stop.color))
      })
      svg.appendChild(textEl(PADDING, ly + 12 + LEGEND_LABEL_SIZE, formatLegendValue(legendStops[0].value), {
        size: LEGEND_LABEL_SIZE,
        fill: MUTED_COLOR,
      }))
      svg.appendChild(
        textEl(PADDING + rampWidth, ly + 12 + LEGEND_LABEL_SIZE, formatLegendValue(legendStops[legendStops.length - 1].value), {
          size: LEGEND_LABEL_SIZE,
          fill: MUTED_COLOR,
          anchor: 'end',
        }),
      )
    }
  }

  // "VibedMaps · AI-generated, not real data" caption, bottom-right corner.
  // Given its own backing chip so it stays legible regardless of what's
  // drawn underneath (e.g. a dark country fill right at the edge of the map).
  const captionFont = `italic 11px sans-serif`
  const brandFont = `700 11px sans-serif`
  const captionSep = '  ·  '
  const captionWidth =
    measureText(mctx, BRAND_TEXT, brandFont) + measureText(mctx, captionSep, captionFont) + measureText(mctx, AI_CAPTION_TEXT, captionFont)
  const captionX = totalWidth - PADDING * 0.5
  const captionY = totalHeight - PADDING * 0.4
  const chipPaddingX = 8
  const chipPaddingY = 5
  const chip = rectEl(
    captionX - captionWidth - chipPaddingX,
    captionY - 11 - chipPaddingY,
    captionWidth + chipPaddingX * 2,
    11 + chipPaddingY * 2,
    'rgba(255, 255, 255, 0.85)',
  )
  chip.setAttribute('rx', '5')
  svg.appendChild(chip)

  const captionEl = document.createElementNS(SVG_NS, 'text')
  captionEl.setAttribute('x', String(captionX))
  captionEl.setAttribute('y', String(captionY))
  captionEl.setAttribute('font-family', 'sans-serif')
  captionEl.setAttribute('text-anchor', 'end')

  const brandTspan = document.createElementNS(SVG_NS, 'tspan')
  brandTspan.setAttribute('font-size', '11')
  brandTspan.setAttribute('font-weight', '700')
  brandTspan.setAttribute('fill', ACCENT_COLOR)
  brandTspan.textContent = BRAND_TEXT

  const sepTspan = document.createElementNS(SVG_NS, 'tspan')
  sepTspan.setAttribute('font-size', '11')
  sepTspan.setAttribute('fill', MUTED_COLOR)
  sepTspan.textContent = captionSep

  const aiTspan = document.createElementNS(SVG_NS, 'tspan')
  aiTspan.setAttribute('font-size', '11')
  aiTspan.setAttribute('font-style', 'italic')
  aiTspan.setAttribute('fill', MUTED_COLOR)
  aiTspan.textContent = AI_CAPTION_TEXT

  captionEl.append(brandTspan, sepTspan, aiTspan)
  svg.appendChild(captionEl)

  return svg
}

/**
 * Serializes an SVG element to a standalone XML string.
 * @param {SVGSVGElement} svgEl
 * @returns {string}
 */
export function svgToString(svgEl) {
  return new XMLSerializer().serializeToString(svgEl)
}

/**
 * Triggers a browser download of the given text content.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadBlob(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads the map (plus title/unit/explanation/legend/caption) as a .svg file.
 * @param {SVGSVGElement} svgEl the live, rendered map <svg>
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean }} [options]
 * @param {string} [filename]
 */
export function exportSvg(svgEl, mapData, options = {}, filename = 'map.svg') {
  const exportSvgEl = buildExportSvg(svgEl, mapData, options)
  downloadBlob(filename, svgToString(exportSvgEl), 'image/svg+xml')
}

/**
 * Rasterizes the map (plus title/unit/explanation/legend/caption) to a PNG and downloads it.
 * @param {SVGSVGElement} svgEl the live, rendered map <svg>
 * @param {import('./schema').MapData} mapData
 * @param {{ schemeId?: string, binned?: boolean }} [options]
 * @param {string} [filename]
 * @param {number} [scale] device-pixel-ratio-style upscale for a crisper export
 * @returns {Promise<void>}
 */
export function exportPng(svgEl, mapData, options = {}, filename = 'map.png', scale = 2) {
  const exportSvgEl = buildExportSvg(svgEl, mapData, options)
  const svgString = svgToString(exportSvgEl)
  const width = Number(exportSvgEl.getAttribute('width'))
  const height = Number(exportSvgEl.getAttribute('height'))

  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to rasterize SVG to PNG.'))
          return
        }
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(pngUrl)
        resolve()
      }, 'image/png')
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG for PNG export.'))
    }

    img.src = url
  })
}

/**
 * Downloads the given map data as a standalone .json file.
 * @param {import('./schema').MapData} mapData
 * @param {string} [filename]
 */
export function exportJson(mapData, filename = 'map-data.json') {
  downloadBlob(filename, JSON.stringify(mapData, null, 2), 'application/json')
}

/**
 * Parses and validates a JSON file's text content as MapData.
 * @param {string} text
 * @returns {{ success: true, data: import('./schema').MapData } | { success: false, error: string }}
 */
export function parseImportedJson(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    return { success: false, error: 'File is not valid JSON.' }
  }
  return parseMapData(raw)
}

/**
 * Reads a File (e.g. from an <input type="file">) and validates it as MapData.
 * @param {File} file
 * @returns {Promise<{ success: true, data: import('./schema').MapData } | { success: false, error: string }>}
 */
export function importJsonFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(parseImportedJson(String(reader.result)))
    reader.onerror = () => resolve({ success: false, error: 'Failed to read file.' })
    reader.readAsText(file)
  })
}
