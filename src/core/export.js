// SVG -> string / PNG / JSON export helpers, plus JSON import parsing. No
// React imports; operates on plain data and DOM nodes so it can be reused
// outside the UI.

import { parseMapData } from './schema.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const AI_CAPTION_TEXT = 'AI-generated, not real data'

/**
 * Serializes an SVG element to a standalone XML string. Bakes in the
 * "AI-generated, not real data" caption (shown separately in the live UI, but
 * otherwise lost once the SVG/PNG leaves the app) so exported files always
 * carry the disclaimer.
 * @param {SVGSVGElement} svgEl
 * @returns {string}
 */
export function svgToString(svgEl) {
  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const width = Number(clone.getAttribute('width')) || svgEl.clientWidth || 800
  const height = Number(clone.getAttribute('height')) || svgEl.clientHeight || 500
  if (!clone.getAttribute('width')) clone.setAttribute('width', String(width))
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(height))

  const caption = document.createElementNS(SVG_NS, 'text')
  caption.setAttribute('x', String(width - 6))
  caption.setAttribute('y', String(height - 6))
  caption.setAttribute('text-anchor', 'end')
  caption.setAttribute('font-size', '11')
  caption.setAttribute('font-style', 'italic')
  caption.setAttribute('font-family', 'sans-serif')
  caption.setAttribute('fill', '#6b6375')
  caption.setAttribute('paint-order', 'stroke')
  caption.setAttribute('stroke', '#ffffff')
  caption.setAttribute('stroke-width', '3')
  caption.textContent = AI_CAPTION_TEXT
  clone.appendChild(caption)

  return new XMLSerializer().serializeToString(clone)
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
 * Downloads the SVG element as a .svg file.
 * @param {SVGSVGElement} svgEl
 * @param {string} [filename]
 */
export function exportSvg(svgEl, filename = 'map.svg') {
  const svgString = svgToString(svgEl)
  downloadBlob(filename, svgString, 'image/svg+xml')
}

/**
 * Rasterizes the SVG element to a PNG and downloads it.
 * @param {SVGSVGElement} svgEl
 * @param {string} [filename]
 * @param {number} [scale] device-pixel-ratio-style upscale for a crisper export
 * @returns {Promise<void>}
 */
export function exportPng(svgEl, filename = 'map.png', scale = 2) {
  const svgString = svgToString(svgEl)
  const width = Number(svgEl.getAttribute('width')) || svgEl.clientWidth || 800
  const height = Number(svgEl.getAttribute('height')) || svgEl.clientHeight || 500

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
