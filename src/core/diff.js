// Computes a synthetic diverging MapData representing (current - comparison)
// per country, for the "compare against an imported dataset" feature.

/**
 * @param {import('./schema').MapData} current
 * @param {import('./schema').MapData} comparison
 * @returns {import('./schema').MapData} a new MapData, scale forced to 'diverging'
 */
export function computeDiff(current, comparison) {
  const comparisonByIso3 = new Map(comparison.data.map((d) => [d.iso3, d.value]))
  const data = []
  for (const d of current.data) {
    if (comparisonByIso3.has(d.iso3)) {
      data.push({ iso3: d.iso3, value: d.value - comparisonByIso3.get(d.iso3) })
    }
  }
  return {
    title: `${current.title} — diff vs "${comparison.title}"`,
    unit: current.unit,
    scale: 'diverging',
    explanation:
      `Computed locally (not AI-generated): each country's value here is (current − comparison), i.e. ` +
      `"${current.title}" minus "${comparison.title}". Positive/blue means higher in the current map, ` +
      `negative/red means higher in the comparison file. Only countries present in both are shown.`,
    data,
  }
}
