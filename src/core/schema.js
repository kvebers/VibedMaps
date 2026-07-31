import { z } from 'zod'

// ISO 3166-1 alpha-3 country codes, e.g. "USA", "BLR". Uppercase letters only.
const iso3Pattern = /^[A-Z]{3}$/

export const mapDataSchema = z.object({
  title: z.string().min(1).max(200),
  unit: z.string().min(1).max(60),
  // "categorical" is for word/label answers (e.g. "what does each country
  // call X") rather than a numeric measurement — countries sharing the same
  // value are colored the same instead of being placed on a color ramp.
  scale: z.enum(['sequential', 'diverging', 'categorical']),
  // What the index measures and how it was reasoned about in general — always
  // required, independent of the per-country `reasoning` field below (which is
  // optional and only populated when the user opts into the pricier
  // per-country reasoning mode).
  explanation: z.string().min(1).max(2000),
  data: z
    .array(
      z.object({
        iso3: z.string().regex(iso3Pattern, 'must be an ISO 3166-1 alpha-3 code, e.g. "USA"'),
        // A number for sequential/diverging maps, or a short label string for
        // categorical ones.
        value: z.union([z.number().finite(), z.string().min(1).max(100)]),
        // Nullish (not just optional): providers using strict JSON-schema
        // structured outputs (e.g. OpenAI) require every property to be
        // present and represent "omitted" as an explicit null.
        reasoning: z.string().min(1).max(500).nullish(),
      }),
    )
    .min(1)
    .max(300),
})

/**
 * Validates a raw AI response against the map data contract.
 * @param {unknown} raw
 * @returns {{ success: true, data: import('./schema').MapData } | { success: false, error: string }}
 */
export function parseMapData(raw) {
  const result = mapDataSchema.safeParse(raw)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
}
