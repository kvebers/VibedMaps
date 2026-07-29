# Vibes Maps

Turn a natural-language question into a colored world map. Type a question
like *"which country eats the most potatoes"*, pick an AI provider, paste your
own API key, and get a choropleth map — entirely in your browser.

**This is a "vibes" tool.** The AI guesses plausible-sounding numbers per
country; nothing is fact-checked or sourced. Every generated map is labeled
"AI-generated, not real data" for exactly this reason. Don't use it for
anything that needs to be accurate.

## How it works

The AI is only ever asked for structured JSON data — `{ iso3, value }` pairs
per country, validated against a schema — never for the picture itself.
Rendering the choropleth (projection, color scale, legend, labels) is
deterministic code using D3. The model can't draw a bad map; it can only
supply bad numbers.

## Setup

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/, deployable anywhere (GitHub Pages, Netlify, ...)
```

No environment variables, no backend, no build-time secrets — the entire app
is static and runs client-side.

## Bringing your own API key

Pick a provider in the UI (Anthropic, OpenAI, or Gemini), paste an API key
you've created with that provider, and click **Generate**. The key:

- is kept only in React state and (optionally) `localStorage` in your own
  browser, per provider
- is sent **only** to that provider's own API, directly from your browser —
  never to any server this project controls (there is no server)
- can be cleared any time by clearing the field or your browser's site data

You can optionally override the default model per provider in the "Model"
field.

## Regions

By default the map covers the whole world. The **Region** dropdown scopes
both the map view and the AI prompt to a continent (Europe, Asia, North
America, South America, Africa, Oceania) — useful for questions that only
make sense within a region, and cheaper since the AI only has to answer for
that region's countries instead of the whole world.

## Generation mode

- **Quick** — one prompt, and the AI decides how many countries to answer
  for. Fast and cheap, but large regions (World, Europe, Africa) often come
  back with partial coverage.
- **Thorough** — splits the region's countries into batches of ~25 and makes
  one request per batch, merging the results. Far more complete coverage at
  the cost of more requests (and more spend on your API key). A progress
  indicator ("Batch 2 of 8") shows while this runs.

## Display options

- **Export SVG / PNG** — save the rendered map as an image.
- **Export JSON / Import JSON** — save or reload the underlying `{ title,
  unit, scale, data }` map data, so you can share a result or re-render it
  later without another API call.
- **Show values** — toggle numeric value labels on top of each colored
  country.
- **Color scheme** — pick from a few d3-scale-chromatic ramps, separately for
  sequential and diverging questions.
- **Binned colors** — switch from a continuous gradient to 6 discrete
  quantile buckets, the more common choropleth convention.

## Project structure

```
src/
  core/       # framework-agnostic: schema, prompt building, providers,
              # generation orchestration, D3 rendering, export — no React
  ui/         # React components (App, Controls, MapView)
```

`src/core` has no React imports, so it can be reused outside this UI (a CLI,
a different frontend, etc.).

## License

Apache-2.0 license — see [LICENSE](./LICENSE).
