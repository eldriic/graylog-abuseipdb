/**
 * Toolbar popup: "Analyse" tab (IPs on the active tab, manual lookup, export)
 * and "Paramètres" tab (shared settings panel).
 */
const $ = (id) => document.getElementById(id);

const LEVELS = [
  { key: "high", label: "Élevé" },
  { key: "medium", label: "Moyen" },
  { key: "low", label: "Faible" },
  { key: "clean", label: "Propre" },
];

/** Results of the page IPs, most dangerous first (for the export buttons). */
let pageResults = [];
/** Match pattern of the active tab's site when it is not authorized yet. */
let siteToEnable = null;

function levelOf(d) {
  if (!d || d.error) return "error";
  if (d.private) return "private";
  return IpUtils.level(d.score);
}

/** `manual` lookups may use the quota reserve kept aside for them. */
async function lookup(ip, { manual = false } = {}) {
  const res = await ext.runtime.sendMessage({ type: "lookup", ip, manual });
  return res.ok ? res.data : { ip, error: res.error };
}

function buildDetails(d) {
  const dl = document.createElement("dl");
  dl.className = "details";
  dl.hidden = true;
  const rows = d.error
    ? [["Erreur", d.error]]
    : d.private
      ? [["Info", "Adresse privée ou réservée, pas de recherche"]]
      : [
          ["Signalements", `${d.totalReports} (${d.distinctUsers} sources)`],
          ["Pays", d.countryName && `${d.countryName} (${d.countryCode})`],
          ["Région", d.region],
          ["Ville", d.city],
          ["ISP", d.isp],
          ["Org / ASN", [d.org, d.asn && "AS" + d.asn].filter(Boolean).join(" · ")],
          ["Domaine", d.domain],
          ["Usage", d.usageType],
          ["Tor", d.isTor ? "Oui" : "Non"],
          ["Whitelist", d.isWhitelisted ? "Oui" : "Non"],
          ["Dernier signal.", d.lastReportedAt ? new Date(d.lastReportedAt).toLocaleString() : "—"],
        ];
  for (const [k, v] of rows) {
    if (!v) continue;
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  }
  if (!d.private && !d.error) {
    const a = document.createElement("a");
    a.href = `https://www.abuseipdb.com/check/${encodeURIComponent(d.ip)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Ouvrir sur AbuseIPDB ↗";
    dl.appendChild(a);
  }
  return dl;
}

function buildCard(d) {
  const li = $("ipCardTpl").content.firstElementChild.cloneNode(true);
  const lvl = levelOf(d);
  const score = li.querySelector(".score");
  score.classList.add(`lvl-${lvl}`);
  score.textContent = d.error ? "err" : d.private ? "privée" : `${d.score}%`;
  li.querySelector(".ip").textContent = d.ip;
  li.querySelector(".place").textContent = d.error || d.private
    ? ""
    : [d.city, d.countryCode].filter(Boolean).join(", ") + (d.isTor ? " · TOR" : "");

  const details = buildDetails(d);
  li.querySelector(".details").replaceWith(details);
  li.querySelector(".ip-row").addEventListener("click", () => {
    details.hidden = !details.hidden;
    li.classList.toggle("open", !details.hidden);
  });
  return li;
}

function renderSummary(results) {
  const summary = $("summary");
  summary.replaceChildren();
  for (const l of LEVELS) {
    const n = results.filter((d) => levelOf(d) === l.key).length;
    if (!n) continue;
    const s = document.createElement("span");
    s.className = `lvl-${l.key}`;
    s.textContent = `${l.label} : ${n}`;
    summary.appendChild(s);
  }
}

function setResults(results) {
  pageResults = results;
  renderSummary(results);
  $("ipList").replaceChildren(...results.map(buildCard));
  $("copyIps").disabled = !IpExport.toText(results);
  $("exportCsv").disabled = !results.length;
}

function showEmpty(text) {
  $("emptyMsg").textContent = text;
  $("emptyMsg").hidden = !text;
}

async function loadPageIps() {
  setResults([]);
  showEmpty("");
  $("siteBanner").hidden = true;

  // The URL of the active tab is visible thanks to activeTab (popup opened by the user).
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const site = tab?.url ? Sites.patternFor(tab.url) : null;
  if (!site) return showEmpty("Cette page ne peut pas être analysée.");
  if (!(await ext.permissions.contains({ origins: [site] }))) {
    siteToEnable = site;
    $("siteHost").textContent = new URL(tab.url).hostname;
    $("siteBanner").hidden = false;
    return showEmpty("");
  }

  let page;
  try {
    page = await ext.tabs.sendMessage(tab.id, { type: "getPageIps", rescan: true });
  } catch {
    return showEmpty("Rechargez la page pour lancer l'analyse.");
  }

  const except = page.excluded.length ? ` (sauf ${page.excluded.join(", ")})` : "";
  $("fieldName").textContent = page.allIps
    ? `Toutes les IP${except}`
    : page.autoDetect
      ? `Détection auto${except}`
      : page.fields.join(", ");
  if (!page.ips.length) return showEmpty("Aucune IP trouvée pour ce champ sur la page.");

  showEmpty(`Chargement de ${page.ips.length} IP…`);
  const results = await Promise.all(page.ips.map((ip) => lookup(ip)));
  showEmpty("");

  // Most dangerous first; private and errored IPs at the bottom.
  const rank = (d) => (d.error ? -2 : d.private ? -1 : d.score);
  results.sort((a, b) => rank(b) - rank(a));
  setResults(results);
}

$("enableSite").addEventListener("click", () => {
  const origins = [siteToEnable];
  // Nothing may be awaited before request(): Firefox requires it to run within
  // the click. Firefox may also close the popup to show its prompt; the
  // background then activates the site on its own (permissions.onAdded).
  ext.permissions.request({ origins }).then(async (granted) => {
    if (!granted) return;
    await ext.runtime.sendMessage({ type: "enableSites", origins });
    refresh();
  });
});

async function manualLookup() {
  const out = $("lookupResult");
  const ip = IpUtils.find($("ipInput").value);
  if (!ip) {
    const msg = document.createElement("div");
    msg.className = "status small";
    msg.dataset.kind = "error";
    msg.textContent = "Aucune adresse IP valide dans la saisie.";
    out.replaceChildren(msg);
    return;
  }
  $("ipInput").value = ip;
  out.textContent = "Recherche…";
  const card = buildCard(await lookup(ip, { manual: true }));
  card.classList.add("open");
  card.querySelector(".details").hidden = false;
  const ul = document.createElement("ul");
  ul.className = "ip-list";
  ul.appendChild(card);
  out.replaceChildren(ul);
}

$("lookupForm").addEventListener("submit", (e) => {
  e.preventDefault();
  manualLookup();
});

/** Temporary confirmation in a button's label. */
function flash(button, text) {
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => (button.textContent = original), 1500);
}

$("copyIps").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(IpExport.toText(pageResults));
    flash($("copyIps"), "✓ Copié");
  } catch {
    flash($("copyIps"), "Échec");
  }
});

$("exportCsv").addEventListener("click", () => {
  const blob = new Blob([IpExport.toCsv(pageResults)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `abuseipdb-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
});

function showTab(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
    $(`tab-${tab.dataset.tab}`).hidden = !active;
  }
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}
$("noKeyLink").addEventListener("click", (e) => {
  e.preventDefault();
  showTab("settings");
});

async function refresh() {
  const btn = $("refresh");
  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.add("spinning");
  try {
    await loadPageIps();
  } finally {
    btn.disabled = false;
    btn.classList.remove("spinning");
  }
}
$("refresh").addEventListener("click", refresh);

SettingsPanel.mount($("tab-settings"));
$("tab-settings").addEventListener("settings-saved", async () => {
  const { apiKey } = await Settings.load();
  $("noKey").hidden = !!apiKey;
});

async function init() {
  const { apiKey } = await Settings.load();
  $("noKey").hidden = !!apiKey;
  // Without an API key the only useful thing to do is configure it.
  showTab(apiKey ? "analysis" : "settings");

  // Text selected on a page and sent here by the "Vérifier sur AbuseIPDB" context menu.
  const { text } = await ext.runtime.sendMessage({ type: "takePendingLookup" });
  if (text) {
    $("ipInput").value = text;
    if (apiKey) manualLookup();
  }
}

init();
refresh();
