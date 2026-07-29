import { useEffect, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { zoom } from 'd3-zoom'
import worldTopology from 'world-atlas/countries-110m.json'
import { renderMap, getLegendStops } from '../core/render.js'
import { RankedList, DataTable } from './CompanionView.jsx'

const SVG_NS = 'http://www.w3.org/2000/svg'

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

export function MapView({
  mapData,
  svgRef,
  regionId,
  showValues,
  schemeId,
  binned,
  displayMode,
  pinnedIso3,
  onTogglePin,
  companionView,
}) {
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  const zoomLayerElRef = useRef(null)
  const zoomBehaviorRef = useRef(null)
  const lastTransformRef = useRef(null)
  const [size, setSize] = useState({ width: 800, height: 460 })
  const [tooltip, setTooltip] = useState(null)
  const [hitAreas, setHitAreas] = useState([])

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

  // Pan/zoom: bound once to the <svg>; the handler re-applies the current
  // transform to a wrapper <g> we recreate around the content on every render.
  useEffect(() => {
    if (!svgRef.current) return
    const svgSelection = select(svgRef.current)
    const zoomBehavior = zoom()
      .scaleExtent([1, 10])
      .on('zoom', (event) => {
        lastTransformRef.current = event.transform
        if (zoomLayerElRef.current) {
          zoomLayerElRef.current.setAttribute('transform', String(event.transform))
        }
      })
    svgSelection.call(zoomBehavior)
    zoomBehaviorRef.current = zoomBehavior
    return () => svgSelection.on('.zoom', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showTooltip(event, hit) {
    const containerBox = containerRef.current?.getBoundingClientRect()
    if (!containerBox) return
    setTooltip({
      x: event.clientX - containerBox.left,
      y: event.clientY - containerBox.top,
      name: hit.name,
      value: hit.value,
      reasoning: hit.reasoning,
    })
  }

  function hideTooltip() {
    setTooltip(null)
  }

  useEffect(() => {
    if (!svgRef.current || !mapData) return
    const rendered = renderMap(svgRef.current, {
      mapData,
      worldTopology,
      width: size.width,
      height: size.height,
      regionId,
      showValues,
      schemeId,
      binned,
      displayMode,
    })

    // Wrap the freshly-drawn content in a single <g> so zoom/pan can
    // transform it as a unit, and reapply whatever transform was active.
    const wrapper = document.createElementNS(SVG_NS, 'g')
    wrapper.setAttribute('class', 'zoom-layer')
    for (const child of Array.from(svgRef.current.childNodes)) wrapper.appendChild(child)
    svgRef.current.appendChild(wrapper)
    zoomLayerElRef.current = wrapper
    if (lastTransformRef.current) wrapper.setAttribute('transform', String(lastTransformRef.current))

    for (const hit of rendered.hitAreas) {
      if (pinnedIso3?.has(hit.iso3)) {
        hit.element.setAttribute('stroke', '#111827')
        hit.element.setAttribute('stroke-width', '2')
      }
      hit.element.style.cursor = 'pointer'
      hit.element.addEventListener('mouseenter', (e) => showTooltip(e, hit))
      hit.element.addEventListener('mousemove', (e) => showTooltip(e, hit))
      hit.element.addEventListener('mouseleave', hideTooltip)
      hit.element.addEventListener('click', () => onTogglePin?.(hit.iso3))
    }

    setHitAreas(rendered.hitAreas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData, size, svgRef, regionId, showValues, schemeId, binned, displayMode, pinnedIso3])

  return (
    <div className="map-view">
      {mapData && (
        <div className="map-header">
          <h2>{mapData.title}</h2>
          <p className="map-unit">{mapData.unit}</p>
          <p className="map-explanation">{mapData.explanation}</p>
        </div>
      )}
      <div className="map-canvas" ref={containerRef}>
        <svg ref={svgRef} role="img" aria-label={mapData?.title ?? 'World map'} />
        {tooltip && (
          <div ref={tooltipRef} className="map-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
            <strong>{tooltip.name}</strong>
            <br />
            {tooltip.value} {mapData?.unit}
            {tooltip.reasoning && (
              <>
                <br />
                <span className="map-tooltip-reasoning">{tooltip.reasoning}</span>
              </>
            )}
          </div>
        )}
      </div>
      {mapData && (
        <div className="map-footer">
          <Legend mapData={mapData} schemeId={schemeId} binned={binned} />
          <p className="ai-caption">AI-generated, not real data</p>
        </div>
      )}
      {companionView === 'ranked' && hitAreas.length > 0 && (
        <RankedList hitAreas={hitAreas} unit={mapData?.unit} />
      )}
      {companionView === 'table' && hitAreas.length > 0 && (
        <DataTable hitAreas={hitAreas} unit={mapData?.unit} />
      )}
    </div>
  )
}
