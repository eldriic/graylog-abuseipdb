/**
 * Content script, registered only on the Graylog sites the user authorized.
 *
 * Finds the IPs of Graylog result tables and expanded messages — in every field
 * whose values are all IP addresses (automatic detection, default), in every
 * field including IPs inside text ("all IPs"), or in the listed fields only —
 * adds an AbuseIPDB badge next to each IP and highlights table rows whose
 * score reaches the alert threshold.
 */
(() => {
  // Injected again when a site is authorized while its tab is already open.
  if (globalThis.__abipdbContent) return;
  globalThis.__abipdbContent = true;

  // Decorated cell: space-separated IPs it holds. Each badge carries its own
  // data-ip, and data-score or data-error once its lookup is done.
  const IP_ATTR = "data-abipdb";
  const ALERT_ROW_CLASS = "abipdb-alert-row";

  let fieldLabels = [];
  let fieldKeys = new Set();
  let excludedLabels = [];
  let excludedKeys = new Set();
  let autoDetect = Settings.DEFAULTS.autoDetect;
  let allIps = Settings.DEFAULTS.allIps;
  let alertThreshold = Settings.DEFAULTS.alertThreshold;

  const normalize = (el) => el.textContent.replace(/\s+/g, " ").trim().toLowerCase();
  const isAlert = (score) => alertThreshold > 0 && score >= alertThreshold;

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

  /** Text that is exactly one IP address (an IP within a sentence does not count). */
  const isIpOnly = (text) => IpUtils.isValid(text.trim());

  /** Whether a field can be analyzed at all, before looking at its values. */
  function isCandidate(name) {
    if (!autoDetect && !allIps) return fieldKeys.has(name);
    // Graylog's internal gl2_* metadata (e.g. gl2_remote_ip, the log sender) is left out.
    return !excludedKeys.has(name) && !name.startsWith("gl2_");
  }

  /**
   * Listed fields, and every field in "all IPs" mode, are analyzed whatever
   * their values. With automatic detection, a field qualifies when all its
   * non-empty values are IP addresses (aggregations leave grouped cells empty).
   */
  function isIpField(name, valueCells) {
    if (!isCandidate(name)) return false;
    if (allIps || !autoDetect) return true;
    const values = valueCells.map((c) => cellText(c).trim()).filter(Boolean);
    return values.length > 0 && values.every(isIpOnly);
  }

  /** Aggregation widgets and message tables: column under a matching <th>. */
  function scanTables(retryErrors) {
    for (const th of document.querySelectorAll("th")) {
      const name = normalize(th);
      if (!isCandidate(name)) continue;
      const table = th.closest("table");
      if (!table) continue;
      const col = visualIndex(th);
      const cells = [];
      for (const tbody of table.tBodies) {
        for (const row of tbody.rows) {
          const cell = cellAtVisualIndex(row, col);
          // A cell spanning columns is not a field value (e.g. an expanded message).
          if (cell && (cell.colSpan || 1) === 1) cells.push(cell);
        }
      }
      if (isIpField(name, cells)) {
        cells.forEach((cell) => decorate(cell, retryErrors));
      }
    }
  }

  /** Expanded message view: <dt>field</dt><dd>value</dd>. */
  function scanDefinitionLists(retryErrors) {
    for (const dt of document.querySelectorAll("dt")) {
      const dd = dt.nextElementSibling;
      if (dd?.tagName !== "DD") continue;
      const name = normalize(dt);
      if (isIpField(name, [dd])) decorate(dd, retryErrors);
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

  /** Table row of a decorated table cell (not of a message detail nested in a row). */
  const rowOf = (cell) => (cell.tagName === "TD" ? cell.parentElement : null);

  /** A row is flagged when any of its badges reaches the threshold. */
  function updateRowAlert(row) {
    if (!row) return;
    const alert = [...row.querySelectorAll(".abipdb-badge[data-score]")].some((b) => isAlert(Number(b.dataset.score)));
    row.classList.toggle(ALERT_ROW_CLASS, alert);
  }

  function undecorate(cell) {
    cell.querySelectorAll(".abipdb-badge").forEach((b) => b.remove());
    cell.removeAttribute(IP_ATTR);
    updateRowAlert(rowOf(cell));
  }

  /**
   * IPs of a cell: the first one in a listed or detected field, every one in
   * "all IPs" mode (a message may name several addresses).
   */
  function cellIps(cell) {
    const text = cellText(cell);
    return allIps ? IpUtils.findAll(text) : [IpUtils.find(text)].filter(Boolean);
  }

  function decorate(cell, retryErrors = false) {
    const ips = cellIps(cell);
    if (!ips.length) {
      if (cell.hasAttribute(IP_ATTR)) undecorate(cell);
      return;
    }
    // React may re-render the cell with other IPs; redo only if they changed,
    // or to retry a failed lookup when explicitly asked (popup refresh).
    const signature = ips.join(" ");
    const failed = cell.querySelector(".abipdb-badge[data-error]") !== null;
    if (cell.getAttribute(IP_ATTR) === signature && !(retryErrors && failed)) return;
    undecorate(cell);
    cell.setAttribute(IP_ATTR, signature);
    // Several badges in one cell are labelled with their IP.
    for (const ip of ips) cell.appendChild(createBadge(cell, signature, ip, ips.length > 1));
  }

  function createBadge(cell, signature, ip, labelled) {
    const badge = document.createElement("span");
    badge.dataset.ip = ip;
    const prefix = labelled ? `${ip} · ` : "";

    if (IpUtils.isPrivate(ip)) {
      badge.className = "abipdb-badge abipdb-private";
      badge.textContent = `${prefix}privée`;
      badge.title = "Adresse privée ou réservée : non envoyée à AbuseIPDB";
      return badge;
    }

    badge.className = "abipdb-badge abipdb-loading";
    badge.textContent = `${prefix}…`;

    ext.runtime.sendMessage({ type: "lookup", ip }).then((res) => {
      // The cell may have been re-rendered with other IPs in the meantime.
      if (!badge.isConnected || cell.getAttribute(IP_ATTR) !== signature) return;
      if (res?.ok) {
        badge.dataset.score = res.data.score;
        renderBadge(badge, res.data, prefix);
        updateRowAlert(rowOf(cell));
        reportAlerts();
      } else {
        badge.dataset.error = "";
        const quota = res?.code === "quota";
        badge.className = `abipdb-badge ${quota ? "abipdb-paused" : "abipdb-error"}`;
        badge.textContent = `${prefix}${quota ? "quota" : "erreur"}`;
        badge.title = res?.error || "Erreur inconnue";
      }
    });
    return badge;
  }

  function renderBadge(badge, d, prefix) {
    badge.className = `abipdb-badge abipdb-${IpUtils.level(d.score)}`;
    const place = [d.city, d.countryCode].filter(Boolean).join(", ");
    badge.textContent = `${prefix}${d.score}%${place ? ` · ${place}` : ""}${d.isTor ? " · TOR" : ""}`;
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
  // place the hovered one under its badge, or above it near the bottom of the
  // window (delegated, survives re-renders).
  document.addEventListener("mouseover", (e) => {
    const badge = e.target.closest?.(".abipdb-badge");
    const tip = badge?.querySelector(".abipdb-tooltip");
    if (!tip) return;
    const gap = 4;
    const r = badge.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = tip;
    const fitsBelow = r.bottom + gap + height <= window.innerHeight;
    tip.style.left = `${Math.max(gap, Math.min(r.left, window.innerWidth - width - gap))}px`;
    tip.style.top = `${fitsBelow || r.top - gap - height < 0 ? r.bottom + gap : r.top - gap - height}px`;
  });

  /** Distinct IPs of the page whose score reaches the alert threshold. */
  let reportedAlerts = 0;

  function reportAlerts() {
    const ips = new Set();
    for (const badge of document.querySelectorAll(".abipdb-badge[data-score]")) {
      if (isAlert(Number(badge.dataset.score))) ips.add(badge.dataset.ip);
    }
    if (ips.size === reportedAlerts) return;
    reportedAlerts = ips.size;
    ext.runtime.sendMessage({ type: "pageStats", alerts: ips.size }).catch(() => {});
  }

  function refreshAlerts() {
    const rows = new Set(document.querySelectorAll(`tr.${ALERT_ROW_CLASS}`));
    for (const cell of document.querySelectorAll(`td[${IP_ATTR}]`)) rows.add(cell.parentElement);
    rows.forEach(updateRowAlert);
    reportAlerts();
  }

  function scan({ retryErrors = false } = {}) {
    scanTables(retryErrors);
    scanDefinitionLists(retryErrors);
    reportAlerts();
  }

  /** Field selection settings (fieldName, excludedFields, autoDetect, allIps). */
  function setSelection(s) {
    fieldLabels = Settings.fields(s.fieldName);
    if (!fieldLabels.length) fieldLabels = Settings.fields(Settings.DEFAULTS.fieldName);
    fieldKeys = new Set(fieldLabels.map((f) => f.toLowerCase()));
    excludedLabels = Settings.fields(s.excludedFields);
    excludedKeys = new Set(excludedLabels.map((f) => f.toLowerCase()));
    autoDetect = s.autoDetect;
    allIps = s.allIps;
  }

  const ready = Settings.load().then((s) => {
    setSelection(s);
    alertThreshold = s.alertThreshold;
  });

  // The popup asks which IPs of the fields are currently shown on the page.
  ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "getPageIps") return false;
    ready.then(() => {
      if (msg.rescan) scan({ retryErrors: true });
      const ips = [...document.querySelectorAll(`[${IP_ATTR}]`)].flatMap((el) => el.getAttribute(IP_ATTR).split(" "));
      sendResponse({ autoDetect, allIps, fields: fieldLabels, excluded: excludedLabels, ips: [...new Set(ips)] });
    });
    return true;
  });

  // Apply settings changes without reloading the Graylog page.
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.fieldName || changes.excludedFields || changes.autoDetect || changes.allIps) {
      Settings.load().then((s) => {
        setSelection(s);
        document.querySelectorAll(`[${IP_ATTR}]`).forEach(undecorate);
        scan();
      });
    }
    if (changes.alertThreshold) {
      alertThreshold = changes.alertThreshold.newValue ?? Settings.DEFAULTS.alertThreshold;
      refreshAlerts();
    }
  });

  ready.then(() => {
    scan();
    let timer = null;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
