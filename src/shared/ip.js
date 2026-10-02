/**
 * IP helpers shared by the background, content script and popup.
 */
globalThis.IpUtils = (() => {
  /**
   * IPv4 or IPv6 candidates. IPv6 must be the full 8-group form, contain "::"
   * or be IPv4-mapped, so times such as "14:06:29" never match. Candidates are
   * then validated (octets <= 255, at most 8 groups).
   */
  const IP_REGEX = new RegExp(
    [
      String.raw`::ffff:(?:\d{1,3}\.){3}\d{1,3}\b`,
      String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`,
      String.raw`(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}`,
      String.raw`(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?`,
      String.raw`::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?`,
    ].join("|"),
    "gi",
  );

  /** IPv4 ranges that are not publicly routable (IANA special-purpose registry). */
  const RESERVED_V4 = [
    ["0.0.0.0", 8], // "this network"
    ["10.0.0.0", 8], // RFC 1918
    ["100.64.0.0", 10], // carrier-grade NAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local
    ["172.16.0.0", 12], // RFC 1918
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.0.2.0", 24], // documentation (TEST-NET-1)
    ["192.168.0.0", 16], // RFC 1918
    ["198.18.0.0", 15], // benchmarking
    ["198.51.100.0", 24], // documentation (TEST-NET-2)
    ["203.0.113.0", 24], // documentation (TEST-NET-3)
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved, broadcast
  ].map(([base, bits]) => {
    const mask = bits ? (~0 << (32 - bits)) >>> 0 : 0;
    return { net: (toInt(parseV4(base)) & mask) >>> 0, mask };
  });

  /** Four octets, or null if `ip` is not a valid dotted-quad IPv4 address. */
  function parseV4(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (!m) return null;
    const octets = m.slice(1).map(Number);
    return octets.every((o) => o <= 255) ? octets : null;
  }

  function toInt(octets) {
    return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  }

  /** Eight 16-bit groups, or null if `ip` is not a valid IPv6 address. */
  function parseV6(ip) {
    let s = ip.toLowerCase();
    let tail = [];
    const v4 = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(s);
    if (v4) {
      const o = parseV4(v4[1]);
      if (!o) return null;
      tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
      s = s.slice(0, -v4[1].length);
      if (s.endsWith(":") && !s.endsWith("::")) s = s.slice(0, -1);
    }

    const halves = s.split("::");
    if (halves.length > 2) return null;
    const groups = (part) =>
      part ? part.split(":").map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)) : [];
    const head = groups(halves[0]);
    const back = halves.length === 2 ? [...groups(halves[1]), ...tail] : [];
    if (halves.length === 1) head.push(...tail);
    if ([...head, ...back].some(Number.isNaN)) return null;

    const missing = 8 - head.length - back.length;
    // Without "::" all 8 groups are explicit; "::" stands for at least one group.
    if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
    return [...head, ...new Array(missing).fill(0), ...back];
  }

  function isReservedV4(octets) {
    const n = toInt(octets);
    return RESERVED_V4.some(({ net, mask }) => ((n & mask) >>> 0) === net);
  }

  function isReservedV6(g) {
    if (g.slice(0, 7).every((x) => x === 0) && g[7] <= 1) return true; // :: and ::1
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
      // IPv4-mapped (::ffff:a.b.c.d): judge the embedded IPv4 address.
      return isReservedV4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
    }
    return (
      (g[0] & 0xffc0) === 0xfe80 || // link-local
      (g[0] & 0xfe00) === 0xfc00 || // unique local (ULA)
      (g[0] & 0xff00) === 0xff00 || // multicast
      (g[0] === 0x2001 && g[1] === 0x0db8) // documentation
    );
  }

  return {
    isValid(ip) {
      return Boolean(parseV4(ip) || parseV6(ip));
    },

    /** First valid IPv4 or IPv6 address found in a string, or null. */
    find(text) {
      return this.findAll(text)[0] ?? null;
    },

    /** Every valid IPv4 or IPv6 address found in a string, without duplicates, in order. */
    findAll(text) {
      const ips = new Set();
      for (const [candidate] of String(text ?? "").matchAll(IP_REGEX)) {
        if (this.isValid(candidate)) ips.add(candidate);
      }
      return [...ips];
    },

    /**
     * Private or reserved address (RFC 1918, CGNAT, loopback, link-local, ULA,
     * multicast, documentation…): never sent to external services. Invalid
     * input is treated as reserved.
     */
    isPrivate(ip) {
      const v4 = parseV4(ip);
      if (v4) return isReservedV4(v4);
      const v6 = parseV6(ip);
      return v6 ? isReservedV6(v6) : true;
    },

    /** Risk level used for colours: clean (0), low (1-24), medium (25-74), high (75+). */
    level(score) {
      if (score >= 75) return "high";
      if (score >= 25) return "medium";
      if (score > 0) return "low";
      return "clean";
    },
  };
})();
