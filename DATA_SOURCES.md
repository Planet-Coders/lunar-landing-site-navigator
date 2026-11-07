# Data sources and scope

## Reference points

`data/sites.json` replaces the former uncited site catalog. All 13 points are the center pixel at `(floor(width/2), floor(height/2))` of a named **NASA GSFC LRO/LOLA regional DEM** listed in [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78). Names follow that product's mapping of site IDs to regions, not an inferred Artemis landing-point designation. Site11 and SL2 are both called de Gerlache rim by the provider; no unverified Rim 1/Rim 2 correspondence is asserted.

Coordinates are derived from each source pixel's south-polar stereographic easting/northing on a 1,737,400 m sphere. Heights are read directly from its float32 surface raster, in meters above that sphere. The frame is **MOON_ME of JPL DE421**, as documented in the [provider README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README). Horizons' current Moon observer model uses the same sphere and mean-Earth frame; returned observer/model headers are checked. Instrument height above the surface is zero. A DEM center may be a crater floor or rough ground: these points are for comparison, not recommended landing spots.

Every record retains its source URL, full source TIFF SHA-256, source pixel, projection coordinates, grid dimensions and nominal 5 m cell spacing. Nominal spacing is not accuracy: LOLA products include interpolation and uncertainty. See Barker et al. (2021), *Improved LOLA Elevation Maps for South Pole Landing Sites*, [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119). NASA describes these as lunar south-pole reference regions; a dated [Artemis region announcement](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) does not identify these pixels as mission landing sites.

The unsupported `cabeus-lcross` entry was removed. `cabeus-exterior` is NASA LOLA **NPA / Cabeus exterior wall 1** and makes no historic-impact claim.

## Arbitrary locations

Select Custom coordinates or submit `siteId=custom` with latitude and longitude. The chosen coordinates are user inputs, not NASA-selected sites. Height is the nearest cell in NASA's **LOLA LDEM_4**, a 1440×720 global grid at 4 pixels per degree, obtained from [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/).

`data/moon-elevation.bin` preserves the published half-meter elevations as signed little-endian int16 values; the runtime verifies its size and checksum. Row zero is north; column zero is 180°W. Longitudes wrap at the seam and pole-row indices are bounded. Grid-center spacing is 0.25°, about 7.6 km north–south (east–west spacing decreases toward the poles). The supplied coordinate is used for the observer; its **height is only an approximate nearest-cell estimate**, not a high-resolution surface height there. There is no terrain-based landing assessment or horizon mask. Exact poles have a singular azimuth reference; if Horizons cannot return valid angles the request fails explicitly.

## Ephemerides

The only runtime ephemeris provider is the HTTPS [NASA JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). Targets are Sun (10) and Earth (399); the observer is `coord@301` on the Moon. `SITE_COORD` is east-positive longitude, latitude and height in km above the 1737.4 km sphere. UTC minute-precision observer tables request quantities 1, 4, 9, 13 and 20: astrometric ICRF RA/Dec, airless apparent local Az/El, apparent visual magnitude, angular diameter in arcseconds, apparent range in AU and range rate in km/s. See the [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html).

The API signature, target, observer body, reference sphere/frame and echoed observer coordinates are checked. CSV columns are selected by verified headings. Missing magnitude remains null; missing or invalid required Az/El or disk diameter rejects the response. Dates must be valid, ordered, identical for Sun/Earth, and match the requested interval. Failures produce errors, never synthetic rows or cached exports for another coordinate. Six-hour per-process caching retains the original query and retrieval time. Each result returns source URLs, version, model headers and SHA-256 of each exact Horizons text export.

Azimuth runs clockwise from north through east. Visibility is **target center elevation > 0 relative to the reference horizontal plane**. Horizons' `*` flag uses the Sun's upper limb and is deliberately not substituted for this rule. Terrain, horizon dip, finite-disk visibility, eclipse modeling, panel orientation/storage, antenna constraints and ground-station visibility are not evaluated. The countdowns are times to the next **sampled** loss; they are limited by sample spacing and may miss shorter events. `OPEN / EOT` means no sampled loss before the requested series ends, not permanent visibility.

## Display data

The globe uses the [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), created from LRO instrument-team products:

- `lroc_color_poles_2k.tif`: 2019 SVS adaptation of the LROC WAC Hapke-normalized mosaic; converted to an RGB PNG without invented craters.
- `ldem_4.tif`: LOLA float32 height in kilometers above the 1737.4 km sphere; linearly mapped to an 8-bit display bump texture. The conversion range and original/output SHA-256 hashes are in `data/moon-maps.json`. This lower-precision bump texture is never used for observer heights.

Both maps are centered on longitude 0° with 180°W at the left edge. A +0.25 texture-U offset aligns them with the globe's sphere geometry, which starts at 90°W. Bump scale is the published height range divided by lunar radius. Map lighting is explicitly illustrative and independent of the selected time.

The local horizon uses a plain reference plane, not fake relief. Sun/Earth directions and disk diameters use the current Horizons sample without enlargement or an ICRF-to-local fallback. Bodies are absent when data is unavailable or stale. Earth color, the generic lander, scene lights and compass markers are diagram styling, not scientific imagery or mission measurements. Missing telemetry is shown as unknown; stale results are hidden from the sky, HUD and comparisons while the existing stale warning is retained.

## Refresh and validate

The data files were retrieved on 2026-11-07 over verified HTTPS. To regenerate source-derived files, run `/usr/bin/python3 scripts/refresh-nasa-data.py` from the repo with Python GDAL and NumPy installed. No GDAL is required to run the app. The script downloads full regional TIFFs to calculate source checksums; this can transfer hundreds of MB. Inspect source changes and checksums before accepting an update.

`npm test` runs offline regression tests using **actual full NASA responses** in `tests/fixtures`, with exact query URLs and checksums in `tests/fixtures/provenance.json`. Those fixtures are only test inputs. The previous uncited `lib/parse-horizons.sample.ts` was removed. Tests cover real values, unavailable columns, reordered headings, corrupt rows, timestamp mismatches, source-cell coordinates, grid boundaries, UTC inputs, invalid requests and the teammate's compass correction. `npm run lint` and `npm run build` provide static/build validation. Live evaluations and browser checks are separate from the offline suite.
