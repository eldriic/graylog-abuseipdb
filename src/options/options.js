/**
 * Settings page: API key, Graylog field, report age and cache duration.
 */
const DEFAULTS = { apiKey: "", fieldName: "o365_audit_ClientIP", maxAgeDays: 90, cacheHours: 24 };
const $ = (id) => document.getElementById(id);

function flash(msg) {
  $("status").textContent = msg;
  setTimeout(() => ($("status").textContent = ""), 2000);
}

ext.storage.local.get(Object.keys(DEFAULTS)).then((stored) => {
  const s = { ...DEFAULTS, ...stored };
  for (const k of Object.keys(DEFAULTS)) $(k).value = s[k];
});

$("save").addEventListener("click", async () => {
  await ext.storage.local.set({
    apiKey: $("apiKey").value.trim(),
    fieldName: $("fieldName").value.trim() || DEFAULTS.fieldName,
    maxAgeDays: Number($("maxAgeDays").value) || DEFAULTS.maxAgeDays,
    cacheHours: Number($("cacheHours").value) || 0,
  });
  flash("Enregistré — rechargez la page Graylog.");
});

$("clear").addEventListener("click", async () => {
  await ext.runtime.sendMessage({ type: "clearCache" });
  flash("Cache vidé.");
});
