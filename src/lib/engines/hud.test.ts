import assert from "node:assert/strict";
import { test } from "node:test";
import { confidenceCopy, evaluateAlerts, nextState } from "./and-gate.ts";
import { driveWindowCopy, isSevereNws, pairSeven, stepClock } from "./clock.ts";
import { computeCone } from "./cone.ts";
import { geomHits } from "./geom.ts";

test("gate does not lock the map behind GPS", () => {
  assert.equal(nextState(false, true, true, "caution"), "caution");
  assert.equal(nextState(true, false, true, "normal"), "normal");
  assert.equal(nextState(true, true, false, "danger"), "danger");
  assert.equal(nextState(true, true, true, null), "normal");
  assert.equal(nextState(true, true, true, "stop"), "stop");
});

test("alert evaluation ranks tornado warning + immediate as stop", () => {
  assert.equal(evaluateAlerts([]), "normal");
  assert.equal(evaluateAlerts([{ event: "Flood Watch", severity: "Moderate" }]), "caution");
  assert.equal(
    evaluateAlerts([{ event: "Tornado Warning", severity: "Extreme", urgency: "Immediate" }]),
    "stop",
  );
});

test("confidence copy is about feeds, not a GPS lock", () => {
  assert.match(confidenceCopy(false, false, false), /WAIT/);
  assert.match(confidenceCopy(false, true, true), /HIGH/);
  assert.match(confidenceCopy(true, true, true), /HIGH/);
});

test("storm clock IMPACT in first 3 hours, BUILD later", () => {
  const impact = stepClock({
    hours: [
      { when: "3 PM", forecast: "Thunderstorms" },
      { when: "4 PM", forecast: "Clear" },
    ],
    days: [],
    alertCount: 0,
  });
  assert.equal(impact.risk, "IMPACT");
  const build = stepClock({
    hours: Array.from({ length: 6 }, (_, i) => ({
      when: `${i}h`,
      forecast: i === 5 ? "Severe thunderstorms" : "Sunny",
    })),
    days: [],
    alertCount: 0,
  });
  assert.equal(build.risk, "BUILD");
});

test("drive window HOLD when arrival sits in IMPACT", () => {
  const c = stepClock({
    hours: [
      { when: "now", forecast: "Thunderstorms" },
      { when: "+1h", forecast: "Clear" },
    ],
    days: [],
    alertCount: 0,
  });
  const copy = driveWindowCopy(c, true, 0);
  assert.match(copy, /HOLD/);
});

test("pairSeven folds night lows into the day card", () => {
  const days = pairSeven([
    { name: "Today", temp: "82°F", short: "Sunny", detail: "", wind: "S 8 mph", night: false },
    { name: "Tonight", temp: "61°F", short: "Clear", detail: "", wind: "S 4 mph", night: true },
  ]);
  assert.equal(days.length, 1);
  assert.equal(days[0]?.high, "82°F");
  assert.equal(days[0]?.low, "61°F");
});

test("SPS and watches are not severe NWS", () => {
  assert.equal(isSevereNws({ event: "Special Weather Statement", severity: "Moderate" }), false);
  assert.equal(isSevereNws({ event: "Flood Watch", severity: "Moderate" }), false);
  assert.equal(isSevereNws({ event: "Tornado Warning", severity: "Extreme" }), true);
});

test("moderate special weather statement is not IMPACT without hazard forecast", () => {
  const c = stepClock({
    hours: [
      { when: "now", forecast: "Mostly cloudy" },
      { when: "+1h", forecast: "Clear" },
    ],
    days: [],
    alertCount: 0,
  });
  assert.equal(c.risk, "CLEAR");
});

test("severe warning count stains the next 4 hours as IMPACT", () => {
  const c = stepClock({
    hours: [
      { when: "now", forecast: "Mostly cloudy" },
      { when: "+1h", forecast: "Clear" },
    ],
    days: [],
    alertCount: 1,
  });
  assert.equal(c.risk, "IMPACT");
});

test("intersect cone CLEAR without a route, INTERSECT on polygon hit", () => {
  const empty = computeCone({
    coords: [],
    hasRoute: false,
    radarLive: false,
    miles: 0,
    remainMin: 0,
    geoms: [],
  });
  assert.equal(empty.risk, "CLEAR");

  const square = {
    type: "Polygon",
    coordinates: [
      [
        [-90, 37],
        [-89, 37],
        [-89, 38],
        [-90, 38],
        [-90, 37],
      ],
    ],
  };
  const hit = computeCone({
    coords: [
      [-89.5, 37.5],
      [-89.4, 37.6],
    ],
    hasRoute: true,
    radarLive: true,
    miles: 12,
    remainMin: 18,
    geoms: [{ event: "Tornado Warning", geom: square }],
  });
  assert.equal(hit.risk, "INTERSECT");
  assert.ok(hit.samples >= 2);
  assert.equal(geomHits(square, 37.5, -89.5), true);
  assert.equal(geomHits(square, 40, -80), false);
});
