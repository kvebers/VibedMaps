/** @type {Array<{ id: string, label: string, description: string }>} */
export const DISPLAY_MODES = [
  { id: 'choropleth', label: 'Choropleth', description: 'Each country filled by color' },
  { id: 'bubble', label: 'Bubble', description: 'A circle per country, sized by value' },
  { id: 'cartogram', label: 'Cartogram', description: 'Circles sized by value, spread apart to avoid overlap' },
  { id: 'hexbin', label: 'Hex grid', description: 'Equal-size hex tiles — removes country-size bias entirely' },
]

export const DISPLAY_MODE_IDS = DISPLAY_MODES.map((m) => m.id)
