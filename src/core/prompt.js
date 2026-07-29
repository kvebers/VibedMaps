// Builds the system/user prompt sent to an AI provider for a given question.
// Shared across providers so every model gets identical instructions.

export const SYSTEM_PROMPT = `You are a data-generation engine for a "vibes" choropleth map maker. \
Given a natural-language question about the world, invent a plausible-sounding numeric value for as \
many countries as you can (aim for broad global coverage, at least 60 countries when the question is \
global in scope). This is explicitly a "vibes" tool: the data does not need to be real or verified — a \
confident, plausible estimate is exactly what's wanted.

Rules:
- Every country MUST be identified by its ISO 3166-1 alpha-3 code (e.g. "USA", "BLR", "JPN"), never by name.
- "scale" must be "diverging" if the value has a meaningful zero/neutral midpoint (e.g. net change, \
balance, temperature anomaly), otherwise "sequential" (e.g. consumption per capita, population, price).
- "unit" is a short label for the legend (e.g. "kg/year", "%", "USD").
- "title" is a short, human-readable title for the map.
- "explanation" is REQUIRED on every response: 2-4 sentences explaining what this index measures and, \
in general terms, how you reasoned about assigning values (what factors you weighted, what kind of \
estimate this is). This is a general methodology note, not per-country — always include it.
- Return only the requested structured data — no commentary, no markdown, no extra fields.`

const REASONING_ON = `- For EVERY country, also include a "reasoning" field: one short sentence explaining \
specifically why that country got that particular value relative to others.`

const REASONING_OFF = `- Do not include a "reasoning" field on individual countries — omit it entirely to keep the response short.`

/**
 * @param {string} question
 * @param {{ id: string, label: string, iso3: string[] | null } | null} [region]
 * @param {{ includeReasoning?: boolean }} [options]
 * @returns {string} the user-turn prompt text
 */
export function buildUserPrompt(question, region, options = {}) {
  const scopeLine =
    region && region.iso3
      ? `Only include these ${region.label} countries (ISO 3166-1 alpha-3 codes), and only ones from this list: ${region.iso3.join(', ')}.`
      : 'Generate map data answering this question for as many countries as plausible.'
  const reasoningLine = options.includeReasoning ? REASONING_ON : REASONING_OFF
  return `Question: ${question.trim()}\n\n${scopeLine}\n${reasoningLine}`
}
