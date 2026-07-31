import { useEffect, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { zoom } from 'd3-zoom'
import worldTopology from 'world-atlas/countries-110m.json'
import { renderMap, getLegendStops, labelFits } from '../core/render.js'
import { RankedList, DataTable } from './CompanionView.jsx'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Re-evaluates which value labels fit at the current zoom scale `k`, and
 * counter-scales each visible one so it stays a constant, readable size
 * instead of growing/shrinking along with the zoomed map underneath it.
 * Labels are tagged with their pre-zoom box size (data-box-w/-h) at render
 * time — at k=1 that's the country's actual on-screen size, but as k grows
 * a country that was too small to label initially can cross the fit
 * threshold, so this needs to re-run on every zoom tick, not just at render.
 */
function updateValueLabels(root, k) {
  if (!root) return
  for (const el of root.querySelectorAll('.value-label')) {
    const boxW = Number(el.dataset.boxW) * k
    const boxH = Number(el.dataset.boxH) * k
    el.style.display = labelFits(el.textContent, boxW, boxH) ? '' : 'none'
    const x = el.getAttribute('x')
    const y = el.getAttribute('y')
    el.setAttribute('transform', `translate(${x} ${y}) scale(${1 / k}) translate(${-x} ${-y})`)
  }
}

function Legend({ mapData, schemeId, binned }) {
  const categorical = mapData.scale === 'categorical'
  const stops = getLegendStops(mapData, { schemeId, binned, bins: 6, steps: 6 })
  return (
    <div className="legend">
      {categorical ? (
        <div className="legend-bins">
          {stops.map((s, i) => (
            <div key={i} className="legend-bin">
              {s.color ? (
                <span className="legend-swatch" style={{ background: s.color }} />
              ) : (
                <span className="legend-swatch legend-swatch-more" />
              )}
              <span className="legend-bin-label">{s.value}</span>
            </div>
          ))}
        </div>
      ) : binned ? (
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
          <span>{formatValue(stops[0].value)}</span>
          <div className="legend-ramp">
            {stops.map((s, i) => (
              <div key={i} className="legend-swatch" style={{ background: s.color }} />
            ))}
          </div>
          <span>{formatValue(stops[stops.length - 1].value)}</span>
        </>
      )}
      <span className="legend-swatch-row">
        <span className="legend-swatch legend-swatch-nodata" />
        <span>no data</span>
      </span>
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
  companionView,
}) {
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  const zoomLayerElRef = useRef(null)
  const zoomBehaviorRef = useRef(null)
  const lastTransformRef = useRef(null)
  const [size, setSize] = useState({ width: 800, height: 400 })
  const [tooltip, setTooltip] = useState(null)
  const [hitAreas, setHitAreas] = useState([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      setSize({ width, height: Math.max(300, width * 0.5) })
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
          updateValueLabels(zoomLayerElRef.current, event.transform.k)
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
    updateValueLabels(wrapper, lastTransformRef.current?.k ?? 1)

    for (const hit of rendered.hitAreas) {
      hit.element.addEventListener('mouseenter', (e) => showTooltip(e, hit))
      hit.element.addEventListener('mousemove', (e) => showTooltip(e, hit))
      hit.element.addEventListener('mouseleave', hideTooltip)
    }

    setHitAreas(rendered.hitAreas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData, size, svgRef, regionId, showValues, schemeId, binned, displayMode])

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
