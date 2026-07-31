import OpenAI from 'openai'
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js'
import { parseMapData } from '../schema.js'

const DEFAULT_MODEL = 'gpt-4o'

// JSON Schema mirroring core/schema.js's zod shape, for Structured Outputs.
// OpenAI's `strict: true` mode requires every property to be listed in
// `required` — there's no true "optional" key, so `reasoning` is modeled as
// nullable instead (the model returns null rather than omitting it).
const MAP_DATA_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    unit: { type: 'string' },
    scale: { type: 'string', enum: ['sequential', 'diverging', 'categorical'] },
    explanation: { type: 'string' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso3: { type: 'string', pattern: '^[A-Z]{3}$' },
          value: { type: ['number', 'string'] },
          reasoning: { type: ['string', 'null'] },
        },
        required: ['iso3', 'value', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'unit', 'scale', 'explanation', 'data'],
  additionalProperties: false,
}

/**
 * @param {import('./types').ProviderConfig} config
 * @returns {import('./types').Provider}
 */
export function createOpenAIProvider(config) {
  const client = new OpenAI({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  })

  return {
    async generate(question, region, options = {}) {
      const completion = await client.chat.completions.create({
        model: config.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(question, region, options) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'map_data',
            schema: MAP_DATA_JSON_SCHEMA,
            strict: true,
          },
        },
      })

      const choice = completion.choices[0]
      if (choice?.finish_reason === 'content_filter') {
        throw new Error('OpenAI declined to answer this question. Try rephrasing it.')
      }

      const text = choice?.message?.content
      if (!text) {
        throw new Error('OpenAI response contained no content.')
      }

      let raw
      try {
        raw = JSON.parse(text)
      } catch {
        throw new Error('OpenAI returned malformed JSON.')
      }

      const parsed = parseMapData(raw)
      if (!parsed.success) {
        throw new Error(`OpenAI response failed validation: ${parsed.error}`)
      }
      return parsed.data
    },
  }
}
