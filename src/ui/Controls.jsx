import { useRef } from "react";
import { PROVIDER_IDS, GENERATION_MODES } from "../core/generate.js";
import { REGIONS, REGION_IDS } from "../core/regions.js";
import { schemesFor } from "../core/colorSchemes.js";
import { DISPLAY_MODES } from "../core/displayModes.js";

const PROVIDER_LABELS = {
  gemini: "Gemini",
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
};

const MODEL_PLACEHOLDERS = {
  gemini: "gemini-3.1-flash-lite (default)",
  anthropic: "claude-opus-5 (default)",
  openai: "gpt-4o (default)",
};

const MODE_LABELS = {
  quick: "Quick (1 prompt)",
  thorough: "Thorough (batched, more countries)",
};

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
  displayMode,
  onDisplayModeChange,
  companionView,
  onCompanionViewChange,
  onGenerate,
  loading,
  progress,
  canExport,
  onExportSvg,
  onExportPng,
  onExportJson,
  onImportJsonFile,
  includeReasoning,
  onIncludeReasoningChange,
  onCopyShareLink,
  history,
  onLoadHistory,
  compareLabel,
  onCompareImportFile,
  onClearCompare,
  showDiff,
  onToggleDiff,
}) {
  const fileInputRef = useRef(null);
  const compareInputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    onGenerate();
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onImportJsonFile(file);
    e.target.value = "";
  }

  function handleCompareImportClick() {
    compareInputRef.current?.click();
  }

  function handleCompareFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onCompareImportFile(file);
    e.target.value = "";
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
          <select
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
          >
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

        <label className="field">
          <span>Display</span>
          <select value={displayMode} onChange={(e) => onDisplayModeChange(e.target.value)}>
            {DISPLAY_MODES.map((m) => (
              <option key={m.id} value={m.id} title={m.description}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls-row">
        <label className="field">
          <span>Provider</span>
          <select
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
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
          <select
            value={schemeId}
            onChange={(e) => onSchemeChange(e.target.value)}
          >
            {schemesFor(scaleType).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.colorblindSafe ? " ✓ colorblind-safe" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls-row controls-actions">
        <button type="submit" disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </button>

        {loading && progress && (
          <span className="progress-indicator">
            Batch {Math.min(progress.done + 1, progress.total)} of{" "}
            {progress.total}
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

        <label className="checkbox-field" title="Ask the AI to explain its reasoning for each country's score. Costs more (longer response) since it's extra text per country.">
          <input
            type="checkbox"
            checked={includeReasoning}
            onChange={(e) => onIncludeReasoningChange(e.target.checked)}
          />
          <span>AI reasoning (costs more)</span>
        </label>

        <label className="field field-inline">
          <span>View</span>
          <select value={companionView} onChange={(e) => onCompanionViewChange(e.target.value)}>
            <option value="none">Map only</option>
            <option value="ranked">+ Ranked list</option>
            <option value="table">+ Data table</option>
          </select>
        </label>

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

        {compareLabel ? (
          <>
            <span className="compare-label">Comparing: {compareLabel}</span>
            <label className="checkbox-field">
              <input type="checkbox" checked={showDiff} onChange={(e) => onToggleDiff(e.target.checked)} />
              <span>Show diff</span>
            </label>
            <button type="button" onClick={onClearCompare}>
              Clear
            </button>
          </>
        ) : (
          <button type="button" onClick={handleCompareImportClick}>
            Import JSON to compare
          </button>
        )}
        <input
          ref={compareInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleCompareFileChange}
        />

        <button type="button" onClick={onCopyShareLink} disabled={!canExport}>
          Copy share link
        </button>

        {history && history.length > 0 && (
          <label className="field field-inline">
            <span>History</span>
            <select defaultValue="" onChange={(e) => e.target.value && onLoadHistory(e.target.value)}>
              <option value="" disabled>
                {history.length} saved…
              </option>
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} — {h.timestamp}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </form>
  );
}
