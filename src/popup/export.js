/**
 * Export of the popup results: plain IP list for the clipboard, CSV file.
 */
globalThis.IpExport = (() => {
  const COLUMNS = [
    ["ip", (d) => d.ip],
    ["statut", (d) => (d.error ? "erreur" : d.private ? "privée" : "ok")],
    ["score", (d) => d.score],
    ["signalements", (d) => d.totalReports],
    ["sources", (d) => d.distinctUsers],
    ["pays", (d) => d.countryCode],
    ["region", (d) => d.region],
    ["ville", (d) => d.city],
    ["isp", (d) => d.isp],
    ["asn", (d) => d.asn && `AS${d.asn}`],
    ["domaine", (d) => d.domain],
    ["usage", (d) => d.usageType],
    ["tor", (d) => d.isTor],
    ["whitelist", (d) => d.isWhitelisted],
    ["dernier_signalement", (d) => d.lastReportedAt],
    ["erreur", (d) => d.error],
  ];

  /**
   * One CSV cell. Text starting with a formula character is prefixed with an
   * apostrophe so spreadsheets do not evaluate it (CSV injection).
   */
  function cell(value) {
    if (value === undefined || value === null) return "";
    let s = typeof value === "boolean" ? (value ? "oui" : "non") : String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  return {
    /** Public IPs that were looked up successfully, one per line. */
    toText(results) {
      return results
        .filter((d) => !d.error && !d.private)
        .map((d) => d.ip)
        .join("\n");
    },

    /**
     * Semicolon-separated CSV with a UTF-8 BOM, the format spreadsheets expect
     * in French locales.
     */
    toCsv(results) {
      const lines = [
        COLUMNS.map(([name]) => name).join(";"),
        ...results.map((d) => COLUMNS.map(([, get]) => cell(get(d))).join(";")),
      ];
      return `﻿${lines.join("\r\n")}\r\n`;
    },
  };
})();
