import { useState } from "react";
import { REGIONS, REGION_IDS } from "../core/regions.js";
import { PROVIDER_IDS, GENERATION_MODES } from "../core/generate.js";

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

export function GenerationOptions({
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
  mode,
  onModeChange,
  includeReasoning,
  onIncludeReasoningChange,
  onGenerate,
  loading,
  progress,
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onGenerate();
  }

  return (
    <form className="controls generation-options" onSubmit={handleSubmit}>
      <p className="panel-label">Generate a map</p>
      <div className="controls-row prompt-row">
        <div className="prompt-box">
          <label className="prompt-box-label" htmlFor="prompt-textarea">
            What do you want to see on the map?
          </label>
          <textarea
            id="prompt-textarea"
            className="prompt-textarea"
            placeholder="e.g. which country eats the most potatoes"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            rows={2}
          />
          <div className="prompt-box-actions controls-actions">
            <div className="prompt-box-actions-left">
              <label className="checkbox-field" title="Ask the AI to explain its reasoning for each country's score. Costs more (longer response) since it's extra text per country.">
                <input
                  type="checkbox"
                  checked={includeReasoning}
                  onChange={(e) => onIncludeReasoningChange(e.target.checked)}
                />
                <span>AI reasoning (costs more)</span>
              </label>

              <button type="submit" className="prompt-generate-btn" disabled={loading}>
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>

            {loading && progress && (
              <span className="progress-indicator">
                Batch {Math.min(progress.done + 1, progress.total)} of{" "}
                {progress.total}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="controls-row">
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

        {apiKeyOpen ? (
          <label className="field field-grow">
            <span>API key</span>
            <div className="api-key-input-wrap">
              <input
                type={showApiKey ? "text" : "password"}
                placeholder="sk-... (stored only in this browser)"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="api-key-toggle"
                onClick={() => setShowApiKey((v) => !v)}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="api-key-toggle"
                onClick={() => setApiKeyOpen(false)}
              >
                Done
              </button>
            </div>
          </label>
        ) : (
          <button
            type="button"
            className="api-key-disclosure"
            onClick={() => setApiKeyOpen(true)}
          >
            {apiKey ? "API key set: change" : "+ Add API key"}
          </button>
        )}
      </div>
    </form>
  );
}
