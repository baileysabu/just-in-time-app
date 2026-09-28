import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSegments,
  estimateTsaMinutes,
  estimateDriveMinutesFromDistance,
  formatCountdown,
  haversineKm,
  leaveByDate,
  leaveStatus,
  localHourAt,
  totalMinutes,
} from "../src/lib/timing";
import {
  displayFlightNumber,
  findFlightsInEvents,
  normalizeFlightNumber,
} from "../src/lib/flights";
import { chooseLeg, normalizeStatus, parseFlight } from "../../supabase/functions/_shared/aerodatabox";

test("flight number normalisation", () => {
  assert.equal(normalizeFlightNumber("aa 1204"), "AA1204");
  assert.equal(normalizeFlightNumber("B6-0023"), "B623");
  assert.equal(normalizeFlightNumber("dl482"), "DL482");
  assert.equal(normalizeFlightNumber("1234"), null);
  assert.equal(normalizeFlightNumber("hello"), null);
  assert.equal(displayFlightNumber("AA1204"), "AA 1204");
});

test("TSA estimate respects hub size, peak, PreCheck and bag", () => {
  const none = { precheck: false, checkingBag: false };
  assert.equal(estimateTsaMinutes("JFK", 12, none), 25);
  assert.equal(estimateTsaMinutes("JFK", 6, none), 35); // morning peak 1.4x
  assert.equal(estimateTsaMinutes("JFK", 12, { precheck: true, checkingBag: false }), 10);
  assert.equal(estimateTsaMinutes("XNA", 12, { precheck: false, checkingBag: true }), 27);
  assert.equal(estimateTsaMinutes("xna", 2, { precheck: true, checkingBag: false }), 5); // floor
});

test("local hour honours airport time zone", () => {
  // 14:25 UTC is 10:25 in New York (EDT, September)
  assert.equal(localHourAt("2026-09-29T14:25:00Z", "America/New_York"), 10);
  assert.equal(localHourAt("2026-09-29T14:25:00Z", "America/Los_Angeles"), 7);
});

test("leave-by = departure minus all segments, with overrides", () => {
  const dep = "2026-09-29T20:00:00Z";
  const segs = buildSegments({
    originIata: "SFO",
    departureISO: dep,
    originTimeZone: "America/Los_Angeles", // 13:00 local, off-peak
    driveMinutes: 42,
    driveIsLive: true,
    prefs: { precheck: false, checkingBag: false },
    overrides: { drive: 5, walk: -5 },
  });
  // drive 47, tsa 25, walk 10, boarding 30
  assert.deepEqual(
    segs.map((s) => s.minutes),
    [47, 25, 10, 30],
  );
  assert.equal(totalMinutes(segs), 112);
  assert.equal(leaveByDate(dep, segs).toISOString(), "2026-09-29T18:08:00.000Z");
});

test("status thresholds and countdown format", () => {
  assert.equal(leaveStatus(-1), "late");
  assert.equal(leaveStatus(10 * 60_000), "tight");
  assert.equal(leaveStatus(60 * 60_000), "ontrack");
  assert.equal(formatCountdown(3_723_000), "01:02:03");
  assert.equal(formatCountdown(90_061_000), "1d 01:01:01");
  assert.equal(formatCountdown(-5), "00:00:00");
});

test("distance fallback for drive time", () => {
  const km = haversineKm({ lat: 40.7128, lon: -74.006 }, { lat: 40.6413, lon: -73.7781 }); // NYC → JFK
  assert.ok(km > 18 && km < 22, `km=${km}`);
  const min = estimateDriveMinutesFromDistance(km);
  assert.ok(min > 25 && min < 40, `min=${min}`);
});

test("calendar scan finds only real airline codes", () => {
  const found = findFlightsInEvents([
    { title: "Flight to LAX (AA 1204)", startDate: new Date(2026, 9, 3, 15, 25) },
    { title: "Q3 review in Room 12", startDate: new Date(2026, 9, 3, 9, 0) },
    { title: "Trip", notes: "Confirmation ABC123, flight DL482", startDate: new Date(2026, 9, 5, 9, 40) },
    { title: "Duplicate AA1204", startDate: new Date(2026, 9, 3, 16, 0) },
  ]);
  assert.deepEqual(
    found.map((f) => `${f.flight}@${f.date}`),
    ["AA1204@2026-10-03", "DL482@2026-10-05"],
  );
});

test("AeroDataBox parsing — modern and legacy formats", () => {
  const modern = parseFlight(
    {
      number: "AA 1204",
      status: "Expected",
      airline: { name: "American Airlines" },
      departure: {
        airport: {
          iata: "JFK",
          shortName: "Kennedy",
          timeZone: "America/New_York",
          location: { lat: 40.64, lon: -73.78 },
        },
        scheduledTime: { utc: "2026-09-29 19:25Z", local: "2026-09-29 15:25-04:00" },
        revisedTime: { utc: "2026-09-29 19:55Z" },
        terminal: "8",
        gate: "B12",
      },
      arrival: {
        airport: { iata: "LAX", shortName: "Los Angeles" },
        scheduledTime: { utc: "2026-09-30 01:40Z" },
      },
    },
    "AA1204",
  );
  assert.ok(modern);
  assert.equal(modern.status, "Delayed"); // 30 min later than scheduled
  assert.equal(modern.estimatedDeparture, "2026-09-29T19:55:00.000Z");
  assert.equal(modern.gate, "B12");
  assert.equal(modern.durationMinutes, 375);
  assert.equal(modern.originLat, 40.64);

  const legacy = parseFlight(
    {
      status: "Boarding",
      departure: { airport: { iata: "SFO" }, scheduledTimeUtc: "2026-09-29 20:10Z" },
      arrival: { airport: { iata: "ORD" } },
    },
    "UA219",
  );
  assert.ok(legacy);
  assert.equal(legacy.status, "Boarding");
  assert.equal(legacy.scheduledDeparture, "2026-09-29T20:10:00.000Z");
  assert.equal(parseFlight({ departure: {} }, "X"), null);
});

test("status normalisation and leg selection", () => {
  const t = "2026-09-29T10:00:00.000Z";
  assert.equal(normalizeStatus("CanceledUncertain", t, t), "Canceled");
  assert.equal(normalizeStatus("EnRoute", t, t), "Departed");
  assert.equal(normalizeStatus("Expected", t, t), "On time");
  const legs = [
    { originIata: "MDW", scheduledDeparture: "2026-09-29T15:00:00Z" },
    { originIata: "BWI", scheduledDeparture: "2026-09-29T12:00:00Z" },
  ] as never[];
  assert.equal((chooseLeg(legs, "mdw") as { originIata: string }).originIata, "MDW");
  assert.equal((chooseLeg(legs) as { originIata: string }).originIata, "BWI");
});

import { detectChanges } from "../../supabase/functions/_shared/changes";

test("change detection produces the right alerts", () => {
  const before = { flight_number: "AA1204", status: "On time", gate: "B12", estimated_departure: "2026-09-29T19:25:00.000Z" };
  const base = {
    flight: "AA1204", airline: "", originIata: "JFK", originName: "", originLat: null, originLon: null,
    originTimeZone: "America/New_York", destinationIata: "LAX", destinationName: "",
    scheduledDeparture: "2026-09-29T19:25:00.000Z", scheduledArrival: null, terminal: "8", durationMinutes: null,
  };
  const delayed = detectChanges(before, { ...base, status: "Delayed", gate: "C4", estimatedDeparture: "2026-09-29T19:55:00.000Z" });
  assert.deepEqual(delayed.map((c) => c.kind), ["delay", "gate"]);
  assert.match(delayed[0].message, /delayed 30 min — now departs 3:55/);
  assert.match(delayed[1].message, /B12 → C4/);

  const same = detectChanges(before, { ...base, status: "On time", gate: "B12", estimatedDeparture: before.estimated_departure });
  assert.equal(same.length, 0);

  const cancel = detectChanges(before, { ...base, status: "Canceled", gate: "B12", estimatedDeparture: before.estimated_departure });
  assert.deepEqual(cancel.map((c) => c.kind), ["cancel"]);
});
