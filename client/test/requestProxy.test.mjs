import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRequestProxy,
  loadRequestProxy,
  normalizeRequestProxyUrl,
  proxiedRequestUrl,
  saveRequestProxy,
} from "../src/utils/requestProxy.js";

test("leaves requests unchanged when the proxy URL is empty", () => {
  const target = "https://siatube.com/api/search?q=hello%20world";
  assert.equal(proxiedRequestUrl(target, { url: "" }), target);
});

test("a non-empty proxy URL automatically wraps the complete request URL", () => {
  const target = "https://siatube.com/api/search?q=猫&token=a%2Fb#results";
  assert.equal(
    proxiedRequestUrl(target, { url: "https://proxy.test/forward" }),
    `https://proxy.test/forward?url=${encodeURIComponent(target)}`,
  );
});

test("trims the proxy URL and accepts URL objects", () => {
  const target = new URL("https://siatube.com/api/search?q=test");
  assert.equal(
    proxiedRequestUrl(target, "  https://proxy.test/forward?  "),
    `https://proxy.test/forward?url=${encodeURIComponent(target.toString())}`,
  );
});

test("does not proxy non-HTTP request URLs", () => {
  assert.equal(proxiedRequestUrl("blob:abc", { url: "https://proxy.test" }), "blob:abc");
});

test("rejects invalid proxy URLs instead of silently making a direct request", () => {
  const target = "https://siatube.com/api";
  assert.throws(() => proxiedRequestUrl(target, { url: "not a url" }), TypeError);
  assert.throws(() => proxiedRequestUrl(target, { url: "ftp://proxy.test" }), TypeError);
  assert.throws(() => proxiedRequestUrl(target, { url: "https://proxy.test?token=x" }), TypeError);
  assert.throws(() => proxiedRequestUrl(target, { url: "https://proxy.test#fragment" }), TypeError);
  assert.throws(() => proxiedRequestUrl(target, { url: "https://user:pass@proxy.test" }), TypeError);
});

test("normalizes harmless trailing URL delimiters", () => {
  assert.equal(normalizeRequestProxyUrl(" https://proxy.test/path? "), "https://proxy.test/path");
  assert.equal(normalizeRequestProxyUrl("https://proxy.test/path#"), "https://proxy.test/path");
});

test("saves and loads the proxy URL from localStorage", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });

  saveRequestProxy("  https://proxy.test/forward  ");
  assert.deepEqual(loadRequestProxy(), { url: "https://proxy.test/forward" });

  assert.throws(() => saveRequestProxy("not a URL"), TypeError);
  assert.deepEqual(loadRequestProxy(), { url: "https://proxy.test/forward" });

  values.set("requestProxyUrl", "https://legacy-proxy.test/forward");
  assert.deepEqual(loadRequestProxy(), { url: "https://legacy-proxy.test/forward" });
});

test("checks the SiaTube root through the candidate proxy exactly once", async () => {
  const calls = [];
  const payload = { status: "ok" };
  const result = await checkRequestProxy("https://proxy.test/forward", {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      };
    },
  });

  assert.deepEqual(result, payload);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `https://proxy.test/forward?url=${encodeURIComponent("https://siatube.com/")}`,
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[0].options.credentials, "omit");
});

test("fails the proxy check for non-success responses and invalid JSON", async () => {
  await assert.rejects(
    checkRequestProxy("https://proxy.test/forward", {
      fetchImpl: async () => ({ ok: false, status: 502 }),
    }),
    /HTTP 502/,
  );

  await assert.rejects(
    checkRequestProxy("https://proxy.test/forward", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError("invalid JSON"); },
      }),
    }),
    /invalid JSON/,
  );

  await assert.rejects(
    checkRequestProxy("https://proxy.test/forward", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => null,
      }),
    }),
    /invalid JSON/,
  );

  await assert.rejects(
    checkRequestProxy("https://proxy.test/forward", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", error: "upstream failed" }),
      }),
    }),
    /invalid JSON/,
  );

  await assert.rejects(
    checkRequestProxy("https://proxy.test/forward", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "   " }),
      }),
    }),
    /invalid JSON/,
  );
});

test("does not send a proxy check for an empty or invalid proxy URL", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({}) };
  };

  await assert.rejects(checkRequestProxy("", { fetchImpl }), TypeError);
  await assert.rejects(checkRequestProxy("not a URL", { fetchImpl }), TypeError);
  assert.equal(calls, 0);
});
