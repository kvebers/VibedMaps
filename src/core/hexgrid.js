// Axial hex-grid math (pointy-top hexagons), used by the hexbin/tile-grid
// display mode to snap countries onto a non-overlapping grid while keeping
// their relative geographic layout. Reference: redblobgames.com/grids/hexagons.

const SQRT3 = Math.sqrt(3)

// Six axial neighbor directions, in ring-walk order.
const DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

function hexAdd(a, b) {
  return { q: a.q + b.q, r: a.r + b.r }
}

function hexScale(dir, k) {
  return { q: dir.q * k, r: dir.r * k }
}

/** All cells at exactly `radius` hex-steps from `center` (radius 0 = center itself). */
function hexRing(center, radius) {
  if (radius === 0) return [center]
  const results = []
  let hex = hexAdd(center, hexScale(DIRS[4], radius))
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(hex)
      hex = hexAdd(hex, DIRS[i])
    }
  }
  return results
}

function hexRound(qf, rf) {
  const x = qf
  const z = rf
  const y = -x - z
  let rx = Math.round(x)
  const ry = Math.round(y)
  let rz = Math.round(z)
  const xDiff = Math.abs(rx - x)
  const yDiff = Math.abs(ry - y)
  const zDiff = Math.abs(rz - z)
  // Only q (x) and r (z) are returned, so the y-branch needs no correction —
  // rx/rz are already the most accurate rounding in that case.
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz
  else if (zDiff > yDiff) rz = -rx - ry
  return { q: rx, r: rz }
}

function pixelToHex(x, y, size) {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / size
  const rf = ((2 / 3) * y) / size
  return hexRound(qf, rf)
}

function hexToPixel(q, r, size) {
  const x = size * (SQRT3 * q + (SQRT3 / 2) * r)
  const y = size * ((3 / 2) * r)
  return [x, y]
}

/**
 * The 6 corner points of a pointy-top hexagon centered at (cx, cy).
 * @returns {Array<[number, number]>}
 */
export function hexCorners(cx, cy, size) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)])
  }
  return pts
}

/**
 * Snaps each point to the nearest free cell on a hex grid, spiraling outward
 * from its ideal cell when occupied, so no two points collide.
 * @param {Array<{ x: number, y: number } & Record<string, unknown>>} points ideal positions
 * @param {number} size hex circumradius, in the same units as x/y
 * @returns {Array<{ px: number, py: number } & Record<string, unknown>>} resolved pixel centers, spread onto the fields of the input points
 */
export function resolveHexPositions(points, size) {
  const occupied = new Set()
  const resolved = []
  for (const p of points) {
    const ideal = pixelToHex(p.x, p.y, size)
    let key = `${ideal.q},${ideal.r}`
    let chosen = ideal
    if (occupied.has(key)) {
      chosen = null
      for (let radius = 1; radius < 60 && !chosen; radius++) {
        for (const cell of hexRing(ideal, radius)) {
          const k = `${cell.q},${cell.r}`
          if (!occupied.has(k)) {
            chosen = cell
            key = k
            break
          }
        }
      }
      if (!chosen) {
        chosen = ideal
        key = `${key}-overflow-${resolved.length}`
      }
    }
    occupied.add(key)
    const [px, py] = hexToPixel(chosen.q, chosen.r, size)
    resolved.push({ ...p, px, py })
  }
  return resolved
}
