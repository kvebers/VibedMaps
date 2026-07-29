import { z } from 'zod'

// ISO 3166-1 alpha-3 country codes, e.g. "USA", "BLR". Uppercase letters only.
const iso3Pattern = /^[A-Z]{3}$/

export const mapDataSchema = z.object({
  title: z.string().min(1).max(200),
  unit: z.string().min(1).max(60),
  scale: z.enum(['sequential', 'diverging']),
  data: z
    .array(
      z.object({
        iso3: z.string().regex(iso3Pattern, 'must be an ISO 3166-1 alpha-3 code, e.g. "USA"'),
        value: z.number().finite(),
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
