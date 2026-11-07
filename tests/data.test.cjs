const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { parseHorizonsTable, combineEphemerides, buildHorizonsParams, evaluateLandingSite } = require('../lib/jpl-horizons.ts');
const { normalizeUtcTime } = require('../lib/dates.ts');
const { azElToCartesian, hoursUntilFlagDrop } = require('../lib/ephemeris.ts');
const { customLandingSite } = require('../lib/custom-location.ts');
const sites = require('../data/sites.json');
const sunExport = require('./fixtures/sun.json');
const earthExport = require('./fixtures/earth.json');
const parse = (text = sunExport.result) => parseHorizonsTable(text, 'sun');

test('real NASA exports retain exact azimuth, elevation, range and disk size', () => {
  const a = parse();
  const b = parseHorizonsTable(earthExport.result, 'earth');
  assert.equal(a.length, 3);
  assert.equal(a[0].azimuth, 23.908725);
  assert.equal(a[0].elevation, 1.732608);
  assert.equal(a[0].distanceAU, 0.98887333072762);
  assert.equal(a[0].angularDiameterArcsec, 1940.049);
  assert.equal(b[0].azimuth, 177.160674);
  assert.equal(combineEphemerides(a, b).length, 3);
});

test('captured NASA fixtures and shipped assets match recorded checksums', () => {
  for (const record of require('./fixtures/provenance.json')) {
    const raw = fs.readFileSync(`${__dirname}/fixtures/${record.target}.json`);
    assert.equal(createHash('sha256').update(raw).digest('hex'), record.sha256);
  }
  for (const record of require('../data/moon-maps.json').maps) {
    assert.equal(createHash('sha256').update(fs.readFileSync(`public${record.file}`)).digest('hex'), record.sha256);
  }
});

test('missing magnitude preserves distance-column alignment', () => {
  const a = parse(sunExport.result.replace('-26.766', 'n.a.'));
  assert.equal(a[0].apparentMagnitude, null);
  assert.equal(a[0].distanceAU, 0.98887333072762);
});

test('solar upper-limb flag never overrides negative solar-center elevation', () => {
  assert.equal(parse(sunExport.result.replace('1.732608', '-0.100000'))[0].isDaylight, false);
});

test('unknown, malformed, out-of-range and truncated angles fail closed', () => {
  for (const value of ['n.a.', 'NaN', '999', 'bad']) {
    assert.throws(() => parse(sunExport.result.replace('23.908725', value)), /numeric|range/);
  }
  assert.throws(() => parse(sunExport.result.replace('$$EOE', '')), /bounds/);
  assert.throws(() => parse(sunExport.result.replace('Elev_(a-app)', 'Unexpected')), /column/);
  assert.throws(() => parse(sunExport.result.replace('2026-Nov-07 02:00', '2026-Nov-07 00:00')), /timestamp/);
  assert.throws(() => parse(sunExport.result.replace('2026-Nov-07 02:00', '2026-Feb-31 02:00')), /timestamp/);
});

test('CSV headings determine column meaning, independent of position', () => {
  const lines = sunExport.result.split('\n');
  const start = lines.indexOf('$$SOE');
  const end = lines.indexOf('$$EOE');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Date__(UT)__HR:MN,') || (i > start && i < end)) {
      const cells = lines[i].split(',');
      [cells[5], cells[6]] = [cells[6], cells[5]];
      lines[i] = cells.join(',');
    }
  }
  assert.equal(parse(lines.join('\n'))[0].elevation, 1.732608);
});

test('misaligned Sun/Earth timestamps cannot become fabricated night/occultation', () => {
  assert.throws(() => combineEphemerides(parse(), parseHorizonsTable(earthExport.result, 'earth').slice(1)), /identical timestamps/);
});

test('reference points reconstruct their documented NASA projected source pixels', () => {
  assert.equal(sites.length, 13);
  assert.equal(new Set(sites.map(s => s.id)).size, sites.length);
  for (const s of sites) {
    assert.equal(new URL(s.provenance.url).hostname, 'pgda.gsfc.nasa.gov');
    assert.match(s.provenance.sourceSha256, /^[a-f0-9]{64}$/);
    const radius = 2 * 1737400 * Math.tan((90 + s.latitude) * Math.PI / 360);
    assert.ok(Math.abs(radius * Math.sin(s.longitude * Math.PI / 180) - s.provenance.eastingM) < 1e-6);
    assert.ok(Math.abs(radius * Math.cos(s.longitude * Math.PI / 180) - s.provenance.northingM) < 1e-6);
    assert.equal(s.provenance.pixelScaleM, 5);
  }
  assert.equal(sites.some(s => s.id === 'cabeus-lcross'), false);
});

test('global custom locations use real grid cells across poles, equator and longitude seam', () => {
  for (const lat of [-90, -89.5, 0, 89.5, 90]) {
    for (const lon of [-180, 0, 180, 360]) {
      const s = customLandingSite(lat, lon);
      assert.equal(s.latitude, lat);
      assert.ok(Number.isFinite(s.altitude));
      assert.equal(s.provenance.angularPixelScaleDeg, 0.25);
      assert.ok(s.provenance.pixel[0] >= 0 && s.provenance.pixel[0] < 1440);
      assert.ok(s.provenance.pixel[1] >= 0 && s.provenance.pixel[1] < 720);
    }
  }
  assert.equal(customLandingSite(0, -180).altitude, customLandingSite(0, 180).altitude);
  assert.equal(customLandingSite(0, 0).altitude, customLandingSite(0, 360).altitude);
  for (const [lat, lon] of [[NaN, 0], [91, 0], [0, Infinity], [0, -181]]) assert.throws(() => customLandingSite(lat, lon));
});

test('UTC dates are explicit and impossible calendar dates are rejected', () => {
  assert.equal(normalizeUtcTime('2026-11-07'), '2026-11-07 00:00');
  assert.equal(normalizeUtcTime('2026-11-07T02:00Z'), '2026-11-07 02:00');
  for (const date of ['2026-02-30', '2026-11-07T25:00', '2026-11-07T02:00+06:30']) assert.throws(() => normalizeUtcTime(date));
});

test('Horizons request fixes the source, frame, time and exact NASA height', () => {
  const p = buildHorizonsParams({ target: 'sun', site: sites[0], startTime: '2026-11-07', stopTime: '2026-11-08', stepSize: '2 h' });
  assert.equal(p.get('TIME_TYPE'), "'UT'");
  assert.equal(p.get('CSV_FORMAT'), "'YES'");
  assert.equal(p.get('SITE_COORD'), `'${sites[0].longitude},${sites[0].latitude},${sites[0].altitude / 1000}'`);
});

test('invalid user requests fail with HTTP 400 before network access', async () => {
  for (const changes of [{ siteId: 'unknown' }, { stepSize: '0 h' }, { startTime: 'bad' }, { siteId: 'custom', location: { latitude: 91, longitude: 0 } }]) {
    await assert.rejects(evaluateLandingSite({ siteId: sites[0].id, startTime: '2026-11-07', stopTime: '2026-11-08', ...changes }), e => e.status === 400);
  }
});

test('cardinal directions preserve the teammate compass fix; absent samples have no event', () => {
  const expected = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  [0, 90, 180, 270].forEach((az, i) => azElToCartesian(az, 0, 1).forEach((x, j) => assert.ok(Math.abs(x - expected[i][j]) < 1e-12)));
  assert.equal(hoursUntilFlagDrop([], 0, 'isDaylight'), null);
});

test('provider identity, observer checks and original retrieval metadata survive caching', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  const request = { siteId: sites[0].id, startTime: '2026-11-07', stopTime: '2026-11-07 04:00', stepSize: '2 h' };
  global.fetch = async url => {
    calls++;
    const result = new URL(url).searchParams.get('COMMAND') === "'10'" ? sunExport : earthExport;
    return { ok: true, json: async () => result };
  };
  try {
    const first = await evaluateLandingSite(request);
    assert.equal(calls, 2);
    global.fetch = async () => { throw new Error('Network unavailable'); };
    const second = await evaluateLandingSite(request);
    assert.equal(second.fetchedAt, first.fetchedAt);
    assert.deepEqual(second.provenance, first.provenance);
    assert.match(second.provenance.sun.sha256, /^[a-f0-9]{64}$/);
    for (const [i, data, message] of [
      [1, { ...sunExport, signature: { source: 'Unknown provider', version: '1' } }, /API response/],
      [2, { ...sunExport, result: sunExport.result.replace('Sun (10)', 'Mars (499)') }, /target/],
      [3, sunExport, /observer/],
    ]) {
      global.fetch = async () => ({ ok: true, json: async () => data });
      await assert.rejects(evaluateLandingSite({ ...request, siteId: 'custom', location: { latitude: i, longitude: 0 } }), message);
    }
  } finally {
    global.fetch = originalFetch;
  }
});
