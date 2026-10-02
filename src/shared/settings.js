/**
 * Settings and AbuseIPDB usage storage, shared by every extension context.
 */
globalThis.Settings = {
  DEFAULTS: {
    apiKey: "",
    /**
     * Analyze every column / field whose values are all IP addresses, except
     * `excludedFields`. When off, only the `fieldName` fields are analyzed.
     */
    autoDetect: true,
    /**
     * Analyze every IP of the results, including IPs inside text, in every
     * field except `excludedFields`. Overrides `autoDetect`.
     */
    allIps: false,
    /** Field names analyzed without automatic detection, comma-separated. */
    fieldName: "o365_audit_ClientIP",
    /** Field names never analyzed by automatic detection, comma-separated. */
    excludedFields: "",
    maxAgeDays: 90,
    cacheHours: 24,
    /** Score (%) from which an IP is flagged on the page and counted on the toolbar icon; 0 disables. */
    alertThreshold: 75,
    /** Automatic lookups stop when the account has this many requests left; manual ones still run. */
    quotaReserve: 50,
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

  /** Form values coerced to valid settings; empty or invalid numbers fall back to the defaults. */
  sanitize(raw) {
    const D = this.DEFAULTS;
    const int = (value, min, max, fallback) => {
      const n = Number(value);
      if (String(value ?? "").trim() === "" || !Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    };
    return {
      apiKey: String(raw.apiKey ?? "").trim(),
      autoDetect: typeof raw.autoDetect === "boolean" ? raw.autoDetect : D.autoDetect,
      allIps: typeof raw.allIps === "boolean" ? raw.allIps : D.allIps,
      fieldName: this.fields(raw.fieldName).join(", ") || D.fieldName,
      excludedFields: this.fields(raw.excludedFields).join(", "),
      maxAgeDays: int(raw.maxAgeDays, 1, 365, D.maxAgeDays),
      cacheHours: int(raw.cacheHours, 0, Infinity, D.cacheHours),
      alertThreshold: int(raw.alertThreshold, 0, 100, D.alertThreshold),
      quotaReserve: int(raw.quotaReserve, 0, Infinity, D.quotaReserve),
    };
  },

  /** Field names of a comma-separated setting, trimmed, without case-insensitive duplicates. */
  fields(value) {
    const seen = new Set();
    return String(value ?? "")
      .split(/[,;\n]/)
      .map((f) => f.trim())
      .filter((f) => f && !seen.has(f.toLowerCase()) && seen.add(f.toLowerCase()));
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

  /** Next quota reset formatted as a local time ("02:00"). */
  nextResetTime(now = new Date()) {
    return this.nextReset(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  },

  /**
   * The stored quota snapshot ({ remaining, limit, ts }) as it applies now:
   * a snapshot from a previous UTC day predates the reset, so the full limit
   * is available again. Null when no snapshot exists.
   */
  liveQuota(quota, now = new Date()) {
    if (!quota) return null;
    const stale = this.dayKey(new Date(quota.ts)) !== this.dayKey(now);
    return { remaining: stale ? quota.limit : quota.remaining, limit: quota.limit };
  },
};
