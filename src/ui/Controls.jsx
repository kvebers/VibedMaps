import { useRef } from 'react'
import { PROVIDER_IDS, GENERATION_MODES } from '../core/generate.js'
import { REGIONS, REGION_IDS } from '../core/regions.js'
import { schemesFor } from '../core/colorSchemes.js'

const PROVIDER_LABELS = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Gemini',
}

const MODEL_PLACEHOLDERS = {
  anthropic: 'claude-opus-5 (default)',
  openai: 'gpt-4o (default)',
  gemini: 'gemini-3.1-flash-lite (default)',
}

const MODE_LABELS = {
  quick: 'Quick (1 prompt)',
  thorough: 'Thorough (batched, more countries)',
}

export function Controls({
  question,
  onQuestionChange,
  providerId,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
  regionId,
  onRegionChange,
  showValues,
  onShowValuesChange,
  scaleType,
  schemeId,
  onSchemeChange,
  binned,
  onBinnedChange,
  mode,
  onModeChange,
  onGenerate,
  loading,
  progress,
  canExport,
  onExportSvg,
  onExportPng,
  onExportJson,
  onImportJsonFile,
}) {
  const fileInputRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    onGenerate()
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) onImportJsonFile(file)
    e.target.value = ''
  }

  return (
    <form className="controls" onSubmit={handleSubmit}>
      <div className="controls-row">
        <label className="field field-grow">
          <span>Question</span>
          <input
            type="text"
            placeholder="e.g. which country eats the most potatoes"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Region</span>
          <select value={regionId} onChange={(e) => onRegionChange(e.target.value)}>
            {REGION_IDS.map((id) => (
              <option key={id} value={id}>
                {REGIONS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Generation mode</span>
          <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
            {GENERATION_MODES.map((id) => (
              <option key={id} value={id}>
                {MODE_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls-row">
        <label className="field">
          <span>Provider</span>
          <select value={providerId} onChange={(e) => onProviderChange(e.target.value)}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Model (optional)</span>
          <input
            type="text"
            placeholder={MODEL_PLACEHOLDERS[providerId]}
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          />
        </label>

        <label className="field field-grow">
          <span>API key</span>
          <input
            type="password"
            placeholder="sk-... (stored only in this browser)"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Color scheme</span>
          <select value={schemeId} onChange={(e) => onSchemeChange(e.target.value)}>
            {schemesFor(scaleType).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls-row controls-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {loading && progress && (
          <span className="progress-indicator">
            Batch {Math.min(progress.done + 1, progress.total)} of {progress.total}
          </span>
        )}

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => onShowValuesChange(e.target.checked)}
          />
          <span>Show values</span>
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={binned}
            onChange={(e) => onBinnedChange(e.target.checked)}
          />
          <span>Binned colors</span>
        </label>

        <span className="controls-spacer" />

        <button type="button" disabled={!canExport} onClick={onExportSvg}>
          Export SVG
        </button>
        <button type="button" disabled={!canExport} onClick={onExportPng}>
          Export PNG
        </button>
        <button type="button" disabled={!canExport} onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" onClick={handleImportClick}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </form>
  )
}
