import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/shared/sites.js";

const { Sites } = globalThis;

describe("Sites.patternFor", () => {
  it("builds a match pattern from a URL", () => {
    assert.equal(Sites.patternFor("https://graylog.example.com/search?q=1"), "https://graylog.example.com/*");
    assert.equal(Sites.patternFor("http://10.0.0.5:9000/"), "http://10.0.0.5/*");
  });

  it("defaults to https and drops the port", () => {
    assert.equal(Sites.patternFor(" graylog.example.com:9000 "), "https://graylog.example.com/*");
    assert.equal(Sites.patternFor("localhost:9000"), "https://localhost/*");
  });

  it("rejects non-web URLs and empty input", () => {
    assert.equal(Sites.patternFor("about:addons"), null);
    assert.equal(Sites.patternFor("chrome://extensions"), null);
    assert.equal(Sites.patternFor("ftp://example.com"), null);
    assert.equal(Sites.patternFor(""), null);
  });
});

describe("Sites.label", () => {
  it("strips the path wildcard", () => {
    assert.equal(Sites.label("https://graylog.example.com/*"), "https://graylog.example.com");
  });

  it("names the all-sites patterns", () => {
    assert.equal(Sites.label("*://*/*"), "Tous les sites");
    assert.equal(Sites.label("<all_urls>"), "Tous les sites");
  });
});
