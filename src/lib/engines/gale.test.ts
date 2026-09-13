import assert from "node:assert/strict";
import { test } from "node:test";
import { fuseGale, galeScore } from "./gale.ts";
import { haversineM, sampleLine } from "./geo.ts";
import { cToTemp, mToDist, msToSpeed } from "./units.ts";
import { wmoLabel } from "./wmo.ts";

test("dry calm scores clear", () => {
  const r = galeScore({
    precip_mm_h: 0,
    wind_ms: 2,
    vis_m: 10000,
    radar_dbz: 0,
    severity: null,
  });
  assert.equal(r.band, "clear");
  assert.equal(r.reroute, false);
  assert.ok(r.score < 0.2);
});

test("severe cell triggers reroute", () => {
  const r = galeScore({
    precip_mm_h: 28,
    wind_ms: 28,
    vis_m: 400,
    radar_dbz: 58,
    severity: "Severe Warning",
  });
  assert.equal(r.reroute, true);
  assert.equal(r.band, "reroute");
  assert.ok(r.score >= 0.72);
});

test("fuse prefers the worst cell along the path", () => {
  const a = galeScore({
    precip_mm_h: 0,
    wind_ms: 1,
    vis_m: 10000,
    radar_dbz: 0,
    severity: null,
  });
  const b = galeScore({
    precip_mm_h: 18,
    wind_ms: 16,
    vis_m: 2000,
    radar_dbz: 45,
    severity: "Watch",
  });
  const f = fuseGale([a, b]);
  assert.ok(f.score > a.score);
  assert.ok(f.score >= 0.4);
});

test("units convert 1609.344 m to 1 mi", () => {
  assert.ok(Math.abs(mToDist(1609.344, "mi") - 1) < 1e-9);
  assert.ok(Math.abs(cToTemp(0, "F") - 32) < 1e-9);
  assert.ok(Math.abs(msToSpeed(1, "mph") - 2.236936) < 1e-6);
});

test("WMO 95 is thunderstorm", () => {
  assert.equal(wmoLabel(95).kind, "storm");
});

test("sampleLine keeps endpoints", () => {
  const line: [number, number][] = [
    [-89.3354, 37.7642],
    [-90.2, 38.63],
  ];
  const s = sampleLine(line, 50_000, 8);
  assert.equal(s[0].lat, 37.7642);
  assert.equal(s[s.length - 1].lat, 38.63);
  assert.ok(haversineM(37.7642, -89.3354, 38.63, -90.2) > 100_000);
});
