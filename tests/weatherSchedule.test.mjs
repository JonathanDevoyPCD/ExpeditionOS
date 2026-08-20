import assert from "node:assert/strict";
import test from "node:test";
import { addIsoDays, forecastHoursToCover, localForecastDate, tripDaysBetween, tripEndDate } from "../src/lib/weatherSchedule.mjs";

test("trip schedule derives an inclusive end date and duration", () => {
  assert.equal(tripEndDate("2026-08-24", 4), "2026-08-27");
  assert.equal(tripDaysBetween("2026-08-24", "2026-08-27"), 4);
  assert.equal(addIsoDays("2026-08-31", 1), "2026-09-01");
  assert.equal(tripDaysBetween("2026-08-27", "2026-08-24"), undefined);
});

test("forecast coverage grows with the selected trip and respects Google's 240-hour horizon", () => {
  const now = new Date("2026-08-20T10:00:00Z");
  assert.equal(forecastHoursToCover("2026-08-20", now), 24);
  assert.equal(forecastHoursToCover("2026-08-24", now), 111);
  assert.equal(forecastHoursToCover("2026-09-20", now), 240);
});

test("forecast timestamps resolve to the selected location's local date", () => {
  assert.equal(localForecastDate("2026-08-20T22:00:00Z", "Africa/Johannesburg"), "2026-08-21");
  assert.equal(localForecastDate("2026-08-21T07:00", "Africa/Johannesburg"), "2026-08-21");
});
