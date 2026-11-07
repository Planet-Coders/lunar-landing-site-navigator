# LuminaLuna — Lunar Landing Site Navigator

LuminaLuna compares lunar Sun/Earth geometry using the [NASA JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/). It supports NASA LOLA reference points and arbitrary lunar coordinates. It does not assess landing safety, electrical power, or radio-link performance.

You can compare two sites side by side, or one site on two dates. You can scrub through the ephemeris timeline and see the Sun and Earth on an airless lunar horizon. Every site is also plotted on an interactive 3D map of the south pole.

## Features

- **Site evaluation:** For each site, the app queries JPL Horizons for the Sun and Earth as seen from the site's coordinates and altitude (`CENTER = coord@301`, geodetic). It reports:
  - **Power:** Sun elevation and whether the site is in daylight.
  - **Comm:** Earth elevation and whether there is line-of-sight or the Earth is occulted.
  - **Windows:** upcoming sunset and earthset.
- **Comparison modes:** *Site A vs Site B* or *Date 1 vs Date 2*. Timeline scrubbers can be synced, with steps from 1 h to 1 d.
- **Lunar South Pole Map:** a React Three Fiber globe, oriented with the south pole up.
  - Pins for every landing site. Site A and Site B are highlighted.
  - Clicking a pin assigns that site to the chosen slot (*Click sets Site A / Site B*).
  - The surface uses locally bundled NASA LRO/LROC color and LOLA elevation maps, with source checksums. Lighting is illustrative; these display maps are not used for local visibility calculations.
  - Drag to rotate, scroll to zoom.
- **3D horizon view:** Sun and Earth directions and apparent disk sizes from Horizons on a reference horizontal plane. Bodies are hidden until valid data is available.
- **Telemetry HUD:** per-scenario readouts, plus the difference in solar and Earth elevation between scenarios A and B.

### Candidate sites

The preset catalog contains center-pixel reference points from 13 NASA GSFC regional LOLA DEMs. These are **not official NASA-selected landing coordinates**. Each point's name, source grid cell, height and provenance are in [`data/sites.json`](data/sites.json). The former uncited catalog and LCROSS impact claim have been removed.

Choose **Custom coordinates** in either site's picker to enter latitude (-90 to 90°) and east-positive longitude (-180 to 360°). Heights are sampled from the global LOLA grid at **0.25° spacing (~7.6 km north–south)**. This is a coarse estimate; small obstructions, local slopes, terrain shadows and landing hazards are not resolved. The regional presets use finer 5 m grids, which themselves include interpolation and measurement uncertainty.

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

## Project structure

```
app/
  page.tsx                  Main page
  actions.ts                Server action wrapping site evaluation
  api/evaluations/route.ts  REST endpoint
components/
  ComparisonView.tsx        Comparison modes, site map panel, A/B scenarios
  LunarGlobe.tsx            Interactive Lunar South Pole Map (R3F globe + pins)
  Lunar3DCanvas.tsx         Airless horizon view with Sun / Earth
  ScenarioPane.tsx          Per-scenario site picker, date range, readouts
  TelemetryHUD.tsx          Power / comm telemetry display
  TimelineScrubber.tsx      Ephemeris timeline playback
lib/
  jpl-horizons.ts           Horizons query builder, parser, evaluator
  moon-surface.ts           Lunar reference sphere and coordinate conversion
  custom-location.ts       Global LOLA height lookup for custom coordinates
  ephemeris.ts              Az/El and RA/Dec maths, formatting helpers
  sites.ts                  Candidate landing sites
  dates.ts, types.ts        Date parsing and shared types
```

## Data source

See [DATA_SOURCES.md](DATA_SOURCES.md) for datasets, coordinate/height conventions, limitations, refresh instructions and validation. Run `npm test`, `npm run lint` and `npm run build` to validate the code. Tests include archived real NASA Horizons responses; no NASA network access is needed for the unit suite.
