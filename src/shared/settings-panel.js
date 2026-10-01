/**
 * Settings panel: AbuseIPDB usage (today, account quota, 7-day history) and
 * configuration form. Mounted by the popup "Paramètres" tab and the options page.
 */
globalThis.SettingsPanel = (() => {
  const HISTORY_DAYS = 7;

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

    <form class="group" data-ref="form" autocomplete="off">
      <div class="group-title">Configuration</div>

      <label class="field">
        <span>Clé API AbuseIPDB</span>
        <span class="input-row">
          <input data-ref="apiKey" type="password" spellcheck="false" placeholder="Collez votre clé ici">
          <button type="button" class="secondary icon" data-ref="toggleKey" title="Afficher / masquer">👁</button>
        </span>
        <a class="small" href="https://www.abuseipdb.com/account/api" target="_blank" rel="noopener noreferrer">Créer ou retrouver une clé ↗</a>
      </label>

      <label class="field">
        <span>Champ Graylog à analyser</span>
        <input data-ref="fieldName" type="text" spellcheck="false">
      </label>

      <div class="field-row">
        <label class="field">
          <span>Historique (jours)</span>
          <input data-ref="maxAgeDays" type="number" min="1" max="365">
        </label>
        <label class="field">
          <span>Cache (heures)</span>
          <input data-ref="cacheHours" type="number" min="0">
        </label>
      </div>

      <div class="actions">
        <button type="submit">Enregistrer</button>
        <button type="button" class="secondary" data-ref="testKey" title="Effectue une vraie requête (compte dans le quota)">Tester la clé</button>
      </div>
      <div class="status small" data-ref="status" role="status"></div>
    </form>

    <div class="group cache-row">
      <span class="muted" data-ref="cacheInfo"></span>
      <button type="button" class="secondary" data-ref="clearCache">Vider le cache</button>
    </div>
  `;

  function mount(root) {
    const doc = new DOMParser().parseFromString(`<body>${TEMPLATE}</body>`, "text/html");
    root.replaceChildren(...doc.body.childNodes);
    const ref = Object.fromEntries([...root.querySelectorAll("[data-ref]")].map((el) => [el.dataset.ref, el]));

    function setStatus(text, kind = "ok") {
      ref.status.textContent = text;
      ref.status.dataset.kind = kind;
    }

    async function loadForm() {
      const s = await Settings.load();
      for (const k of Object.keys(Settings.DEFAULTS)) ref[k].value = s[k];
    }

    async function renderUsage() {
      const { usage = {}, quota } = await ext.storage.local.get(["usage", "quota"]);
      ref.today.textContent = usage[Settings.dayKey()] || 0;

      if (quota) {
        // The quota header is a snapshot: after the UTC reset it no longer applies.
        const stale = Settings.dayKey(new Date(quota.ts)) !== Settings.dayKey();
        const remaining = stale ? quota.limit : quota.remaining;
        ref.remaining.textContent = remaining.toLocaleString();
        ref.remainingLabel.textContent = `restantes sur ${quota.limit.toLocaleString()} (compte)`;
        const pct = quota.limit ? (remaining / quota.limit) * 100 : 0;
        ref.quotaFill.style.width = `${pct}%`;
        ref.quotaFill.dataset.level = pct < 10 ? "high" : pct < 30 ? "medium" : "clean";
      }

      const reset = Settings.nextReset().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ref.resetInfo.textContent = `Le quota se réinitialise chaque jour à 00:00 UTC (${reset} heure locale).`;

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
      ref.cacheInfo.textContent = `${n} IP en cache`;
    }

    ref.toggleKey.addEventListener("click", () => {
      ref.apiKey.type = ref.apiKey.type === "password" ? "text" : "password";
    });

    ref.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await Settings.save({
        apiKey: ref.apiKey.value.trim(),
        fieldName: ref.fieldName.value.trim() || Settings.DEFAULTS.fieldName,
        maxAgeDays: Math.min(365, Math.max(1, Number(ref.maxAgeDays.value) || Settings.DEFAULTS.maxAgeDays)),
        cacheHours: Math.max(0, Number(ref.cacheHours.value) || 0),
      });
      await loadForm();
      setStatus("✓ Enregistré. Rechargez la page Graylog pour appliquer le champ.");
      root.dispatchEvent(new CustomEvent("settings-saved", { bubbles: true }));
    });

    ref.testKey.addEventListener("click", async () => {
      const apiKey = ref.apiKey.value.trim();
      if (!apiKey) return setStatus("Saisissez une clé avant de la tester.", "error");
      setStatus("Test en cours…", "pending");
      const res = await ext.runtime.sendMessage({ type: "testKey", apiKey });
      if (res.ok) {
        const left = res.quota ? ` — ${res.quota.remaining} / ${res.quota.limit} requêtes restantes` : "";
        setStatus(`✓ Clé valide${left}. Pensez à enregistrer.`);
      } else {
        setStatus(`✗ ${res.error}`, "error");
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

    loadForm();
    renderUsage();
    renderCacheInfo();
  }

  return { mount };
})();
