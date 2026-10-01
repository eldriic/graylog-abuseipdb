/**
 * Settings and AbuseIPDB usage storage, shared by every extension context.
 */
globalThis.Settings = {
  DEFAULTS: {
    apiKey: "",
    fieldName: "o365_audit_ClientIP",
    maxAgeDays: 90,
    cacheHours: 24,
  },

  /** Days of per-day request counts kept in storage. */
  USAGE_RETENTION_DAYS: 30,

  async load() {
    const stored = await ext.storage.local.get(Object.keys(this.DEFAULTS));
    return { ...this.DEFAULTS, ...stored };
  },

  save(values) {
    return ext.storage.local.set(values);
  },

  /**
   * AbuseIPDB daily quotas reset at 00:00 UTC, so usage is bucketed by UTC day
   * ("YYYY-MM-DD").
   */
  dayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  },

  /** The last `n` UTC day keys, oldest first. */
  lastDays(n, now = new Date()) {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Array.from({ length: n }, (_, i) => this.dayKey(new Date(today - (n - 1 - i) * 864e5)));
  },

  /** Next quota reset (00:00 UTC) as a Date, for display in local time. */
  nextReset(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  },
};
