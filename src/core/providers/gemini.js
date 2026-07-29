import { GoogleGenAI } from '@google/genai'
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js'
import { parseMapData } from '../schema.js'

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

// JSON Schema mirroring core/schema.js's zod shape, for response_format.schema.
const MAP_DATA_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    unit: { type: 'string' },
    scale: { type: 'string', enum: ['sequential', 'diverging'] },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso3: { type: 'string', pattern: '^[A-Z]{3}$' },
          value: { type: 'number' },
        },
        required: ['iso3', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'unit', 'scale', 'data'],
  additionalProperties: false,
}

/**
 * @param {import('./types').ProviderConfig} config
 * @returns {import('./types').Provider}
 */
export function createGeminiProvider(config) {
  const client = new GoogleGenAI({ apiKey: config.apiKey })

  return {
    async generate(question, region) {
      const interaction = await client.interactions.create({
        model: config.model || DEFAULT_MODEL,
        input: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(question, region)}`,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: MAP_DATA_JSON_SCHEMA,
        },
      })

      const text = interaction.output_text
      if (!text) {
        throw new Error('Gemini response contained no content.')
      }

      let raw
      try {
        raw = JSON.parse(text)
      } catch {
        throw new Error('Gemini returned malformed JSON.')
      }

      const parsed = parseMapData(raw)
      if (!parsed.success) {
        throw new Error(`Gemini response failed validation: ${parsed.error}`)
      }
      return parsed.data
    },
  }
}
