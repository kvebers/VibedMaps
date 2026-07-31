// Small Levenshtein-distance-based string similarity, used to cluster
// categorical map values that are spelling variants of the same answer
// (e.g. "hei" vs "hej") so they get the same color instead of reading as
// unrelated categories just because the AI didn't return byte-identical strings.

/** Classic dynamic-programming edit distance. */
function levenshteinDistance(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

/**
 * Case/whitespace-insensitive similarity: 1 = identical, 0 = completely different.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function stringSimilarity(a, b) {
  const normA = a.trim().toLowerCase()
  const normB = b.trim().toLowerCase()
  if (normA === normB) return 1
  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(normA, normB) / maxLen
}

/**
 * Greedily clusters strings that are close spelling variants of one another
 * (each value joins the first existing cluster it's similar enough to,
 * otherwise starts a new one), preserving first-appearance order.
 * @param {string[]} values
 * @param {{ threshold?: number }} [options] similarity needed to join an existing cluster (0-1)
 * @returns {Array<{ key: string, label: string, members: string[] }>} key: normalized cluster identity used for matching; label: first original-casing value seen, for display
 */
export function clusterSimilarValues(values, { threshold = 0.6 } = {}) {
  const clusters = []
  for (const raw of values) {
    const str = String(raw)
    const norm = str.trim().toLowerCase()
    let cluster = clusters.find((c) => stringSimilarity(norm, c.key) >= threshold)
    if (!cluster) {
      cluster = { key: norm, label: str, members: [] }
      clusters.push(cluster)
    }
    cluster.members.push(str)
  }
  return clusters
}
