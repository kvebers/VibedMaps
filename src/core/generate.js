import { createAnthropicProvider } from './providers/anthropic.js'
import { createOpenAIProvider } from './providers/openai.js'
import { createGeminiProvider } from './providers/gemini.js'
import { REGIONS } from './regions.js'
import { ISO3_TO_NUMERIC } from './isoNumeric.js'

const PROVIDER_FACTORIES = {
  anthropic: createAnthropicProvider,
  openai: createOpenAIProvider,
  gemini: createGeminiProvider,
}

export const PROVIDER_IDS = Object.keys(PROVIDER_FACTORIES)

export const GENERATION_MODES = ['quick', 'thorough']

const ALL_ISO3 = Object.keys(ISO3_TO_NUMERIC)
const CHUNK_SIZE = 25

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
  return chunks
}

/**
 * Splits a region's country list into request-sized batches. "World" has no
 * fixed list (the AI picks freely), so it's chunked from the full ISO3 set.
 * @param {{ label: string, iso3: string[] | null }} region
 * @returns {Array<{ label: string, iso3: string[] }>}
 */
function chunkRegion(region) {
  const iso3List = region.iso3 || ALL_ISO3
  return chunk(iso3List, CHUNK_SIZE).map((iso3) => ({ label: region.label, iso3 }))
}

/**
 * Orchestrates: question -> provider -> validated MapData.
 *
 * "quick" mode makes a single request and lets the AI decide how much
 * ground to cover. "thorough" mode splits the region's countries into
 * batches and makes one request per batch, merging the results — more
 * requests and cost, but far less likely to skip countries, especially for
 * large regions (World, Europe, Africa) where a single prompt tends to
 * undercount.
 *
 * @param {{ providerId: 'anthropic' | 'openai' | 'gemini', apiKey: string, model?: string, question: string, regionId?: string, mode?: 'quick' | 'thorough', includeReasoning?: boolean, onProgress?: (done: number, total: number) => void }} args
 * @returns {Promise<import('./schema').MapData>}
 */
export async function generateMapData({
  providerId,
  apiKey,
  model,
  question,
  regionId,
  mode = 'quick',
  includeReasoning = false,
  onProgress,
}) {
  if (!apiKey?.trim()) {
    throw new Error('An API key is required.')
  }
  if (!question?.trim()) {
    throw new Error('A question is required.')
  }
  const factory = PROVIDER_FACTORIES[providerId]
  if (!factory) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  const provider = factory({ apiKey: apiKey.trim(), model: model?.trim() })
  const region = REGIONS[regionId] || REGIONS.world
  const trimmedQuestion = question.trim()
  const options = { includeReasoning }

  if (mode !== 'thorough') {
    return provider.generate(trimmedQuestion, region, options)
  }

  const batches = chunkRegion(region)
  let result = null
  const seen = new Set()

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i, batches.length)
    const batchResult = await provider.generate(trimmedQuestion, batches[i], options)
    if (!result) {
      result = batchResult
      seen.clear()
      for (const d of result.data) seen.add(d.iso3)
    } else {
      for (const d of batchResult.data) {
        if (!seen.has(d.iso3)) {
          seen.add(d.iso3)
          result.data.push(d)
        }
      }
    }
  }
  onProgress?.(batches.length, batches.length)
  return result
}
