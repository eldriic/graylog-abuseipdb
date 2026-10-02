/**
 * Settings panel: AbuseIPDB usage (today, account quota, 7-day history),
 * API key, authorized Graylog sites and preferences. Every preference is saved
 * as soon as it changes. Mounted by the popup "Paramètres" tab and the options
 * page.
 */
globalThis.SettingsPanel = (() => {
  const HISTORY_DAYS = 7;
  const SAVED_TOAST_MS = 1600;

  // Lucide icons (ISC license), static markup.
  const ICONS = {
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:
      '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/>' +
      '<path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  function icon(name, className = "") {
    return (
      `<svg class="icon ${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
      `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `${ICONS[name]}</svg>`
    );
  }

  /** An icon as a DOM node, for elements built at runtime. */
  function iconNode(name) {
    return new DOMParser().parseFromString(icon(name), "image/svg+xml").documentElement;
  }

  // Static markup only: every dynamic value is set through textContent / value.
  const TEMPLATE = `
    <div class="group">
      <div class="group-title">Utilisation AbuseIPDB</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" data-ref="today">0</div>
          <div class="stat-label">requêtes aujourd'hui<br>par l'extension</div>
        </div>
        <div class="stat">
          <div class="stat-value" data-ref="remaining">—</div>
          <div class="stat-label" data-ref="remainingLabel">restantes sur le compte</div>
        </div>
      </div>
      <div class="quota-bar"><div data-ref="quotaFill"></div></div>
      <div class="chart" data-ref="chart" role="img">
        <div class="chart-tooltip" data-ref="tooltip" hidden></div>
      </div>
      <div class="muted small" data-ref="resetInfo"></div>
    </div>

    <div class="prefs">
      <section>
        <div class="pref-head">
          <h2 class="group-title">Clé API AbuseIPDB</h2>
          <span class="pill" data-ref="keyState"></span>
        </div>
        <div class="card card-body">
          <div class="input-group">
            <input data-ref="apiKey" type="password" spellcheck="false" autocomplete="off" placeholder="Collez votre clé ici" aria-label="Clé API AbuseIPDB">
            <button type="button" class="ghost-btn" data-ref="toggleKey" aria-pressed="false" title="Afficher / masquer la clé">${icon("eye", "icon-show")}${icon("eyeOff", "icon-hide")}</button>
          </div>
          <div class="card-foot">
            <a href="https://www.abuseipdb.com/account/api" target="_blank" rel="noopener noreferrer">Créer ou retrouver une clé ↗</a>
            <button type="button" class="secondary small-btn" data-ref="testKey" title="Effectue une vraie requête (compte dans le quota)">Tester la clé</button>
          </div>
          <div class="status small" data-ref="keyStatus" role="status"></div>
        </div>
      </section>

      <section>
        <div class="pref-head">
          <h2 class="group-title">Sites Graylog</h2>
        </div>
        <div class="card">
          <ul class="site-list" data-ref="sites"></ul>
          <div class="card-empty" data-ref="noSites" hidden>
            Aucun site autorisé : l'extension ne lit aucune page. Ajoutez l'adresse de
            votre Graylog, ou cliquez sur « Activer sur ce site » dans l'onglet Analyse.
          </div>
          <div class="card-body">
            <form class="input-group" data-ref="siteForm" autocomplete="off">
              <input data-ref="siteInput" type="text" spellcheck="false" placeholder="https://graylog.exemple.fr" aria-label="Adresse du site Graylog">
              <button type="submit">Ajouter</button>
            </form>
            <div class="status small" data-ref="siteStatus" role="status"></div>
          </div>
        </div>
      </section>

      <section>
        <div class="pref-head">
          <h2 class="group-title">Détection</h2>
        </div>
        <div class="card">
          <label class="pref" data-ref="autoDetectRow">
            <span class="pref-text">
              <span class="pref-label">Détection automatique</span>
              <span class="pref-desc">Analyse toutes les colonnes ne contenant que des adresses IP (remip, src_ip…).</span>
            </span>
            <span class="switch"><input data-ref="autoDetect" type="checkbox" role="switch"><span class="track"></span></span>
          </label>
          <label class="pref">
            <span class="pref-text">
              <span class="pref-label">Toutes les IP</span>
              <span class="pref-desc">Analyse chaque IP des résultats, y compris au milieu d'un texte (message, logdesc…). Consomme beaucoup de quota.</span>
            </span>
            <span class="switch"><input data-ref="allIps" type="checkbox" role="switch"><span class="track"></span></span>
          </label>
          <label class="pref pref-stack" data-ref="excludedRow">
            <span class="pref-text">
              <span class="pref-label">Champs exclus</span>
              <span class="pref-desc">Jamais analysés, séparés par des virgules. Facultatif.</span>
            </span>
            <input data-ref="excludedFields" type="text" spellcheck="false" autocomplete="off" placeholder="ex. source, dstip">
          </label>
          <label class="pref pref-stack" data-ref="fieldsRow">
            <span class="pref-text">
              <span class="pref-label">Champs à analyser</span>
              <span class="pref-desc">Seules ces colonnes sont analysées, séparées par des virgules.</span>
            </span>
            <input data-ref="fieldName" type="text" spellcheck="false" autocomplete="off" placeholder="ex. o365_audit_ClientIP, remip">
          </label>
          <label class="pref">
            <span class="pref-text">
              <span class="pref-label">Seuil d'alerte</span>
              <span class="pref-desc">Lignes surlignées et compteur sur l'icône à partir de ce score. 0 pour désactiver.</span>
            </span>
            <span class="num"><input data-ref="alertThreshold" type="number" min="0" max="100"><span class="unit">%</span></span>
          </label>
        </div>
      </section>

      <section>
        <div class="pref-head">
          <h2 class="group-title">Quota et cache</h2>
        </div>
        <div class="card">
          <label class="pref">
            <span class="pref-text">
              <span class="pref-label">Réserve de quota</span>
              <span class="pref-desc">Requêtes gardées pour la recherche manuelle : en dessous, les badges automatiques s'arrêtent.</span>
            </span>
            <span class="num"><input data-ref="quotaReserve" type="number" min="0"><span class="unit">req.</span></span>
          </label>
          <label class="pref">
            <span class="pref-text">
              <span class="pref-label">Durée du cache</span>
              <span class="pref-desc">Une IP en cache ne consomme pas de requête. 0 pour désactiver.</span>
            </span>
            <span class="num"><input data-ref="cacheHours" type="number" min="0"><span class="unit">h</span></span>
          </label>
          <label class="pref">
            <span class="pref-text">
              <span class="pref-label">Historique des signalements</span>
              <span class="pref-desc">Période prise en compte par AbuseIPDB pour le score.</span>
            </span>
            <span class="num"><input data-ref="maxAgeDays" type="number" min="1" max="365"><span class="unit">j</span></span>
          </label>
          <div class="pref">
            <span class="pref-text">
              <span class="pref-label">Cache local</span>
              <span class="pref-desc" data-ref="cacheInfo"></span>
            </span>
            <button type="button" class="secondary small-btn" data-ref="clearCache">Vider</button>
          </div>
        </div>
      </section>
    </div>

    <div class="toast" data-ref="saved" role="status" aria-live="polite">✓ Enregistré</div>
  `;

  function mount(root) {
    const doc = new DOMParser().parseFromString(`<body>${TEMPLATE}</body>`, "text/html");
    root.replaceChildren(...doc.body.childNodes);
    const ref = Object.fromEntries([...root.querySelectorAll("[data-ref]")].map((el) => [el.dataset.ref, el]));

    function setStatus(el, text, kind = "ok") {
      el.textContent = text;
      el.dataset.kind = kind;
    }

    const isSwitch = (el) => el.type === "checkbox";

    function writeForm(values) {
      for (const k of Object.keys(Settings.DEFAULTS)) {
        if (isSwitch(ref[k])) ref[k].checked = values[k];
        else ref[k].value = values[k];
      }
      renderKeyState(values.apiKey);
      renderDetectionMode();
    }

    // Detection modes use the exclusion list; otherwise only the listed fields count.
    // "All IPs" includes automatic detection, whose switch then has no effect.
    function renderDetectionMode() {
      const allIps = ref.allIps.checked;
      const anyField = allIps || ref.autoDetect.checked;
      ref.autoDetect.disabled = allIps;
      ref.autoDetectRow.classList.toggle("is-disabled", allIps);
      ref.excludedRow.hidden = !anyField;
      ref.fieldsRow.hidden = anyField;
    }

    function readForm() {
      return Object.fromEntries(
        Object.keys(Settings.DEFAULTS).map((k) => [k, isSwitch(ref[k]) ? ref[k].checked : ref[k].value]),
      );
    }

    function renderKeyState(apiKey, tested) {
      const [text, kind] = tested ?? (apiKey ? ["Enregistrée", "neutral"] : ["Manquante", "warn"]);
      ref.keyState.textContent = text;
      ref.keyState.dataset.kind = kind;
    }

    let toastTimer = null;

    function showSaved() {
      ref.saved.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => ref.saved.classList.remove("show"), SAVED_TOAST_MS);
    }

    async function save() {
      const values = Settings.sanitize(readForm());
      await Settings.save(values);
      writeForm(values); // show the clamped / normalized values
      showSaved();
      root.dispatchEvent(new CustomEvent("settings-saved", { bubbles: true }));
    }

    async function renderUsage() {
      const { usage = {}, quota } = await ext.storage.local.get(["usage", "quota"]);
      ref.today.textContent = usage[Settings.dayKey()] || 0;

      const live = Settings.liveQuota(quota);
      if (live) {
        const { remaining, limit } = live;
        ref.remaining.textContent = remaining.toLocaleString();
        ref.remainingLabel.textContent = `restantes sur ${limit.toLocaleString()} (compte)`;
        const pct = limit ? (remaining / limit) * 100 : 0;
        ref.quotaFill.style.width = `${pct}%`;
        ref.quotaFill.dataset.level = pct < 10 ? "high" : pct < 30 ? "medium" : "clean";
      }

      ref.resetInfo.textContent =
        `Le quota se réinitialise chaque jour à 00:00 UTC (${Settings.nextResetTime()} heure locale).`;

      renderChart(usage);
    }

    function renderChart(usage) {
      const days = Settings.lastDays(HISTORY_DAYS).map((key) => ({
        key,
        date: new Date(`${key}T12:00:00Z`),
        count: usage[key] || 0,
      }));
      const max = Math.max(...days.map((d) => d.count));
      const today = days[days.length - 1];
      const peak = days.reduce((a, b) => (b.count > a.count ? b : a));

      ref.chart.setAttribute(
        "aria-label",
        `Requêtes par jour sur ${HISTORY_DAYS} jours : ` +
          days.map((d) => `${d.date.toLocaleDateString([], { weekday: "long" })} ${d.count}`).join(", "),
      );
      ref.chart.querySelectorAll(".col").forEach((c) => c.remove());

      for (const d of days) {
        const col = document.createElement("div");
        col.className = "col";
        if (d === today) col.classList.add("today");

        const plot = document.createElement("div");
        plot.className = "plot";
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = max ? `${(d.count / max) * 100}%` : "0";

        // Selective direct labels: today and the peak day only.
        if (d.count && (d === today || d === peak)) {
          const value = document.createElement("span");
          value.className = "value";
          value.textContent = d.count;
          bar.appendChild(value);
        }
        plot.appendChild(bar);

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = d === today ? "Auj." : d.date.toLocaleDateString([], { weekday: "short" });

        col.append(plot, label);
        col.addEventListener("mouseenter", () => {
          const date = d.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
          ref.tooltip.textContent = `${date} — ${d.count} requête${d.count > 1 ? "s" : ""}`;
          ref.tooltip.hidden = false;
          const chartBox = ref.chart.getBoundingClientRect();
          const colBox = col.getBoundingClientRect();
          const center = colBox.left - chartBox.left + colBox.width / 2;
          const half = ref.tooltip.offsetWidth / 2;
          ref.tooltip.style.left = `${Math.max(half, Math.min(center, chartBox.width - half))}px`;
        });
        col.addEventListener("mouseleave", () => (ref.tooltip.hidden = true));
        ref.chart.appendChild(col);
      }
    }

    async function renderCacheInfo() {
      const all = await ext.storage.local.get(null);
      const n = Object.keys(all).filter((k) => k.startsWith("cache:")).length;
      ref.cacheInfo.textContent = n ? `${n.toLocaleString()} IP enregistrée${n > 1 ? "s" : ""}.` : "Vide.";
    }

    async function renderSites() {
      const sites = await Sites.list();
      ref.noSites.hidden = sites.length > 0;
      ref.sites.replaceChildren(
        ...sites.map((pattern) => {
          const li = document.createElement("li");
          const dot = document.createElement("span");
          dot.className = "site-dot";
          const label = document.createElement("span");
          label.className = "site";
          label.textContent = Sites.label(pattern);
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "icon-only";
          remove.title = `Retirer ${Sites.label(pattern)}`;
          remove.setAttribute("aria-label", remove.title);
          remove.appendChild(iconNode("x"));
          remove.addEventListener("click", () => ext.permissions.remove({ origins: [pattern] }));
          li.append(dot, label, remove);
          return li;
        }),
      );
    }

    ref.siteForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pattern = Sites.patternFor(ref.siteInput.value);
      if (!pattern) {
        return setStatus(ref.siteStatus, "Adresse invalide (ex : https://graylog.exemple.fr).", "error");
      }
      // Nothing may be awaited before request(): Firefox requires it to run within the click.
      ext.permissions.request({ origins: [pattern] }).then(
        (granted) => {
          if (!granted) return setStatus(ref.siteStatus, "Autorisation refusée.", "error");
          ref.siteInput.value = "";
          setStatus(ref.siteStatus, `✓ ${Sites.label(pattern)} autorisé. Les onglets ouverts sont analysés.`);
        },
        (err) => setStatus(ref.siteStatus, `✗ ${err.message}`, "error"),
      );
    });

    ref.toggleKey.addEventListener("click", () => {
      const show = ref.apiKey.type === "password";
      ref.apiKey.type = show ? "text" : "password";
      ref.toggleKey.setAttribute("aria-pressed", String(show));
    });

    // Autosave: "change" fires once the value is committed (blur, Enter, toggle, spinner).
    for (const k of Object.keys(Settings.DEFAULTS)) ref[k].addEventListener("change", save);
    ref.autoDetect.addEventListener("change", renderDetectionMode);
    ref.allIps.addEventListener("change", renderDetectionMode);

    ref.testKey.addEventListener("click", async () => {
      const apiKey = ref.apiKey.value.trim();
      if (!apiKey) return setStatus(ref.keyStatus, "Collez une clé avant de la tester.", "error");
      setStatus(ref.keyStatus, "Test en cours…", "pending");
      const res = await ext.runtime.sendMessage({ type: "testKey", apiKey });
      if (res.ok) {
        const q = res.quota;
        const left = q ? ` ${q.remaining.toLocaleString()} / ${q.limit.toLocaleString()} requêtes restantes.` : "";
        setStatus(ref.keyStatus, `✓ Clé valide.${left}`);
        renderKeyState(apiKey, ["Valide", "ok"]);
      } else {
        setStatus(ref.keyStatus, `✗ ${res.error}`, "error");
        renderKeyState(apiKey, ["Invalide", "error"]);
      }
      renderUsage();
    });

    ref.clearCache.addEventListener("click", async () => {
      await ext.runtime.sendMessage({ type: "clearCache" });
      renderCacheInfo();
    });

    // Keep counters live while the panel is open (lookups running in the background).
    ext.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.usage || changes.quota) renderUsage();
      if (Object.keys(changes).some((k) => k.startsWith("cache:"))) renderCacheInfo();
    });
    ext.permissions.onAdded.addListener(renderSites);
    ext.permissions.onRemoved.addListener(renderSites);

    Settings.load().then(writeForm);
    renderSites();
    renderUsage();
    renderCacheInfo();
  }

  return { mount };
})();
