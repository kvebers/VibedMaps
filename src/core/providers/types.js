/**
 * @typedef {Object} ProviderConfig
 * @property {string} apiKey
 * @property {string} [model]
 */

/**
 * @typedef {Object} Provider
 * @property {(question: string) => Promise<import('../schema').MapData>} generate
 */
