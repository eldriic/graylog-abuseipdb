import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/popup/export.js";

const { IpExport } = globalThis;

const results = [
  { ip: "203.0.113.7", score: 88, totalReports: 12, distinctUsers: 5, countryCode: "FR", city: "Paris", isp: "=HYPERLINK(\"x\")", isTor: true, isWhitelisted: false },
  { ip: "198.51.100.1", score: 0, isp: "Acme; Inc", isTor: false, isWhitelisted: false },
  { ip: "10.0.0.4", private: true },
  { ip: "192.0.2.1", error: "AbuseIPDB: HTTP 429" },
];

describe("IpExport.toText", () => {
  it("lists successfully looked-up public IPs only", () => {
    assert.equal(IpExport.toText(results), "203.0.113.7\n198.51.100.1");
  });
});

describe("IpExport.toCsv", () => {
  const csv = IpExport.toCsv(results);
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");

  it("starts with a BOM and a header", () => {
    assert.ok(csv.startsWith("﻿ip;statut;score;"));
    assert.equal(lines.length, results.length + 1);
  });

  it("neutralizes formulas and quotes separators", () => {
    assert.ok(lines[1].includes(`"'=HYPERLINK(""x"")"`));
    assert.ok(lines[2].includes('"Acme; Inc"'));
  });

  it("writes statuses and booleans in French", () => {
    assert.ok(lines[1].startsWith("203.0.113.7;ok;88;12;5;FR;;Paris;"));
    assert.ok(lines[1].includes(";oui;non;"));
    assert.ok(lines[3].startsWith("10.0.0.4;privée;"));
    assert.ok(lines[4].endsWith(";AbuseIPDB: HTTP 429"));
  });
});
