/**
 * Background script (Firefox event page / Chromium service worker).
 *
 * Performs every network lookup so requests are not subject to the Graylog
 * page's CORS / CSP rules, caches results in storage.local and records daily
 * AbuseIPDB usage.
 */

// Chromium service workers load shared helpers here; Firefox loads them via the manifest.
if (typeof importScripts === "function") {
  importScripts("/shared/api.js", "/shared/ip.js", "/shared/settings.js");
}

const CACHE_PREFIX = "cache:";
const inflight = new Map();

// Storage has no atomic increment: chain updates so parallel lookups don't lose counts.
let usageQueue = Promise.resolve();

function recordUsage() {
  usageQueue = usageQueue.then(async () => {
    const { usage = {} } = await ext.storage.local.get("usage");
    const today = Settings.dayKey();
    usage[today] = (usage[today] || 0) + 1;
    const keep = new Set(Settings.lastDays(Settings.USAGE_RETENTION_DAYS));
    for (const day of Object.keys(usage)) if (!keep.has(day)) delete usage[day];
    await ext.storage.local.set({ usage });
  });
  return usageQueue;
}

async function fetchAbuse(ip, { apiKey, maxAgeDays }) {
  const url =
    `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}` +
    `&maxAgeInDays=${maxAgeDays}&verbose`;
  const res = await fetch(url, {
    headers: { Key: apiKey, Accept: "application/json" },
  });
  // Rejected requests (invalid key, rate limited) do not consume the quota.
  if (res.ok) await recordUsage();

  const remaining = res.headers.get("X-RateLimit-Remaining");
  if (remaining !== null) {
    const limit = Number(res.headers.get("X-RateLimit-Limit"));
    await ext.storage.local.set({ quota: { remaining: Number(remaining), limit, ts: Date.now() } });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`AbuseIPDB: ${body?.errors?.[0]?.detail || `HTTP ${res.status}`}`);
  }
  return body.data;
}

// AbuseIPDB does not return the city, so geolocation comes from ipwho.is.
async function fetchGeo(ip) {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    const body = await res.json();
    return body.success ? body : null;
  } catch {
    return null;
  }
}

async function lookup(ip) {
  if (IpUtils.isPrivate(ip)) return { ip, private: true };

  const settings = await Settings.load();
  if (!settings.apiKey) {
    throw new Error("Clé API AbuseIPDB manquante (voir les paramètres de l'extension)");
  }

  const cacheKey = CACHE_PREFIX + ip;
  const cached = (await ext.storage.local.get(cacheKey))[cacheKey];
  if (cached && Date.now() - cached.ts < settings.cacheHours * 3600 * 1000) {
    return cached.data;
  }

  const [abuse, geo] = await Promise.all([fetchAbuse(ip, settings), fetchGeo(ip)]);
  const data = {
    ip,
    score: abuse.abuseConfidenceScore,
    totalReports: abuse.totalReports,
    distinctUsers: abuse.numDistinctUsers,
    lastReportedAt: abuse.lastReportedAt,
    isp: abuse.isp,
    domain: abuse.domain,
    usageType: abuse.usageType,
    isTor: abuse.isTor,
    isWhitelisted: abuse.isWhitelisted,
    countryCode: abuse.countryCode || geo?.country_code,
    countryName: abuse.countryName || geo?.country,
    city: geo?.city,
    region: geo?.region,
    asn: geo?.connection?.asn,
    org: geo?.connection?.org,
  };
  await ext.storage.local.set({ [cacheKey]: { ts: Date.now(), data } });
  return data;
}

/** Deduplicates concurrent lookups of the same IP (same IP on many rows). */
function lookupOnce(ip) {
  if (!inflight.has(ip)) {
    inflight.set(ip, lookup(ip).finally(() => inflight.delete(ip)));
  }
  return inflight.get(ip);
}

/** Validates an API key with a single real request (counts against the quota). */
async function testKey(apiKey) {
  await fetchAbuse("8.8.8.8", { apiKey, maxAgeDays: 1 });
  const { quota } = await ext.storage.local.get("quota");
  return quota;
}

async function clearCache() {
  const all = await ext.storage.local.get(null);
  await ext.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX)));
}

ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case "lookup":
      lookupOnce(msg.ip).then(
        (data) => sendResponse({ ok: true, data }),
        (err) => sendResponse({ ok: false, error: err.message }),
      );
      return true;
    case "testKey":
      testKey(msg.apiKey).then(
        (quota) => sendResponse({ ok: true, quota }),
        (err) => sendResponse({ ok: false, error: err.message }),
      );
      return true;
    case "clearCache":
      clearCache().then(() => sendResponse({ ok: true }));
      return true;
    default:
      return false;
  }
});
