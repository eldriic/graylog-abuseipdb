/**
 * Background script (Firefox event page / Chromium service worker).
 *
 * Performs every network lookup so requests are not subject to the Graylog
 * page's CORS / CSP rules, caches results in storage.local, records daily
 * AbuseIPDB usage and protects the quota. It also registers the content script
 * on the authorized Graylog sites, owns the context menu and the toolbar badge.
 */

// Chromium service workers load shared helpers here; Firefox loads them via the manifest.
if (typeof importScripts === "function") {
  importScripts("/shared/api.js", "/shared/ip.js", "/shared/settings.js", "/shared/sites.js");
}

const CACHE_PREFIX = "cache:";
const CACHE_PURGE_INTERVAL_MS = 3600e3;
const MAX_CONCURRENT_LOOKUPS = 4;
const MENU_ID = "lookup-selection";
const CONTENT_SCRIPT = {
  id: "graylog",
  js: ["shared/api.js", "shared/ip.js", "shared/settings.js", "content/content.js"],
  css: ["content/content.css"],
};

// Manifest V3 (Chromium) / Manifest V2 (Firefox).
const action = ext.action ?? ext.browserAction;

/** Error carrying a machine-readable code ("quota") for the UI. */
class LookupError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const abuseUrl = (ip) => `https://www.abuseipdb.com/check/${encodeURIComponent(ip)}`;

/* -------------------------------------------------------------------------- */
/* Usage and quota                                                            */
/* -------------------------------------------------------------------------- */

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

/** Refuses a lookup before it reaches AbuseIPDB when the quota cannot afford it. */
async function checkQuota({ quotaReserve }, manual) {
  const quota = Settings.liveQuota((await ext.storage.local.get("quota")).quota);
  if (!quota) return;
  const reset = Settings.nextResetTime();
  if (quota.remaining <= 0) {
    throw new LookupError(`Quota AbuseIPDB épuisé, réinitialisation à ${reset}.`, "quota");
  }
  if (!manual && quota.remaining <= quotaReserve) {
    throw new LookupError(
      `Réserve de quota atteinte (${quota.remaining} requêtes restantes) : recherches ` +
        `automatiques suspendues jusqu'à ${reset}. La recherche manuelle reste possible.`,
      "quota",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

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
    const detail = body?.errors?.[0]?.detail || `HTTP ${res.status}`;
    throw new LookupError(`AbuseIPDB: ${detail}`, res.status === 429 ? "quota" : undefined);
  }
  return body.data;
}

// AbuseIPDB does not return the city, so geolocation comes from ipwho.is.
async function fetchGeo(ip) {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? body : null;
  } catch {
    return null;
  }
}

// At most MAX_CONCURRENT_LOOKUPS requests in flight: a large Graylog page must
// not fire hundreds of requests at once, and the quota check stays meaningful.
let activeLookups = 0;
const waitingLookups = [];

async function withLookupSlot(fn) {
  if (activeLookups < MAX_CONCURRENT_LOOKUPS) activeLookups++;
  else await new Promise((resolve) => waitingLookups.push(resolve));
  try {
    return await fn();
  } finally {
    // Hand the slot over directly so no newcomer can overtake a waiting lookup.
    const next = waitingLookups.shift();
    if (next) next();
    else activeLookups--;
  }
}

/**
 * Reputation and geolocation of an IP. `manual` lookups (typed by the user)
 * may use the quota reserve; automatic ones (page scan) may not.
 */
async function lookup(ip, { manual = false } = {}) {
  if (!IpUtils.isValid(ip)) throw new LookupError(`Adresse IP invalide : ${ip}`);
  if (IpUtils.isPrivate(ip)) return { ip, private: true };

  const settings = await Settings.load();
  if (!settings.apiKey) {
    throw new LookupError("Clé API AbuseIPDB manquante (voir les paramètres de l'extension)");
  }
  purgeCacheThrottled(settings.cacheHours);

  const cacheKey = CACHE_PREFIX + ip;
  const cached = (await ext.storage.local.get(cacheKey))[cacheKey];
  if (isFresh(cached, settings.cacheHours)) return cached.data;

  return withLookupSlot(async () => {
    await checkQuota(settings, manual);
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
    if (settings.cacheHours > 0) {
      await ext.storage.local.set({ [cacheKey]: { ts: Date.now(), data } });
    }
    return data;
  });
}

const inflight = new Map();

/** Deduplicates concurrent lookups of the same IP (same IP on many rows). */
function lookupOnce(ip, options = {}) {
  const key = `${options.manual ? "manual" : "auto"}:${ip}`;
  if (!inflight.has(key)) {
    inflight.set(key, lookup(ip, options).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

/** Validates an API key with a single real request (counts against the quota). */
async function testKey(apiKey) {
  await fetchAbuse("8.8.8.8", { apiKey, maxAgeDays: 1 });
  const { quota } = await ext.storage.local.get("quota");
  return quota;
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

function isFresh(entry, cacheHours) {
  return Boolean(entry) && Date.now() - entry.ts < cacheHours * 3600e3;
}

/** Removes cache entries older than `cacheHours` (all of them with 0). */
async function purgeCache(cacheHours) {
  const all = await ext.storage.local.get(null);
  const expired = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX) && !isFresh(all[k], cacheHours));
  if (expired.length) await ext.storage.local.remove(expired);
}

let lastPurge = 0;

/** Expired entries are never read again; drop them at most once an hour. */
function purgeCacheThrottled(cacheHours) {
  if (Date.now() - lastPurge < CACHE_PURGE_INTERVAL_MS) return;
  lastPurge = Date.now();
  purgeCache(cacheHours).catch((err) => console.error("Cache purge failed:", err));
}

/* -------------------------------------------------------------------------- */
/* Graylog sites                                                              */
/* -------------------------------------------------------------------------- */

// Registration and injection are read-modify-write sequences: run them one at a time.
let sitesQueue = Promise.resolve();

function enqueueSites(task) {
  sitesQueue = sitesQueue.catch(() => {}).then(task);
  return sitesQueue;
}

/** Registers the content script on exactly the authorized Graylog sites. */
async function syncContentScript() {
  const matches = await Sites.list();
  const [current] = await ext.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT.id] });
  if (!matches.length) {
    if (current) await ext.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT.id] });
    return;
  }
  if (!current) {
    await ext.scripting.registerContentScripts([
      { ...CONTENT_SCRIPT, matches, runAt: "document_idle", persistAcrossSessions: true },
    ]);
  } else if (current.matches.length !== matches.length || !matches.every((m) => current.matches.includes(m))) {
    await ext.scripting.updateContentScripts([{ id: CONTENT_SCRIPT.id, matches }]);
  }
}

/** Starts the content script in already open tabs of newly authorized sites. */
async function injectIntoOpenTabs(origins) {
  const patterns = origins.filter((o) => !Sites.API_ORIGINS.includes(o));
  if (!patterns.length) return;
  const tabs = await ext.tabs.query({ url: patterns });
  await Promise.allSettled(
    tabs.map(async ({ id: tabId }) => {
      const [probe] = await ext.scripting.executeScript({
        target: { tabId },
        func: () => globalThis.__abipdbContent === true,
      });
      if (probe?.result) return;
      await ext.scripting.insertCSS({ target: { tabId }, files: CONTENT_SCRIPT.css });
      await ext.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT.js });
    }),
  );
}

function enableSites(origins) {
  return enqueueSites(async () => {
    await syncContentScript();
    await injectIntoOpenTabs(origins);
  });
}

// Granted from the popup, the settings or the browser's own site-access UI.
ext.permissions.onAdded.addListener(({ origins = [] }) => enableSites(origins));
ext.permissions.onRemoved.addListener(() => enqueueSites(syncContentScript));

/* -------------------------------------------------------------------------- */
/* Context menu                                                               */
/* -------------------------------------------------------------------------- */

// Selected text waiting for the popup, which asks for it when it opens.
let pendingLookup = null;

ext.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) return;
  pendingLookup = text;

  // Firefox only allows openPopup() synchronously within the user action, so
  // nothing may be awaited before it. Older Chromium versions lack it.
  let opening;
  try {
    opening = Promise.resolve(action.openPopup());
  } catch (err) {
    opening = Promise.reject(err);
  }
  opening.catch(() => {
    pendingLookup = null;
    const ip = IpUtils.find(text);
    if (ip) ext.tabs.create({ url: abuseUrl(ip) });
  });
});

/* -------------------------------------------------------------------------- */
/* Setup and messages                                                         */
/* -------------------------------------------------------------------------- */

async function setup() {
  await ext.contextMenus.removeAll();
  ext.contextMenus.create({ id: MENU_ID, title: "Vérifier « %s » sur AbuseIPDB", contexts: ["selection"] });
  action.setBadgeBackgroundColor({ color: "#c62828" });
  action.setBadgeTextColor({ color: "#ffffff" });
  await enqueueSites(syncContentScript);
  await purgeCache((await Settings.load()).cacheHours);
}

ext.runtime.onInstalled.addListener(setup);
ext.runtime.onStartup.addListener(setup);

/** Replies with `{ ok: true, ...result }` or `{ ok: false, error, code }`. */
function reply(promise, sendResponse) {
  promise.then(
    (result) => sendResponse({ ok: true, ...result }),
    (err) => sendResponse({ ok: false, error: err.message, code: err.code }),
  );
  return true;
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg?.type) {
    case "lookup":
      return reply(
        lookupOnce(msg.ip, { manual: Boolean(msg.manual) }).then((data) => ({ data })),
        sendResponse,
      );
    case "testKey":
      return reply(
        testKey(msg.apiKey).then((quota) => ({ quota })),
        sendResponse,
      );
    case "clearCache":
      return reply(purgeCache(0), sendResponse);
    case "enableSites":
      return reply(enableSites(msg.origins ?? []), sendResponse);
    case "takePendingLookup":
      sendResponse({ ok: true, text: pendingLookup });
      pendingLookup = null;
      return false;
    case "pageStats":
      // Number of IPs above the alert threshold on that tab, on the toolbar icon.
      if (sender.tab?.id !== undefined) {
        action.setBadgeText({ tabId: sender.tab.id, text: msg.alerts > 0 ? String(msg.alerts) : "" });
      }
      return false;
    default:
      return false;
  }
});
