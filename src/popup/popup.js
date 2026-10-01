/**
 * Toolbar popup: "Analyse" tab (IPs on the active tab, manual lookup) and
 * "Paramètres" tab (shared settings panel).
 */
const $ = (id) => document.getElementById(id);

const LEVELS = [
  { key: "high", label: "Élevé" },
  { key: "medium", label: "Moyen" },
  { key: "low", label: "Faible" },
  { key: "clean", label: "Propre" },
];

function levelOf(d) {
  if (!d || d.error) return "error";
  if (d.private) return "private";
  return IpUtils.level(d.score);
}

async function lookup(ip) {
  const res = await ext.runtime.sendMessage({ type: "lookup", ip });
  return res.ok ? res.data : { ip, error: res.error };
}

function buildDetails(d) {
  const dl = document.createElement("dl");
  dl.className = "details";
  dl.hidden = true;
  const rows = d.error
    ? [["Erreur", d.error]]
    : d.private
      ? [["Info", "Adresse privée / locale, pas de recherche"]]
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

async function loadPageIps() {
  const empty = $("emptyMsg");
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  let page;
  try {
    page = await ext.tabs.sendMessage(tab.id, { type: "getPageIps" });
  } catch {
    empty.textContent = "Extension non active sur cet onglet.";
    empty.hidden = false;
    return;
  }

  $("fieldName").textContent = page.field;
  if (!page.ips.length) {
    empty.textContent = "Aucune IP trouvée pour ce champ sur la page.";
    empty.hidden = false;
    return;
  }

  empty.textContent = `Chargement de ${page.ips.length} IP…`;
  empty.hidden = false;
  const results = await Promise.all(page.ips.map(lookup));
  empty.hidden = true;

  // Most dangerous first; private and errored IPs at the bottom.
  const rank = (d) => (d.error ? -2 : d.private ? -1 : d.score);
  results.sort((a, b) => rank(b) - rank(a));

  renderSummary(results);
  $("ipList").replaceChildren(...results.map(buildCard));
}

$("lookupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ip = $("ipInput").value.trim();
  if (!ip) return;
  const out = $("lookupResult");
  out.textContent = "Recherche…";
  const card = buildCard(await lookup(ip));
  card.classList.add("open");
  card.querySelector(".details").hidden = false;
  const ul = document.createElement("ul");
  ul.className = "ip-list";
  ul.appendChild(card);
  out.replaceChildren(ul);
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

SettingsPanel.mount($("tab-settings"));
$("tab-settings").addEventListener("settings-saved", async () => {
  const { apiKey } = await Settings.load();
  $("noKey").hidden = !!apiKey;
});

// Without an API key the only useful thing to do is configure it.
Settings.load().then(({ apiKey }) => {
  $("noKey").hidden = !!apiKey;
  showTab(apiKey ? "analysis" : "settings");
});
loadPageIps();
