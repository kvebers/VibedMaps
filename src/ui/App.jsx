import { useRef, useState } from 'react'
import { Controls } from './Controls.jsx'
import { MapView } from './MapView.jsx'
import { generateMapData } from '../core/generate.js'
import { exportSvg, exportPng, exportJson, importJsonFile } from '../core/export.js'
import { sampleMapData } from '../core/sampleData.js'

const LAST_PROVIDER_KEY = 'vibes-maps:last-provider'
const apiKeyStorageKey = (providerId) => `vibes-maps:api-key:${providerId}`

function loadInitialProvider() {
  return localStorage.getItem(LAST_PROVIDER_KEY) || 'anthropic'
}

export default function App() {
  const svgRef = useRef(null)
  const [providerId, setProviderId] = useState(loadInitialProvider)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(apiKeyStorageKey(loadInitialProvider())) || '')
  const [model, setModel] = useState('')
  const [question, setQuestion] = useState('')
  const [regionId, setRegionId] = useState('world')
  const [showValues, setShowValues] = useState(false)
  const [sequentialSchemeId, setSequentialSchemeId] = useState('ylgnbu')
  const [divergingSchemeId, setDivergingSchemeId] = useState('rdbu')
  const [binned, setBinned] = useState(false)
  const [mode, setMode] = useState('quick')
  const [mapData, setMapData] = useState(sampleMapData)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

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
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setMapData(result)
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
    } else {
      setError(`Imported file failed validation: ${result.error}`)
    }
  }

  const scaleType = mapData?.scale || 'sequential'
  const schemeId = scaleType === 'diverging' ? divergingSchemeId : sequentialSchemeId
  const handleSchemeChange =
    scaleType === 'diverging' ? setDivergingSchemeId : setSequentialSchemeId

  return (
    <div className="app">
      <header className="app-header">
        <h1>Vibe Maps</h1>
        <p className="app-tagline">Ask a question. Get a colored world map. No backend, no accuracy guarantees.</p>
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
        onGenerate={handleGenerate}
        loading={loading}
        progress={progress}
        canExport={Boolean(mapData)}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
      />

      {error && <div className="error-banner">{error}</div>}

      <MapView
        mapData={mapData}
        svgRef={svgRef}
        regionId={regionId}
        showValues={showValues}
        schemeId={schemeId}
        binned={binned}
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
