import { useRef } from "react";
import { schemesFor } from "../core/colorSchemes.js";
import { DISPLAY_MODES } from "../core/displayModes.js";

export function MapCustomization({
  showValues,
  onShowValuesChange,
  scaleType,
  schemeId,
  onSchemeChange,
  binned,
  onBinnedChange,
  displayMode,
  onDisplayModeChange,
  companionView,
  onCompanionViewChange,
  canExport,
  onExportSvg,
  onExportPng,
  onExportJson,
  onImportJsonFile,
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

  function handleExportSelect(e) {
    const format = e.target.value;
    if (format === "svg") onExportSvg();
    else if (format === "png") onExportPng();
    else if (format === "json") onExportJson();
    e.target.value = "";
  }

  return (
    <div className="controls map-customization map-toolbar">
      <div className="controls-row">
        <span className="toolbar-brand">VibedMaps</span>

        <label className="field" title="Display mode">
          <select value={displayMode} onChange={(e) => onDisplayModeChange(e.target.value)}>
            {DISPLAY_MODES.map((m) => (
              <option key={m.id} value={m.id} title={m.description}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" title="Color scheme (✓ = colorblind-safe)">
          <select
            value={schemeId}
            onChange={(e) => onSchemeChange(e.target.value)}
          >
            {schemesFor(scaleType).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.colorblindSafe ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox-field" title="Show values">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => onShowValuesChange(e.target.checked)}
          />
          <span>#</span>
        </label>

        <label className="checkbox-field" title="Binned colors">
          <input
            type="checkbox"
            checked={binned}
            onChange={(e) => onBinnedChange(e.target.checked)}
          />
          <span>▤</span>
        </label>

        <label className="field field-inline" title="Companion view">
          <select value={companionView} onChange={(e) => onCompanionViewChange(e.target.value)}>
            <option value="none">Map only</option>
            <option value="ranked">+ Ranked list</option>
            <option value="table">+ Data table</option>
          </select>
        </label>

        <select
          className="icon-select"
          value=""
          disabled={!canExport}
          onChange={handleExportSelect}
          title="Export map"
        >
          <option value="" disabled>
            ⬇ Export
          </option>
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
          <option value="json">JSON</option>
        </select>

        <button type="button" className="icon-btn" onClick={handleImportClick} title="Import JSON" aria-label="Import JSON">
          ⬆
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
            <span className="compare-label" title={`Comparing: ${compareLabel}`}>⇄ {compareLabel}</span>
            <label className="checkbox-field" title="Show diff">
              <input type="checkbox" checked={showDiff} onChange={(e) => onToggleDiff(e.target.checked)} />
              <span>Δ</span>
            </label>
            <button type="button" className="icon-btn" onClick={onClearCompare} title="Clear comparison" aria-label="Clear comparison">
              ✕
            </button>
          </>
        ) : (
          <button type="button" className="icon-btn" onClick={handleCompareImportClick} title="Import JSON to compare" aria-label="Import JSON to compare">
            ⇄
          </button>
        )}
        <input
          ref={compareInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleCompareFileChange}
        />

        <button type="button" className="icon-btn" onClick={onCopyShareLink} disabled={!canExport} title="Copy share link" aria-label="Copy share link">
          🔗
        </button>

        {history && history.length > 0 && (
          <label className="field field-inline" title="History">
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
    </div>
  );
}
