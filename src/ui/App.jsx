import { useEffect, useRef, useState } from 'react'
import { Controls } from './Controls.jsx'
import { MapView } from './MapView.jsx'
import { generateMapData } from '../core/generate.js'
import { exportSvg, exportPng, exportJson, importJsonFile } from '../core/export.js'
import { sampleMapData } from '../core/sampleData.js'
import { buildShareUrl, readShareStateFromLocation } from '../core/share.js'
import { computeDiff } from '../core/diff.js'

const LAST_PROVIDER_KEY = 'vibes-maps:last-provider'
const apiKeyStorageKey = (providerId) => `vibes-maps:api-key:${providerId}`
const HISTORY_KEY = 'vibes-maps:history'
const HISTORY_LIMIT = 8

function loadInitialProvider() {
  return localStorage.getItem(LAST_PROVIDER_KEY) || 'anthropic'
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)))
}

function addToHistory(mapData) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: mapData.title,
    timestamp: new Date().toLocaleString(),
    mapData,
  }
  const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT)
  saveHistory(next)
  return next
}

export default function App() {
  const svgRef = useRef(null)
  // Read once, synchronously, at mount — not an effect, since this only ever
  // needs to seed initial state (reading location.hash has no reason to be
  // deferred to after paint, and doing so would mean calling setState from
  // inside an effect just to apply a one-time initial value).
  const [initialShared] = useState(() => readShareStateFromLocation())

  const [providerId, setProviderId] = useState(loadInitialProvider)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(apiKeyStorageKey(loadInitialProvider())) || '')
  const [model, setModel] = useState('')
  const [question, setQuestion] = useState('')
  const [regionId, setRegionId] = useState(initialShared?.regionId || 'world')
  const [showValues, setShowValues] = useState(false)
  const [sequentialSchemeId, setSequentialSchemeId] = useState(
    (initialShared?.mapData?.scale !== 'diverging' && initialShared?.schemeId) || 'ylgnbu',
  )
  const [divergingSchemeId, setDivergingSchemeId] = useState(
    (initialShared?.mapData?.scale === 'diverging' && initialShared?.schemeId) || 'rdbu',
  )
  const [binned, setBinned] = useState(initialShared?.binned ?? false)
  const [mode, setMode] = useState('quick')
  const [includeReasoning, setIncludeReasoning] = useState(false)
  const [displayMode, setDisplayMode] = useState(initialShared?.displayMode || 'choropleth')
  const [companionView, setCompanionView] = useState('none')
  const [mapData, setMapData] = useState(initialShared?.mapData || sampleMapData)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [pinnedIso3, setPinnedIso3] = useState(() => new Set())
  const [history, setHistory] = useState(loadHistory)
  const [compareMapData, setCompareMapData] = useState(null)
  const [compareLabel, setCompareLabel] = useState(null)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(t)
  }, [notice])

  function handleProviderChange(nextProviderId) {
    setProviderId(nextProviderId)
    setModel('')
    setApiKey(localStorage.getItem(apiKeyStorageKey(nextProviderId)) || '')
    localStorage.setItem(LAST_PROVIDER_KEY, nextProviderId)
  }

  function handleApiKeyChange(nextKey) {
    setApiKey(nextKey)
    if (nextKey) {
      localStorage.setItem(apiKeyStorageKey(providerId), nextKey)
    } else {
      localStorage.removeItem(apiKeyStorageKey(providerId))
    }
  }

  function resetForNewMap() {
    setPinnedIso3(new Set())
    setCompareMapData(null)
    setCompareLabel(null)
    setShowDiff(false)
  }

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    setProgress(mode === 'thorough' ? { done: 0, total: 1 } : null)
    try {
      const result = await generateMapData({
        providerId,
        apiKey,
        model,
        question,
        regionId,
        mode,
        includeReasoning,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setMapData(result)
      resetForNewMap()
      setHistory(addToHistory(result))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  function handleExportSvg() {
    if (svgRef.current) exportSvg(svgRef.current, `${slugify(mapData?.title)}.svg`)
  }

  async function handleExportPng() {
    if (svgRef.current) await exportPng(svgRef.current, `${slugify(mapData?.title)}.png`)
  }

  function handleExportJson() {
    if (mapData) exportJson(mapData, `${slugify(mapData.title)}.json`)
  }

  async function handleImportJsonFile(file) {
    setError(null)
    const result = await importJsonFile(file)
    if (result.success) {
      setMapData(result.data)
      resetForNewMap()
      setHistory(addToHistory(result.data))
    } else {
      setError(`Imported file failed validation: ${result.error}`)
    }
  }

  async function handleCompareImportFile(file) {
    setError(null)
    const result = await importJsonFile(file)
    if (result.success) {
      setCompareMapData(result.data)
      setCompareLabel(result.data.title)
      setShowDiff(false)
    } else {
      setError(`Comparison file failed validation: ${result.error}`)
    }
  }

  function handleClearCompare() {
    setCompareMapData(null)
    setCompareLabel(null)
    setShowDiff(false)
  }

  function handleToggleDiff(checked) {
    if (!checked) {
      setShowDiff(false)
      return
    }
    if (!mapData || !compareMapData) return
    const diff = computeDiff(mapData, compareMapData)
    if (diff.data.length === 0) {
      setError('No countries overlap between the current map and the comparison file.')
      return
    }
    setShowDiff(true)
  }

  function handleTogglePin(iso3) {
    setPinnedIso3((prev) => {
      const next = new Set(prev)
      if (next.has(iso3)) next.delete(iso3)
      else next.add(iso3)
      return next
    })
  }

  async function handleCopyShareLink() {
    if (!mapData) return
    const url = buildShareUrl({ mapData, regionId, displayMode, schemeId, binned })
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Share link copied to clipboard.')
    } catch {
      setError('Could not copy to clipboard. The link was generated but not copied.')
    }
  }

  function handleLoadHistory(id) {
    const entry = history.find((h) => h.id === id)
    if (!entry) return
    setMapData(entry.mapData)
    resetForNewMap()
  }

  const scaleType = mapData?.scale || 'sequential'
  const schemeId = scaleType === 'diverging' ? divergingSchemeId : sequentialSchemeId
  const handleSchemeChange =
    scaleType === 'diverging' ? setDivergingSchemeId : setSequentialSchemeId

  const displayedMapData = showDiff && compareMapData ? computeDiff(mapData, compareMapData) : mapData

  return (
    <div className="app">
      <header className="app-header">
        <h1>VibedMaps</h1>
        <p className="app-tagline">Ask a question. Get a colored world map. No backend, no accuracy guarantees pure vibes.</p>
      </header>

      <Controls
        question={question}
        onQuestionChange={setQuestion}
        providerId={providerId}
        onProviderChange={handleProviderChange}
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        model={model}
        onModelChange={setModel}
        regionId={regionId}
        onRegionChange={setRegionId}
        showValues={showValues}
        onShowValuesChange={setShowValues}
        scaleType={scaleType}
        schemeId={schemeId}
        onSchemeChange={handleSchemeChange}
        binned={binned}
        onBinnedChange={setBinned}
        mode={mode}
        onModeChange={setMode}
        includeReasoning={includeReasoning}
        onIncludeReasoningChange={setIncludeReasoning}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        companionView={companionView}
        onCompanionViewChange={setCompanionView}
        onGenerate={handleGenerate}
        loading={loading}
        progress={progress}
        canExport={Boolean(mapData)}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
        onCopyShareLink={handleCopyShareLink}
        history={history}
        onLoadHistory={handleLoadHistory}
        compareLabel={compareLabel}
        onCompareImportFile={handleCompareImportFile}
        onClearCompare={handleClearCompare}
        showDiff={showDiff}
        onToggleDiff={handleToggleDiff}
      />

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <MapView
        mapData={displayedMapData}
        svgRef={svgRef}
        regionId={regionId}
        showValues={showValues}
        schemeId={schemeId}
        binned={binned}
        displayMode={displayMode}
        pinnedIso3={pinnedIso3}
        onTogglePin={handleTogglePin}
        companionView={companionView}
      />
    </div>
  )
}

function slugify(title) {
  return (title || 'map')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
