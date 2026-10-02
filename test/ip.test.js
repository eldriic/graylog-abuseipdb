import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/shared/ip.js";

const { IpUtils } = globalThis;

describe("IpUtils.find", () => {
  it("finds IPv4 and IPv6 addresses in text", () => {
    assert.equal(IpUtils.find("client 203.0.113.7 logged in"), "203.0.113.7");
    assert.equal(IpUtils.find("2001:4860:4860::8888"), "2001:4860:4860::8888");
    assert.equal(IpUtils.find("fe80:0:0:0:0:0:0:1"), "fe80:0:0:0:0:0:0:1");
    assert.equal(IpUtils.find("::ffff:10.0.0.1"), "::ffff:10.0.0.1");
  });

  it("ignores times and out-of-range octets", () => {
    assert.equal(IpUtils.find("14:06:29"), null);
    assert.equal(IpUtils.find("2026-10-02 14:06:29.123"), null);
    assert.equal(IpUtils.find("999.1.1.1"), null);
  });

  it("skips invalid candidates to reach a valid one", () => {
    assert.equal(IpUtils.find("300.1.1.1 then 8.8.8.8"), "8.8.8.8");
  });

  it("handles empty input", () => {
    assert.equal(IpUtils.find(""), null);
    assert.equal(IpUtils.find(undefined), null);
  });
});

describe("IpUtils.findAll", () => {
  it("lists every valid IP once, in order", () => {
    assert.deepEqual(
      IpUtils.findAll("from 8.8.4.4 to 2001:db8::1 at 14:06:29, retry 8.8.4.4 via 300.1.1.1"),
      ["8.8.4.4", "2001:db8::1"],
    );
  });

  it("returns an empty list without IP", () => {
    assert.deepEqual(IpUtils.findAll("Ssl vpn tunnel up"), []);
    assert.deepEqual(IpUtils.findAll(null), []);
  });
});

describe("IpUtils.isValid", () => {
  for (const ip of ["8.8.8.8", "255.255.255.255", "::", "::1", "2001:db8::1", "1:2:3:4:5:6:7:8", "::ffff:1.2.3.4"]) {
    it(`accepts ${ip}`, () => assert.equal(IpUtils.isValid(ip), true));
  }
  for (const ip of ["256.1.1.1", "1.2.3", "1::2::3", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7", "12345::1", "foo"]) {
    it(`rejects ${ip}`, () => assert.equal(IpUtils.isValid(ip), false));
  }
});

describe("IpUtils.isPrivate", () => {
  const reserved = [
    "0.1.2.3", "10.1.2.3", "100.64.0.1", "100.127.255.255", "127.0.0.1", "169.254.1.1",
    "172.16.0.1", "172.31.255.255", "192.0.0.8", "192.0.2.15", "192.168.1.20", "198.18.0.1",
    "198.51.100.7", "203.0.113.9", "224.0.0.251", "239.255.255.250", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "FE80::abcd", "fd12:3456::1", "fc00::1", "ff02::1", "2001:db8::42",
    "::ffff:10.0.0.1", "::ffff:192.168.0.1",
  ];
  const publicIps = [
    "8.8.8.8", "1.1.1.1", "100.63.255.255", "100.128.0.0", "172.15.255.255", "172.32.0.0",
    "192.0.1.1", "198.20.0.1", "223.255.255.255", "2001:4860:4860::8888", "2606:4700::1111",
    "::ffff:8.8.8.8",
  ];
  for (const ip of reserved) it(`${ip} is reserved`, () => assert.equal(IpUtils.isPrivate(ip), true));
  for (const ip of publicIps) it(`${ip} is public`, () => assert.equal(IpUtils.isPrivate(ip), false));

  it("treats invalid input as reserved (never sent)", () => {
    assert.equal(IpUtils.isPrivate("not-an-ip"), true);
  });
});

describe("IpUtils.level", () => {
  it("maps scores to risk levels", () => {
    assert.deepEqual([0, 1, 24, 25, 74, 75, 100].map(IpUtils.level), [
      "clean", "low", "low", "medium", "medium", "high", "high",
    ]);
  });
});
