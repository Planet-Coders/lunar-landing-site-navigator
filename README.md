# LuminaLuna — Lunar Landing Site Navigator

LuminaLuna compares lunar Sun/Earth geometry using the [NASA JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/). It supports NASA LOLA reference points and arbitrary lunar coordinates. It does not assess landing safety, electrical power, or radio-link performance.

Pick two sites and a date range, set a horizon mask, and the app charts Sun and Earth elevation for both sites and compares their power and communications windows in a table. Every site is also plotted on an interactive 3D map of the south pole.

## Features

- **Site evaluation:** For each site, the app queries JPL Horizons for the Sun and Earth as seen from the site's coordinates and altitude (`CENTER = coord@301`, geodetic). It reports:
  - **Power:** Sun elevation and whether the site is in daylight.
  - **Comm:** Earth elevation and whether there is line-of-sight or the Earth is occulted.
  - **Windows:** upcoming sunset and earthset.
- **Top bar:** Site A and Site B dropdowns, a date range (UT) with a step size from 1 h to 1 d, and a horizon mask slider from 0° to 10°. Changing a site or the dates re-evaluates automatically.
- **Horizon mask:** the Sun or Earth only counts as visible above the mask elevation. Moving the slider updates the charts and table instantly without new Horizons queries.
- **Sun & Earth elevation charts:** both sites on one chart per body, with the 0° line and the mask line. Hovering shows the values at that time on both charts.
- **Power & Comms window comparison table:** time sunlit, longest sunlit window, longest dark period, first sunset, time Earth visible, longest comms blackout, first Earthset, and time both sunlit and Earth visible. A check marks the better site on each row. Crossing times are interpolated between samples, so windows are not rounded to the step size.
- **Lunar South Pole Map:** a React Three Fiber globe, oriented with the south pole up.
  - Pins for every landing site. Site A and Site B are highlighted.
  - Clicking a pin assigns that site to the chosen slot (*Click sets Site A / Site B*).
  - The surface uses locally bundled NASA LRO/LROC color and LOLA elevation maps, with source checksums. Lighting is illustrative; these display maps are not used for local visibility calculations.
  - Drag to rotate, scroll to zoom.
- **Geometric Visibility Only:** a footer reminds users that terrain shadowing and the size of the Sun and Earth discs are not modelled.

### Candidate sites

The preset catalog contains center-pixel reference points from 13 NASA GSFC regional LOLA DEMs. These are **not official NASA-selected landing coordinates**. Each point's name, source grid cell, height and provenance are in [`data/sites.json`](data/sites.json). The former uncited catalog and LCROSS impact claim have been removed.

Arbitrary coordinates are supported by the API: send `siteId=custom` with a latitude (-90 to 90°) and east-positive longitude (-180 to 360°). The main page's Site A/B dropdowns currently list only the 13 presets; the earlier comparison view (`ComparisonView.tsx`, not on the page) still has a Custom coordinates picker. Heights are sampled from the global LOLA grid at **0.25° spacing (~7.6 km north–south)**. This is a coarse estimate; small obstructions, local slopes, terrain shadows and landing hazards are not resolved. The regional presets use finer 5 m grids, which themselves include interpolation and measurement uncertainty.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [three.js](https://threejs.org/), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) and [@react-three/drei](https://github.com/pmndrs/drei)
- Tailwind CSS, lucide-react icons

## Getting started

Requires Node.js 18.17 or later (developed on Node 22).

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

No API keys are needed, because JPL Horizons is a public API. The app needs internet access to reach `ssd.jpl.nasa.gov`.

| Script          | What it does                    |
| --------------- | ------------------------------- |
| `npm run dev`   | Start the dev server            |
| `npm run build` | Production build                |
| `npm start`     | Serve the production build      |
| `npm run lint`  | Run ESLint (`next lint`)        |
| `npm test`      | Run the offline unit tests      |

## API

`GET` or `POST /api/evaluations` evaluates one site over a time range.

| Field       | Required | Example                                 |
| ----------- | -------- | --------------------------------------- |
| `siteId`    | yes      | `shackleton-rim` (see `lib/sites.ts`)   |
| `location` | for `siteId=custom` | POST: `{"latitude":10,"longitude":20}`; GET: `latitude=10&longitude=20` |
| `startTime` | yes      | `2026-11-07 00:00`                      |
| `stopTime`  | yes      | `2026-11-21 00:00`                      |
| `stepSize`  | no       | `2 h` (default)                         |

```bash
curl "http://localhost:3000/api/evaluations?siteId=shackleton-rim&startTime=2026-11-07%2000:00&stopTime=2026-11-08%2000:00&stepSize=1%20h"
```

Upstream exports are cached for 6 hours per server process, retaining original retrieval timestamps. Requests to Horizons are sent one at a time. Responses include source URLs, API version, lunar reference model, original retrieval timestamps and SHA-256 hashes. Malformed data, missing required angles and misaligned time series are rejected rather than filled with demo values.

Horizons is called with Node's built-in `fetch` (the `undici` dependency was removed), with a 30 s timeout per request. The route allows up to 60 s (`maxDuration = 60`) on hosts such as Vercel.

## Deployment

The app deploys to Vercel as a standard Next.js project with no environment variables. Run `npm run build` locally first to catch errors.

**Known issue:** on the live Vercel deployment, `/api/evaluations` currently returns **502 "fetch failed"** when the server calls JPL Horizons, so the charts and table stay empty there. It works locally. The cause has not been fixed yet; see [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md#known-issues) for details and what to check.

## Project structure

```
app/
  page.tsx                  Main page
  actions.ts                Server action wrapping site evaluation
  api/evaluations/route.ts  REST endpoint
components/
  NavigatorView.tsx         Main layout: top bar, map, charts, table
  ElevationChart.tsx        Sun / Earth elevation chart (SVG)
  WindowComparisonTable.tsx Power & Comms window comparison table
  LunarGlobe.tsx            Interactive Lunar South Pole Map (R3F globe + pins)
  ComparisonView.tsx, ScenarioPane.tsx, Lunar3DCanvas.tsx, TelemetryHUD.tsx,
  TimelineScrubber.tsx      Earlier comparison view, kept but not on the page
lib/
  jpl-horizons.ts           Horizons query builder, parser, evaluator
  moon-surface.ts           Lunar reference sphere and coordinate conversion
  custom-location.ts       Global LOLA height lookup for custom coordinates
  ephemeris.ts              Az/El and RA/Dec maths, formatting helpers
  windows.ts                Horizon-mask window maths (sunlit / Earth-visible %, longest gaps)
  sites.ts                  Candidate landing sites (loads data/sites.json)
  dates.ts, types.ts        Date parsing and shared types
data/                       NASA reference points, global LOLA heights, map checksums
public/data/                Globe colour and height textures
scripts/refresh-nasa-data.py  Regenerates the NASA-derived data files
tests/                      Offline tests with archived Horizons responses
docs/DOCUMENTATION.md       Full project documentation
```

## Recent changes

- Fixed the horizon view, which had North and South swapped, plus small fixes (missing-data deltas, out-of-date results notice, control labels). See PR #2.
- Rebuilt the main page to match the project wireframe: Site A/B, date range and horizon mask across the top, the south pole map on the left, Sun and Earth elevation charts and the Power & Comms comparison table on the right, and a Geometric Visibility Only footer.
- Replaced the uncited site catalog with NASA GSFC LOLA reference points, bundled NASA LRO/LOLA globe maps, and added custom coordinates to the API (PR #3).
- Removed `undici` in favour of native `fetch` to fix a missing-module build error on Vercel, and raised the API route timeout to 60 s.

## Documentation and data sources

See [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) for architecture, features, setup, deployment and known issues, and [DATA_SOURCES.md](DATA_SOURCES.md) for datasets, coordinate/height conventions, limitations, refresh instructions and validation. Run `npm test`, `npm run lint` and `npm run build` to validate the code. Tests include archived real NASA Horizons responses; no NASA network access is needed for the unit suite.

## AI assistance

This project was built with help from several AI tools, each used for a different part of the work:

| Tool | Made by | Used for |
| --- | --- | --- |
| Gemini | Google | Research |
| Cursor | Anysphere | Base coding |
| Claude (Claude Code) | Anthropic | Enhancement: reviewed the codebase and suggested enhancements, fixed the horizon-view bug, built the wireframe layout (charts, comparison table, horizon mask), and drafted this README and the project documentation |
| Codex | OpenAI | Data |

A person reviewed and tested every change before it was merged.
