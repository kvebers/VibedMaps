import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js'
import { parseMapData } from '../schema.js'

const DEFAULT_MODEL = 'claude-opus-5'

// JSON Schema mirroring core/schema.js's zod shape, for output_config.format.
// `reasoning` is typed nullable-and-required (rather than simply omitted from
// `required`) so the same schema works whether or not strict structured
// outputs require every property to be present (see schema.js's `.nullish()`).
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
export function createAnthropicProvider(config) {
  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  })

  return {
    async generate(question, region, options = {}) {
      const response = await client.messages.create({
        model: config.model || DEFAULT_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(question, region, options) }],
        output_config: {
          format: { type: 'json_schema', schema: MAP_DATA_JSON_SCHEMA },
        },
      })

      if (response.stop_reason === 'refusal') {
        throw new Error('Anthropic declined to answer this question. Try rephrasing it.')
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock) {
        throw new Error('Anthropic response contained no text content.')
      }

      let raw
      try {
        raw = JSON.parse(textBlock.text)
      } catch {
        throw new Error('Anthropic returned malformed JSON.')
      }

      const parsed = parseMapData(raw)
      if (!parsed.success) {
        throw new Error(`Anthropic response failed validation: ${parsed.error}`)
      }
      return parsed.data
    },
  }
}
