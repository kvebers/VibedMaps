// Alternative ways to read the same data as the map: a sorted bar list and a
// plain table (useful for screen readers / anyone who'd rather scan text).

function sortByValue(hitAreas) {
  const categorical = hitAreas.some((d) => typeof d.value !== 'number')
  if (categorical) return [...hitAreas].sort((a, b) => String(a.value).localeCompare(String(b.value)))
  return [...hitAreas].sort((a, b) => b.value - a.value)
}

export function RankedList({ hitAreas, unit }) {
  const categorical = hitAreas.some((d) => typeof d.value !== 'number')
  const sorted = sortByValue(hitAreas)
  const maxAbs = Math.max(...sorted.map((d) => (typeof d.value === 'number' ? Math.abs(d.value) : 1)), 1)
  return (
    <ol className="ranked-list">
      {sorted.map((d) => (
        <li key={d.iso3} className="ranked-list-row">
          <div className="ranked-list-main">
            <span className="ranked-list-name">{d.name}</span>
            {!categorical && (
              <span className="ranked-list-bar-track">
                <span
                  className="ranked-list-bar"
                  style={{ width: `${(Math.abs(d.value) / maxAbs) * 100}%` }}
                />
              </span>
            )}
            <span className="ranked-list-value">
              {d.value} {categorical ? '' : unit}
            </span>
          </div>
          {d.reasoning && <p className="ranked-list-reasoning">{d.reasoning}</p>}
        </li>
      ))}
    </ol>
  )
}

export function DataTable({ hitAreas, unit }) {
  const categorical = hitAreas.some((d) => typeof d.value !== 'number')
  const sorted = sortByValue(hitAreas)
  const hasReasoning = sorted.some((d) => d.reasoning)
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Country</th>
          <th>ISO3</th>
          <th>Value ({unit})</th>
          {hasReasoning && <th>Why</th>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((d) => (
          <tr key={d.iso3}>
            <td>{d.name}</td>
            <td>{d.iso3}</td>
            <td>{d.value}</td>
            {hasReasoning && <td>{d.reasoning || ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
