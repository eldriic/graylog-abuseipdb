/**
 * Graylog sites the user authorized. The extension has no access to web pages
 * by default: each Graylog instance is granted as an optional host permission,
 * and the content script only runs on those origins.
 */
globalThis.Sites = {
  /** Required host permissions of the lookup services, never Graylog sites. */
  API_ORIGINS: ["https://api.abuseipdb.com/*", "https://ipwho.is/*"],

  /**
   * Match pattern covering the site of a URL ("https://graylog.example/*"), or
   * null for anything but http(s). The scheme defaults to https; the port is
   * dropped because match patterns do not support it.
   */
  patternFor(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return null;
    let url;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    return `${url.protocol}//${url.hostname}/*`;
  },

  /** Human-readable form of a match pattern. */
  label(pattern) {
    if (pattern === "<all_urls>" || /^\*:\/\/\*\/\*$/.test(pattern)) return "Tous les sites";
    return pattern.replace(/\/\*$/, "");
  },

  /** Match patterns of the authorized Graylog sites. */
  async list() {
    const { origins = [] } = await ext.permissions.getAll();
    return origins.filter((o) => !this.API_ORIGINS.includes(o)).sort();
  },
};
