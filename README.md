# LuminaLuna — Lunar Landing Site Navigator

LuminaLuna is a mission-planning tool for the lunar south pole. It evaluates candidate landing sites for **power** (Sun elevation) and **communications** (Earth line-of-sight). It uses observer ephemerides from the [NASA JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/).

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
  - The surface is procedural: named south-polar craters (Shackleton, de Gerlache, Haworth, Faustini, Amundsen, …) at their real coordinates, plus seeded filler craters.
  - A high-resolution polar cap overlay keeps the pole from looking pinched.
  - Drag to rotate, scroll to zoom.
- **3D horizon view:** the Sun and Earth on an airless horizon (ICRF / Az-El).
- **Telemetry HUD:** per-scenario readouts, plus the difference in solar and Earth elevation between scenarios A and B.

### Candidate sites

Shackleton Crater Rim, Connecting Ridge, Connecting Ridge Extension, Malapert Mountain, Leibnitz Beta Plateau, de Gerlache Rim (two sites), the de Gerlache–Kocher Massif, the Faustini, Haworth, Nobile and Amundsen rims, and Cabeus (the historic LCROSS impact site). Coordinates are planetocentric with east-positive longitude. Site data lives in [`lib/sites.ts`](lib/sites.ts).

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
| `startTime` | yes      | `2026-11-07 00:00`                      |
| `stopTime`  | yes      | `2026-11-21 00:00`                      |
| `stepSize`  | no       | `2 h` (default)                         |

```bash
curl "http://localhost:3000/api/evaluations?siteId=shackleton-rim&startTime=2026-11-07%2000:00&stopTime=2026-11-08%2000:00&stepSize=1%20h"
```

Responses are cached for 6 hours. Requests to Horizons are sent one at a time, so the app doesn't flood the public API.

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
  moon-surface.ts           Procedural lunar surface + polar crater catalog
  ephemeris.ts              Az/El and RA/Dec maths, formatting helpers
  sites.ts                  Candidate landing sites
  dates.ts, types.ts        Date parsing and shared types
```

## Data source

Ephemeris data comes from NASA JPL's Horizons system ([API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html)). The crater positions on the south pole map are approximate. They are for visualization only and should not be used for navigation.
