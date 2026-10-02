import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/shared/settings.js";

const { Settings } = globalThis;

describe("Settings.fields", () => {
  it("splits, trims and de-duplicates case-insensitively", () => {
    assert.deepEqual(Settings.fields(" src_ip, o365_audit_ClientIP ;SRC_IP,,"), ["src_ip", "o365_audit_ClientIP"]);
  });

  it("returns an empty list for empty input", () => {
    assert.deepEqual(Settings.fields(""), []);
    assert.deepEqual(Settings.fields(undefined), []);
  });
});

describe("Settings.sanitize", () => {
  it("clamps numbers and trims text", () => {
    assert.deepEqual(
      Settings.sanitize({
        apiKey: "  key  ",
        fieldName: "a, b",
        excludedFields: " source ;SOURCE, dstip ",
        maxAgeDays: "999",
        cacheHours: "-3",
        alertThreshold: "150",
        quotaReserve: "12.6",
      }),
      { apiKey: "key", autoDetect: true, allIps: false, fieldName: "a, b", excludedFields: "source, dstip", maxAgeDays: 365, cacheHours: 0, alertThreshold: 100, quotaReserve: 13 },
    );
  });

  it("falls back to the defaults for empty or invalid values", () => {
    const s = Settings.sanitize({ fieldName: " ", maxAgeDays: "", cacheHours: "abc", alertThreshold: "", quotaReserve: "" });
    assert.equal(s.fieldName, Settings.DEFAULTS.fieldName);
    assert.equal(s.excludedFields, "");
    assert.equal(s.maxAgeDays, Settings.DEFAULTS.maxAgeDays);
    assert.equal(s.cacheHours, Settings.DEFAULTS.cacheHours);
    assert.equal(s.alertThreshold, Settings.DEFAULTS.alertThreshold);
    assert.equal(s.quotaReserve, Settings.DEFAULTS.quotaReserve);
  });

  it("keeps the switch state and defaults automatic detection to on", () => {
    assert.equal(Settings.sanitize({ autoDetect: false }).autoDetect, false);
    assert.equal(Settings.sanitize({ autoDetect: true }).autoDetect, true);
    assert.equal(Settings.sanitize({ autoDetect: "off" }).autoDetect, true);
    assert.equal(Settings.sanitize({}).autoDetect, true);
  });

  it("keeps the all-IPs switch state and defaults it to off", () => {
    assert.equal(Settings.sanitize({ allIps: true }).allIps, true);
    assert.equal(Settings.sanitize({ allIps: "on" }).allIps, false);
    assert.equal(Settings.sanitize({}).allIps, false);
  });

  it("keeps 0 as a valid value", () => {
    const s = Settings.sanitize({ cacheHours: "0", alertThreshold: "0", quotaReserve: "0" });
    assert.equal(s.cacheHours, 0);
    assert.equal(s.alertThreshold, 0);
    assert.equal(s.quotaReserve, 0);
  });
});

describe("UTC days", () => {
  const now = new Date("2026-10-02T23:30:00Z");

  it("buckets by UTC day", () => {
    assert.equal(Settings.dayKey(now), "2026-10-02");
  });

  it("lists the last days, oldest first", () => {
    assert.deepEqual(Settings.lastDays(3, now), ["2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("resets at the next 00:00 UTC", () => {
    assert.equal(Settings.nextReset(now).toISOString(), "2026-10-03T00:00:00.000Z");
  });
});

describe("Settings.liveQuota", () => {
  const now = new Date("2026-10-02T12:00:00Z");

  it("returns null without a snapshot", () => {
    assert.equal(Settings.liveQuota(undefined, now), null);
  });

  it("uses a snapshot from the same UTC day", () => {
    const quota = { remaining: 12, limit: 1000, ts: Date.parse("2026-10-02T08:00:00Z") };
    assert.deepEqual(Settings.liveQuota(quota, now), { remaining: 12, limit: 1000 });
  });

  it("restores the full limit after the daily reset", () => {
    const quota = { remaining: 0, limit: 1000, ts: Date.parse("2026-10-01T23:59:00Z") };
    assert.deepEqual(Settings.liveQuota(quota, now), { remaining: 1000, limit: 1000 });
  });
});
