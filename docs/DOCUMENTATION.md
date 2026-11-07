# LuminaLuna: Lunar Landing Site Navigator — Documentation

This document describes the project as it is on the `main` branch (November 2026, after PRs #1–#3 and the native-`fetch` change). For a short overview see the [README](../README.md); for dataset details and scientific limits see [DATA_SOURCES.md](../DATA_SOURCES.md).

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Using the app](#2-using-the-app)
3. [Architecture](#3-architecture)
4. [Data sources](#4-data-sources)
5. [How visibility and windows are calculated](#5-how-visibility-and-windows-are-calculated)
6. [API reference](#6-api-reference)
7. [Setup and local development](#7-setup-and-local-development)
8. [Testing](#8-testing)
9. [Deployment](#9-deployment)
10. [Known issues](#known-issues)
11. [Limitations](#11-limitations)
12. [Project history](#12-project-history)
13. [AI assistance](#13-ai-assistance)

---

## 1. What the app does

LuminaLuna compares two places near the lunar south pole over a chosen period and answers two questions for each:

- **Power:** when is the Sun above the local horizon (so solar panels could see it)?
- **Comms:** when is the Earth above the local horizon (so there is direct line of sight for radio)?

The Sun and Earth positions come live from NASA JPL Horizons, as seen from the exact latitude, longitude and height of each site. The app then works out sunlit and Earth-visible windows above a user-set horizon mask and compares the two sites side by side.

It is a **geometric visibility tool only**. It does not model terrain shadows, the size of the Sun's or Earth's disc, landing hazards, power generation or link budgets.

## 2. Using the app

The main page (`app/page.tsx` → `components/NavigatorView.tsx`) has four parts.

### Top bar

| Control | What it does |
| --- | --- |
| **Site A / Site B** | Dropdowns listing the 13 NASA LOLA reference points. Defaults are Shackleton Rim (A) and Malapert Massif (B). |
| **Date range (UT)** | Start and stop date-times in UTC. Defaults to 2026-11-07 00:00 → 2026-11-21 00:00 (14 days). |
| **Step** | Sample spacing: 1 h, 2 h (default), 6 h, 12 h or 1 d. |
| **Horizon mask** | Slider from 0° to 10°. A body only counts as visible when its elevation is above this angle. |

Changing a site, the dates or the step re-queries the server after a 0.5 s pause. Moving the horizon mask does **not** re-query; it recalculates in the browser instantly. Results are cached in the browser per query, so switching back to an earlier selection is immediate.

### Lunar South Pole Map (left)

`components/LunarGlobe.tsx` draws a 3D Moon with React Three Fiber, rotated so the south pole faces the viewer.

- Every reference site has a pin; Site A is cyan and Site B is amber.
- A toggle chooses whether a click on a pin sets Site A or Site B.
- Drag to rotate, scroll to zoom.
- Surface textures are NASA LRO/LROC colour and LOLA height maps stored in `public/data/`. Lighting on the globe is decorative and does not follow the selected time.

### Charts and comparison table (right)

- **Sun elevation** and **Earth elevation** charts (`components/ElevationChart.tsx`, plain SVG): both sites on each chart, with the 0° line and the mask line. Hovering on one chart shows the same moment on the other.
- **Power & Comms window comparison** (`components/WindowComparisonTable.tsx`): for each site,
  - time sunlit (%), longest sunlit window, longest dark period, first sunset;
  - time Earth visible (%), longest comms blackout, first Earthset;
  - time both sunlit and Earth visible (%).

  A check mark shows the better site on each row.

### Footer

A "Geometric Visibility Only" note reminds users what is not modelled.

### Custom coordinates

The server supports any lunar coordinate (`siteId=custom`, see the [API](#6-api-reference)). The current main page does **not** expose this in its dropdowns. An older comparison view (`components/ComparisonView.tsx` with `ScenarioPane`, `Lunar3DCanvas`, `TelemetryHUD` and `TimelineScrubber`) has a Custom coordinates picker and a 3D horizon scene, but it is no longer rendered on the page.

## 3. Architecture

### Stack

- **Next.js 14** App Router, **React 18**, **TypeScript**
- **three.js**, **@react-three/fiber**, **@react-three/drei** for the globe
- **Tailwind CSS** and **lucide-react** icons
- No database and no API keys. The only external service is NASA JPL Horizons.

### Request flow

```
Browser (NavigatorView)
  │  POST /api/evaluations  { siteId, startTime, stopTime, stepSize }   ×2 (Site A, Site B)
  ▼
app/api/evaluations/route.ts          (Node.js runtime, maxDuration 60 s)
  │  evaluateLandingSite()
  ▼
lib/jpl-horizons.ts
  │  validate request → resolve site (lib/sites.ts or lib/custom-location.ts)
  │  two queued fetches: Sun (10) and Earth (399), observer coord@301
  ▼
https://ssd.jpl.nasa.gov/api/horizons.api
  │  JSON with a CSV observer table
  ▼
lib/jpl-horizons.ts  parse + verify → EvaluationResult (records + provenance)
  ▼
Browser: lib/windows.ts  → elevation series + window summary (applies horizon mask)
  ▼
ElevationChart ×2, WindowComparisonTable
```

`app/actions.ts` also exposes the same evaluation as a Next.js server action (`evaluateSiteAction`), used by the older comparison view.

### Folder layout

```
app/
  layout.tsx                Fonts, metadata, global styles
  page.tsx                  Main page: header, NavigatorView, footer
  actions.ts                Server action wrapping evaluateLandingSite
  api/evaluations/route.ts  REST endpoint (GET and POST)
  globals.css               Tailwind layers and HUD styles
components/
  NavigatorView.tsx         Main layout and state (sites, dates, step, mask)
  ElevationChart.tsx        SVG elevation chart with shared hover
  WindowComparisonTable.tsx Power & Comms comparison table
  LunarGlobe.tsx            3D south pole globe with site pins
  ComparisonView.tsx, ScenarioPane.tsx, Lunar3DCanvas.tsx,
  TelemetryHUD.tsx, TimelineScrubber.tsx   Earlier view, not on the page
lib/
  jpl-horizons.ts           Query builder, fetch queue/cache, parser, validation
  windows.ts                Mask-based interval maths and summaries
  sites.ts                  Loads data/sites.json
  custom-location.ts        Height lookup in the global LOLA grid
  moon-surface.ts           Lunar radius (1737.4 km), lat/lon → 3D vector
  ephemeris.ts              Az/El and RA/Dec helpers and formatting
  dates.ts                  Horizons date parsing, UTC normalisation, default window
  types.ts                  Shared TypeScript types
data/
  sites.json                13 NASA LOLA reference points with provenance
  moon-elevation.bin        Global LOLA LDEM_4 heights (int16, 1440×720)
  moon-maps.json            Checksums and conversion info for globe textures
public/data/
  moon-color.png, moon-height.png   Globe textures
scripts/
  refresh-nasa-data.py      Rebuilds the NASA-derived data files
tests/
  data.test.cjs             Offline unit tests
  fixtures/                 Archived real Horizons responses and provenance
```

### Key modules

**`lib/jpl-horizons.ts`**

- `buildHorizonsParams()` builds the query: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='lon,lat,height_km'`, `QUANTITIES='1,4,9,13,20'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`, UT minute precision.
- `fetchExport()` sends requests **one at a time** through a promise queue, with a 30 s timeout each, using Node's built-in `fetch`. Responses are cached in memory for 6 hours (up to 128 entries) per server process. Failed requests are removed from the cache.
- It checks the API signature, target body, centre body (Moon 301), reference frame (`MEAN_ME`), radii (1737.4 km) and that the echoed observer coordinate matches the request.
- `parseHorizonsTable()` finds columns by heading name, keeps `n.a.` cells as `null`, and rejects bad rows, out-of-range angles and unordered timestamps.
- `evaluateLandingSite()` validates the request (range ≤ 120 days, ≤ 10 000 samples, step format `N m|h|d`), fetches Sun and Earth, checks their timestamps match each other and the requested grid, and returns records plus provenance (query URLs, API version, retrieval time, SHA-256 of each export).
- Errors are `HorizonsError` with an HTTP status (400 for bad input, 502 for upstream problems).

**`lib/windows.ts`**

- `toElevationSeries()` turns records into `{ t, sun, earth }` points.
- `intervalsAbove()` finds intervals where elevation is above the mask, using linear interpolation to place each crossing between samples.
- `summarizeWindows()` returns percentages, longest windows/gaps and time to first sunset/Earthset.

## 4. Data sources

All runtime science data is from NASA. Full details, checksums and citations are in [DATA_SOURCES.md](../DATA_SOURCES.md).

| Data | Source | Used for |
| --- | --- | --- |
| Sun and Earth positions | [NASA JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), live | Elevation, azimuth, RA/Dec, distance, disc size |
| 13 reference sites | Centre pixels of NASA GSFC regional LOLA 5 m DEMs ([PGDA product 78](https://pgda.gsfc.nasa.gov/products/78)) | Site coordinates and heights (`data/sites.json`) |
| Custom-coordinate heights | NASA LOLA LDEM_4 global grid, 0.25° spacing ([SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)) | `data/moon-elevation.bin` |
| Globe textures | NASA SVS CGI Moon Kit (LROC WAC colour, LOLA height) | Display only, `public/data/` |

Important notes:

- The reference sites are **not official NASA landing sites**. They are DEM centre points named after NASA's south-pole regions.
- Coordinates use the MOON_ME frame on a 1737.4 km sphere, matching Horizons. Instrument height above the surface is zero.
- Custom-coordinate heights are a coarse nearest-cell estimate (~7.6 km grid).
- The globe textures are never used for calculations.

To refresh the data files, run `/usr/bin/python3 scripts/refresh-nasa-data.py` with Python GDAL and NumPy installed. It downloads several hundred MB of source TIFFs. The app itself needs no GDAL.

## 5. How visibility and windows are calculated

1. For each sample time, Horizons returns the airless apparent elevation of the **centre** of the Sun and of the Earth relative to the site's local horizontal plane.
2. A body is "visible" when its elevation is greater than the horizon mask (0° by default).
3. Between two samples, the crossing time is found by linear interpolation, so windows are not rounded to the step size.
4. From those intervals the app computes:
   - **% time sunlit / Earth visible / both** over the whole range;
   - **longest sunlit window**, **longest dark period**, **longest comms blackout**;
   - **first sunset / first Earthset**: hours from the start until the first loss. "Not in range" means no loss inside the range, not permanent visibility.

Smaller step sizes give more accurate windows but take longer to fetch. Very short events between samples can be missed.

## 6. API reference

### `GET /api/evaluations` or `POST /api/evaluations`

Evaluates one site over a time range. The page calls it twice, once per site.

| Field | Required | Notes |
| --- | --- | --- |
| `siteId` | yes | An id from `data/sites.json` (e.g. `shackleton-rim`), or `custom` |
| `location` | when `siteId=custom` | POST: `{"latitude": -89.5, "longitude": 220}`. GET: `latitude=…&longitude=…`. Latitude −90…90, east longitude −180…360 |
| `startTime` | yes | UTC, e.g. `2026-11-07 00:00` (POST also accepts `start`) |
| `stopTime` | yes | UTC, after `startTime`, at most 120 days later (POST also accepts `stop`) |
| `stepSize` | no | `N m`, `N h` or `N d`; default `2 h`; at most 10 000 samples |

Examples:

```bash
curl "http://localhost:3000/api/evaluations?siteId=shackleton-rim&startTime=2026-11-07%2000:00&stopTime=2026-11-08%2000:00&stepSize=1%20h"

curl -X POST http://localhost:3000/api/evaluations \
  -H "Content-Type: application/json" \
  -d '{"siteId":"custom","location":{"latitude":-89.5,"longitude":220},"startTime":"2026-11-07 00:00","stopTime":"2026-11-08 00:00","stepSize":"1 h"}'
```

**Success (200)** returns `EvaluationResult` (see `lib/types.ts`). Shape only; the values below are illustrative:

```jsonc
{
  "site": { "id": "shackleton-rim", "name": "Shackleton Rim", "latitude": -89.77, "longitude": 188.11, "altitude": 768.0, "provenance": { ... } },
  "startTime": "2026-11-07 00:00", "stopTime": "2026-11-08 00:00", "stepSize": "1 h",
  "records": [
    { "date": "2026-Nov-07 00:00", "isDaylight": true, "isEarthVisible": false,
      "sun":   { "azimuth": 123.4, "elevation": 1.2, "angularDiameterArcsec": 1940, ... },
      "earth": { "azimuth": 10.1,  "elevation": -0.8, ... } }
  ],
  "source": "horizons",
  "fetchedAt": "2026-11-07T08:00:00.000Z",
  "provenance": { "timeScale": "UTC", "visibility": "...", "sun": { "queryUrl": "...", "sha256": "..." }, "earth": { ... } }
}
```

**Errors** return `{ "error": "...", "details": "..." }` with status **400** (bad input) or **502** (Horizons unreachable or returned unexpected data).

## 7. Setup and local development

Requirements: **Node.js 18.17 or later** (developed on Node 22) and internet access to `ssd.jpl.nasa.gov`.

```bash
git clone https://github.com/Planet-Coders/lunar-landing-site-navigator.git
cd lunar-landing-site-navigator
npm install
npm run dev          # http://localhost:3000
```

No `.env` file or API key is needed.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`next lint`) |
| `npm test` | Offline unit tests (Node's built-in test runner) |

## 8. Testing

`npm test` runs `tests/data.test.cjs` with `node --test`, loading TypeScript through `tests/register-typescript.cjs`. It needs no network: it uses archived, unmodified Horizons responses in `tests/fixtures/` (query URLs and checksums in `provenance.json`).

The 14 tests cover parsing real values, `n.a.` columns, reordered headings, corrupt rows, timestamp mismatches, site coordinates against source pixels, global-grid edges, UTC input handling, invalid requests and the horizon compass (N/S) correction.

Before a pull request, run:

```bash
npm test && npm run lint && npm run build
```

Live Horizons calls and the browser UI are not covered by the unit tests; check them by running the app.

## 9. Deployment

The app is deployed on **Vercel** as a standard Next.js project.

1. Import the GitHub repo in Vercel (framework preset: Next.js).
2. Build command `npm run build`, output handled by Vercel. No environment variables.
3. The API route uses the Node.js runtime and `maxDuration = 60` seconds. On Vercel's Hobby plan the effective limit may be lower; long date ranges with small steps need more time.
4. Every push to `main` triggers a production deployment; pull requests get preview deployments.

Notes:

- The in-memory 6-hour cache lives per server instance. On serverless hosts instances are short-lived, so expect more Horizons calls than locally.
- `undici` was removed because it caused a missing-module webpack error on Vercel. Horizons is now called with Node's built-in `fetch`.

## Known issues

### Live Vercel site: 502 "fetch failed" from JPL Horizons

**Symptom:** on the deployed site, both sites show an error and the charts and table stay empty. `/api/evaluations` returns HTTP 502 with `{"error": "fetch failed"}`.

**Where:** this happens only on Vercel. The same code works locally with `npm run dev`.

**What it means:** "fetch failed" is the generic message from Node's `fetch` when the network request itself fails (DNS, TLS, connection reset or a timeout before a response), not an HTTP error from Horizons. The route turns any non-`HorizonsError` into a 502.

**Status:** not fixed. Work on a fix was stopped on purpose.

**Things to check when picking it up:**

- The Vercel function logs: the underlying `error.cause` (e.g. `ECONNRESET`, `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`) shows the real reason.
- Whether `ssd.jpl.nasa.gov` is reachable from the Vercel region in use, or whether it rate-limits or blocks cloud IP ranges.
- Whether the function hits its time limit for the chosen range and step.
- Logging `error.cause` in `handleError` in `app/api/evaluations/route.ts` would make the message more useful.

### Other notes

- Custom coordinates are available in the API but not in the main page's dropdowns (see [Custom coordinates](#custom-coordinates)).
- Several older components are kept in `components/` but not used by the page.

## 11. Limitations

- Visibility is geometric: centre of the body above a flat local horizontal plane plus the user's mask. No terrain shadowing, horizon dip or finite-disc visibility.
- No eclipse, solar-panel orientation, battery, antenna or ground-station modelling.
- Sample spacing limits accuracy; short events between samples can be missed.
- Reference sites are comparison points, not recommended or official landing spots. Custom heights are coarse.
- Globe lighting and styling are illustrative only.

## 12. Project history

| Change | Summary |
| --- | --- |
| PR #1 | Interactive Lunar South Pole Map globe (React Three Fiber) |
| PR #2 | Fixed the horizon view's swapped North/South; quick UX fixes (missing-data deltas, out-of-date notice, labels) |
| PR #3 | Rebuilt the page to match the wireframe (top bar, map, Sun/Earth charts, Power & Comms table, horizon mask); NASA LOLA reference sites and bundled NASA globe maps; custom coordinates in the API; offline tests with real Horizons fixtures |
| `607a24a` | Removed `undici`, switched to native `fetch`, raised route timeout to 60 s |

## 13. AI assistance

This project was built with help from Claude, an AI assistant made by Anthropic, used through Claude Code. Claude reviewed the codebase, suggested enhancements, fixed the horizon-view bug, built the wireframe layout (charts, comparison table, horizon mask), and drafted the README and this documentation. A person reviewed and tested every change before it was merged.
