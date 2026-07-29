import { useEffect, useRef, useState } from 'react'
import worldTopology from 'world-atlas/countries-110m.json'
import { renderChoropleth, getLegendStops } from '../core/render.js'

function Legend({ mapData, schemeId, binned }) {
  const stops = getLegendStops(mapData, { schemeId, binned, bins: 6, steps: 6 })
  return (
    <div className="legend">
      {binned ? (
        <div className="legend-bins">
          {stops.map((s, i) => (
            <div key={i} className="legend-bin">
              <span className="legend-swatch" style={{ background: s.color }} />
              <span className="legend-bin-label">
                {formatValue(s.value)}–{formatValue(s.upper)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="legend-ramp">
            {stops.map((s, i) => (
              <div key={i} className="legend-swatch" style={{ background: s.color }} />
            ))}
          </div>
          <div className="legend-labels">
            <span>{formatValue(stops[0].value)}</span>
            <span>{formatValue(stops[stops.length - 1].value)}</span>
          </div>
        </>
      )}
      <div className="legend-swatch-row">
        <span className="legend-swatch legend-swatch-nodata" />
        <span>no data</span>
      </div>
    </div>
  )
}

function formatValue(v) {
  if (Math.abs(v) >= 1000) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

export function MapView({ mapData, svgRef, regionId, showValues, schemeId, binned }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 800, height: 460 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      setSize({ width, height: Math.max(320, width * 0.55) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || !mapData) return
    renderChoropleth(svgRef.current, {
      mapData,
      worldTopology,
      width: size.width,
      height: size.height,
      regionId,
      showValues,
      schemeId,
      binned,
    })
  }, [mapData, size, svgRef, regionId, showValues, schemeId, binned])

  return (
    <div className="map-view">
      {mapData && (
        <div className="map-header">
          <h2>{mapData.title}</h2>
          <p className="map-unit">{mapData.unit}</p>
        </div>
      )}
      <div className="map-canvas" ref={containerRef}>
        <svg ref={svgRef} role="img" aria-label={mapData?.title ?? 'World map'} />
      </div>
      {mapData && (
        <div className="map-footer">
          <Legend mapData={mapData} schemeId={schemeId} binned={binned} />
          <p className="ai-caption">AI-generated, not real data</p>
        </div>
      )}
    </div>
  )
}
