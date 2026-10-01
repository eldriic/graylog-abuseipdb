/**
 * IP helpers shared by the background, content script and popup.
 */
globalThis.IpUtils = {
  /**
   * First IPv4 or IPv6 address found in a string. IPv6 must be either the full
   * 8-group form or contain "::", so times such as "14:06:29" never match.
   */
  IP_REGEX: new RegExp(
    [
      String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`,
      String.raw`(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}`,
      String.raw`(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?`,
      String.raw`::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?`,
    ].join("|"),
    "i",
  ),

  /** RFC 1918 / loopback / link-local / ULA: never sent to external services. */
  isPrivate(ip) {
    return (
      /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(ip) ||
      /^(::1$|fe80:|f[cd][0-9a-f]{2}:)/i.test(ip)
    );
  },

  /** Risk level used for colours: clean (0), low (1-24), medium (25-74), high (75+). */
  level(score) {
    if (score >= 75) return "high";
    if (score >= 25) return "medium";
    if (score > 0) return "low";
    return "clean";
  },
};
