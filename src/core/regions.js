// Continent-level presets. Each region (other than "world") restricts which
// countries are drawn and asked about, so a regional question needs far fewer
// per-country answers than a global one (e.g. Oceania vs. all of Europe).

const EUROPE = [
  'ALB', 'AND', 'AUT', 'BLR', 'BEL', 'BIH', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK',
  'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ITA', 'LVA', 'LIE',
  'LTU', 'LUX', 'MLT', 'MDA', 'MCO', 'MNE', 'NLD', 'MKD', 'NOR', 'POL', 'PRT',
  'ROU', 'RUS', 'SMR', 'SRB', 'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'UKR', 'GBR',
  'VAT', 'GGY', 'JEY', 'IMN', 'FRO', 'GIB',
]

const NORTH_AMERICA = [
  'CAN', 'USA', 'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN', 'CUB',
  'JAM', 'HTI', 'DOM', 'BHS', 'BRB', 'ATG', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT',
  'TTO', 'BMU', 'GRL', 'PRI', 'VGB', 'VIR', 'CYM', 'TCA', 'AIA', 'MSR', 'ABW',
  'CUW', 'SXM', 'BES', 'GLP', 'MTQ',
]

const SOUTH_AMERICA = [
  'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY',
  'VEN', 'FLK', 'GUF',
]

const AFRICA = [
  'DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CPV', 'CMR', 'CAF', 'TCD', 'COM',
  'COD', 'COG', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'SWZ', 'ETH', 'GAB', 'GMB',
  'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG', 'MWI', 'MLI', 'MRT',
  'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP', 'SEN', 'SYC', 'SLE',
  'SOM', 'ZAF', 'SSD', 'SDN', 'TZA', 'TGO', 'TUN', 'UGA', 'ZMB', 'ZWE', 'ESH',
  'REU', 'MYT',
]

const OCEANIA = [
  'AUS', 'NZL', 'PNG', 'FJI', 'SLB', 'VUT', 'WSM', 'TON', 'KIR', 'FSM', 'MHL',
  'PLW', 'NRU', 'TUV', 'NCL', 'PYF', 'GUM', 'ASM', 'MNP', 'COK', 'NIU', 'TKL',
  'WLF',
]

const ASIA = [
  // East Asia
  'CHN', 'MNG', 'PRK', 'KOR', 'JPN', 'TWN', 'HKG', 'MAC',
  // Southeast Asia
  'MMR', 'THA', 'LAO', 'VNM', 'KHM', 'MYS', 'SGP', 'IDN', 'BRN', 'PHL', 'TLS',
  // South Asia
  'AFG', 'PAK', 'IND', 'NPL', 'BTN', 'BGD', 'LKA', 'MDV',
  // Central Asia
  'KAZ', 'UZB', 'TKM', 'TJK', 'KGZ',
  // West Asia / Middle East
  'TUR', 'GEO', 'ARM', 'AZE', 'SYR', 'LBN', 'ISR', 'PSE', 'JOR', 'IRQ', 'IRN',
  'SAU', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT',
]

// Geographic [[lonMin, latMin], [lonMax, latMax]] the camera fits to, used
// only where a region's own countries would otherwise badly skew an
// auto-fit. Everywhere else, fitting to the actual (filtered) features
// already frames the region well, so this is left null and render.js falls
// back to that.
//
// - Europe: Russia's far-east extent would dwarf the rest of the continent
//   if the projection fit to its actual shape.
// - Oceania: the opposite problem — a few far-flung Pacific micro-states
//   (French Polynesia, Cook Islands, etc.) sit far enough east that fitting
//   to their real extent zooms way out, shrinking Australia/NZ to a speck.
//
// IMPORTANT: d3-geo's spherical winding convention for an exterior ring is
// the *opposite* of planar GeoJSON — going lon0,lat0 -> lon0,lat1 -> lon1,lat1
// -> lon1,lat0 -> close (not the "counterclockwise in lon/lat" order you'd
// use for a flat polygon). Using the wrong winding makes d3 treat the box as
// covering the whole sphere instead of just this patch.
const EUROPE_BOUNDS = [[-25, 34], [45, 72]]
const OCEANIA_BOUNDS = [[110, -50], [180, 5]]

/** @type {Record<string, { id: string, label: string, iso3: string[] | null, bounds: [[number, number], [number, number]] | null }>} */
export const REGIONS = {
  world: { id: 'world', label: 'World', iso3: null, bounds: null },
  europe: { id: 'europe', label: 'Europe', iso3: EUROPE, bounds: EUROPE_BOUNDS },
  asia: { id: 'asia', label: 'Asia', iso3: ASIA, bounds: null },
  northAmerica: { id: 'northAmerica', label: 'North America', iso3: NORTH_AMERICA, bounds: null },
  southAmerica: { id: 'southAmerica', label: 'South America', iso3: SOUTH_AMERICA, bounds: null },
  africa: { id: 'africa', label: 'Africa', iso3: AFRICA, bounds: null },
  oceania: { id: 'oceania', label: 'Oceania', iso3: OCEANIA, bounds: OCEANIA_BOUNDS },
}

export const REGION_IDS = Object.keys(REGIONS)
