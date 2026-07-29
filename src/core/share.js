// Encodes/decodes shareable app state into a URL hash — no backend, no
// database. A link with a populated hash reproduces a map with zero API
// calls, since the full MapData travels inside the URL itself.

import { parseMapData } from './schema.js'

const HASH_PREFIX = '#share='

/**
 * @typedef {Object} ShareState
 * @property {import('./schema').MapData} mapData
 * @property {string} [regionId]
 * @property {string} [displayMode]
 * @property {string} [schemeId]
 * @property {boolean} [binned]
 */

function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/**
 * Builds a shareable URL (current origin/path + an encoded hash).
 * @param {ShareState} state
 * @returns {string}
 */
export function buildShareUrl(state) {
  const encoded = toBase64Url(JSON.stringify(state))
  const url = new URL(window.location.href)
  url.hash = `${HASH_PREFIX}${encoded}`
  return url.toString()
}

/**
 * Reads share state out of the current URL hash, if present and valid.
 * @returns {ShareState | null}
 */
export function readShareStateFromLocation() {
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  try {
    const json = fromBase64Url(hash.slice(HASH_PREFIX.length))
    const raw = JSON.parse(json)
    const parsed = parseMapData(raw.mapData)
    if (!parsed.success) return null
    return {
      mapData: parsed.data,
      regionId: typeof raw.regionId === 'string' ? raw.regionId : undefined,
      displayMode: typeof raw.displayMode === 'string' ? raw.displayMode : undefined,
      schemeId: typeof raw.schemeId === 'string' ? raw.schemeId : undefined,
      binned: typeof raw.binned === 'boolean' ? raw.binned : undefined,
    }
  } catch {
    return null
  }
}
