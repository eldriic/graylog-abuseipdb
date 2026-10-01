/**
 * Content script.
 *
 * Finds the configured Graylog field (default `o365_audit_ClientIP`) in result
 * tables and expanded messages, and adds an AbuseIPDB badge next to each IP.
 */
(() => {
  const DEFAULT_FIELD = "o365_audit_ClientIP";
  const DONE_ATTR = "data-abipdb";

  let fieldLabel = DEFAULT_FIELD;
  let fieldName = fieldLabel.toLowerCase();

  const normalize = (el) => el.textContent.replace(/\s+/g, " ").trim().toLowerCase();

  /** Visual column index of a cell, accounting for colspan of previous cells. */
  function visualIndex(cell) {
    let idx = 0;
    for (let c = cell.previousElementSibling; c; c = c.previousElementSibling) idx += c.colSpan || 1;
    return idx;
  }

  function cellAtVisualIndex(row, target) {
    let idx = 0;
    for (const c of row.cells) {
      const span = c.colSpan || 1;
      if (target >= idx && target < idx + span) return c;
      idx += span;
    }
    return null;
  }

  /** Aggregation widgets and message tables: column under a matching <th>. */
  function scanTables() {
    for (const th of document.querySelectorAll("th")) {
      if (normalize(th) !== fieldName) continue;
      const table = th.closest("table");
      if (!table) continue;
      const col = visualIndex(th);
      for (const tbody of table.tBodies) {
        for (const row of tbody.rows) {
          const cell = cellAtVisualIndex(row, col);
          if (cell) decorate(cell);
        }
      }
    }
  }

  /** Expanded message view: <dt>field</dt><dd>value</dd>. */
  function scanDefinitionLists() {
    for (const dt of document.querySelectorAll("dt")) {
      if (normalize(dt) !== fieldName) continue;
      const dd = dt.nextElementSibling;
      if (dd?.tagName === "DD") decorate(dd);
    }
  }

  /** Text of a cell without the badge we added (its score would corrupt the IP). */
  function cellText(cell) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement.closest(".abipdb-badge") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let text = "";
    while (walker.nextNode()) text += walker.currentNode.nodeValue;
    return text;
  }

  function decorate(cell) {
    const match = cellText(cell).match(IpUtils.IP_REGEX);
    if (!match) return;
    const ip = match[0];
    // React may re-render the cell with a new IP; redo only if it changed.
    if (cell.getAttribute(DONE_ATTR) === ip) return;
    cell.querySelectorAll(".abipdb-badge").forEach((b) => b.remove());
    cell.setAttribute(DONE_ATTR, ip);

    const badge = document.createElement("span");
    cell.appendChild(badge);

    if (IpUtils.isPrivate(ip)) {
      badge.className = "abipdb-badge abipdb-private";
      badge.textContent = "privée";
      return;
    }

    badge.className = "abipdb-badge abipdb-loading";
    badge.textContent = "…";

    ext.runtime.sendMessage({ type: "lookup", ip }).then((res) => {
      if (res?.ok) {
        renderBadge(badge, res.data);
      } else {
        badge.className = "abipdb-badge abipdb-error";
        badge.textContent = "erreur";
        badge.title = res?.error || "Erreur inconnue";
      }
    });
  }

  function renderBadge(badge, d) {
    badge.className = `abipdb-badge abipdb-${IpUtils.level(d.score)}`;
    const place = [d.city, d.countryCode].filter(Boolean).join(", ");
    badge.textContent = `${d.score}%${place ? ` · ${place}` : ""}${d.isTor ? " · TOR" : ""}`;
    badge.appendChild(buildTooltip(d));

    // Prevent Graylog's value-actions menu from opening when clicking the badge.
    badge.addEventListener("click", (e) => e.stopPropagation());
  }

  function buildTooltip(d) {
    const rows = [
      ["Score", `${d.score}% (${d.totalReports} signalements, ${d.distinctUsers} sources)`],
      ["Pays", d.countryName && `${d.countryName} (${d.countryCode})`],
      ["Région", d.region],
      ["Ville", d.city],
      ["ISP", d.isp],
      ["Org / ASN", [d.org, d.asn && `AS${d.asn}`].filter(Boolean).join(" · ")],
      ["Domaine", d.domain],
      ["Usage", d.usageType],
      ["Tor", d.isTor ? "Oui" : "Non"],
      ["Whitelist", d.isWhitelisted ? "Oui" : "Non"],
      ["Dernier signalement", d.lastReportedAt ? new Date(d.lastReportedAt).toLocaleString() : "—"],
    ];

    const tip = document.createElement("div");
    tip.className = "abipdb-tooltip";

    const title = document.createElement("div");
    title.className = "abipdb-tooltip-title";
    title.textContent = d.ip;
    tip.appendChild(title);

    for (const [label, value] of rows) {
      if (!value) continue;
      const line = document.createElement("div");
      const key = document.createElement("b");
      key.textContent = `${label} : `;
      line.append(key, String(value));
      tip.appendChild(line);
    }

    const link = document.createElement("a");
    link.href = `https://www.abuseipdb.com/check/${encodeURIComponent(d.ip)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Ouvrir sur AbuseIPDB ↗";
    tip.appendChild(link);
    return tip;
  }

  // Tooltips are `position: fixed` so `overflow: hidden` cells cannot clip them;
  // place the hovered one under its badge (delegated, survives re-renders).
  document.addEventListener("mouseover", (e) => {
    const badge = e.target.closest?.(".abipdb-badge");
    const tip = badge?.querySelector(".abipdb-tooltip");
    if (!tip) return;
    const r = badge.getBoundingClientRect();
    tip.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 440))}px`;
    tip.style.top = `${r.bottom + 4}px`;
  });

  function scan() {
    scanTables();
    scanDefinitionLists();
  }

  // The popup asks which IPs of the field are currently shown on the page.
  ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "getPageIps") return false;
    const ips = [...document.querySelectorAll(`[${DONE_ATTR}]`)].map((el) => el.getAttribute(DONE_ATTR));
    sendResponse({ field: fieldLabel, ips: [...new Set(ips)] });
    return false;
  });

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  ext.storage.local.get("fieldName").then(({ fieldName: f }) => {
    if (f) {
      fieldLabel = f.trim();
      fieldName = fieldLabel.toLowerCase();
    }
    scan();
  });
})();
