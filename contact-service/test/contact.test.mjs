import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { configFromEnv, createContactServer, LIMITS } from "../src/contact.mjs";
import { createStore } from "../src/store.mjs";

const origin = "https://stadtstack.eu";
const valid = () => ({ name: "Ada", email: "ada@example.test", message: "Eine echte Kontaktanfrage.", website: "", startedAt: Date.now() - 4000 });
async function app(t, options = {}) {
  const sent = [];
  const directory = await mkdtemp(join(tmpdir(), "contact-test-"));
  const disk = await createStore({ directory, key: randomBytes(32), clock: options.clock });
  t.after(async () => { await disk.close(); await rm(directory, { recursive: true, force: true }); });
  const store = { ...disk, async add(data) { const id = await disk.add(data); sent.push(data); return id; } };
  const server = createContactServer({ origins: new Set([origin]), store, notify: async () => {}, ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (data = valid(), headers = {}) => fetch(`${url}/api/contact`, { method: "POST",
    headers: { origin, "content-type": "application/json", ...headers }, body: typeof data === "string" ? data : JSON.stringify(data) });
  return { sent, server, url, post };
}

test("configuration fails closed for secrets, storage, ports and notification URL", () => {
  const env = { CONTACT_ALLOWED_ORIGINS: origin, CONTACT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    CONTACT_ADMIN_TOKEN: "a".repeat(32), CONTACT_STORE_DIR: "/data/inbox", NTFY_URL: "http://stadtstack-contact-ntfy:8080/contact",
    NTFY_TOKEN: `tk_A9${"a".repeat(27)}` };
  const config = configFromEnv(env);
  assert.equal(config.port, 8081);
  assert.equal(config.adminPort, 8082);
  assert.equal(config.key.length, 32);
  assert.equal(config.ntfyToken, env.NTFY_TOKEN);
  for (const override of [{ CONTACT_ALLOWED_ORIGINS: "" }, { CONTACT_ALLOWED_ORIGINS: `${origin}/path` },
    { CONTACT_TRUSTED_PROXIES: "not-an-ip" }, { CONTACT_ENCRYPTION_KEY: "" }, { CONTACT_ADMIN_TOKEN: "short" },
    { CONTACT_STORE_DIR: "relative" }, { PORT: "0" }, { ADMIN_PORT: "8081" }, { CONTACT_MAX_MESSAGES: "0" },
    { NTFY_URL: "https://ntfy.sh/contact" }, { NTFY_URL: "http://ntfy.sh/contact" },
    { NTFY_URL: "http://user:pass@ntfy:8080/contact" }, { NTFY_TOKEN: undefined }, { NTFY_TOKEN: "" },
    { NTFY_TOKEN: "invalid-token" }, { NTFY_TOKEN: `tk_${"a".repeat(64)}` },
    { NTFY_TOKEN: `tk_${"a".repeat(29)}\n` }]) {
    assert.throws(() => configFromEnv({ ...env, ...override }));
  }
});

test("health, route, method, origin and content-type rejection", async (t) => {
  const { url, post, sent } = await app(t);
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
  assert.equal((await fetch(`${url}/other`)).status, 404);
  assert.equal((await fetch(`${url}/api/contact`)).status, 405);
  for (const headers of [{ origin: "https://evil.example" }, { origin: "" }, { "sec-fetch-site": "cross-site" }]) assert.equal((await post(valid(), headers)).status, 403);
  assert.equal((await post(valid(), { "content-type": "text/plain" })).status, 415);
  assert.equal((await post(valid(), { "content-encoding": "gzip" })).status, 415);
  assert.deepEqual(sent, []);
});

for (const [label, change] of [
  ["email header injection", { email: "ada@example.test\r\nBcc: victim@example.test" }],
  ["email display-name injection", { email: "Ada <ada@example.test>" }],
  ["name controls", { name: "Ada\nBcc: victim@example.test" }],
  ["name limit", { name: "x".repeat(121) }], ["null email", { email: null }],
  ["malformed email", { email: "not-an-email" }], ["email limit", { email: "x".repeat(255) }],
  ["message too short", { message: "small" }], ["message limit", { message: "x".repeat(5001) }],
  ["message null byte", { message: "Bad message\u0000" }], ["honeypot", { website: "spam" }],
  ["minimum fill", { startedAt: Date.now() }], ["expired form", { startedAt: Date.now() - LIMITS.maxFill - 1000 }],
  ["future start", { startedAt: Date.now() + 10000 }], ["noninteger start", { startedAt: "old" }],
  ["unknown field", { extra: "evil.example" }],
]) test(`rejects ${label}`, async (t) => {
  const { post, sent } = await app(t);
  const response = await post({ ...valid(), ...change });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
  assert.equal(sent.length, 0);
});

test("rejects malformed JSON and declared or chunked oversized bodies", async (t) => {
  const { post, url, sent } = await app(t);
  assert.equal((await post("{")).status, 400);
  assert.equal((await post("x".repeat(LIMITS.body + 1))).status, 413);
  const status = await new Promise((resolve, reject) => {
    const request = http.request(`${url}/api/contact`, { method: "POST", headers: { origin, "content-type": "application/json", "transfer-encoding": "chunked" } }, (res) => { res.resume(); resolve(res.statusCode); });
    request.on("error", reject);
    request.end("x".repeat(LIMITS.body + 1));
  });
  assert.equal(status, 413);
  assert.equal(sent.length, 0);
});

test("accepts optional name and trims message without exposing payload", async (t) => {
  const { post, sent } = await app(t);
  const contact = valid(); delete contact.name;
  contact.message = "  Eine echte Kontaktanfrage.  ";
  const response = await post(contact);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(sent, [{ name: "", email: contact.email, message: contact.message.trim() }]);
});

for (const email of [undefined, ""]) test(`rejects required reply email ${email === undefined ? "omitted" : "empty"}`, async (t) => {
  const { post, sent } = await app(t);
  const contact = valid();
  delete contact.name;
  if (email === undefined) delete contact.email;
  else contact.email = email;
  const response = await post(contact);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
  assert.deepEqual(sent, []);
});

test("incomplete bodies time out without storing messages", { timeout: 5000 }, async (t) => {
  const { url, sent } = await app(t);
  const response = await new Promise((resolve, reject) => {
    const request = http.request(`${url}/api/contact`, { method: "POST",
      headers: { origin, "content-type": "application/json", "content-length": "100" } }, (res) => {
      res.resume(); resolve(res.statusCode);
    });
    request.on("error", reject);
    request.flushHeaders();
    t.after(() => request.destroy());
  });
  assert.equal(response, 408);
  assert.equal(sent.length, 0);
});

test("simultaneous incomplete requests are bounded before delivery", { timeout: 5000 }, async (t) => {
  const { url, post, server, sent } = await app(t, { trustedProxies: new Set(["127.0.0.1"]) });
  const pending = [];
  let admitted = 0;
  server.on("request", () => admitted++);
  for (let i = 0; i < LIMITS.requests; i++) {
    const request = http.request(`${url}/api/contact`, { method: "POST", headers: {
      origin, "content-type": "application/json", "content-length": "100", "x-contact-client-ip": `192.0.2.${i + 1}`,
    } });
    request.on("error", () => {});
    request.flushHeaders();
    pending.push(request);
  }
  t.after(() => pending.forEach((request) => request.destroy()));
  while (admitted < LIMITS.requests) await new Promise((resolve) => setImmediate(resolve));
  const response = await post(valid(), { "x-contact-client-ip": "192.0.2.200" });
  assert.equal(response.status, 503);
  assert.equal(sent.length, 0);
  pending.forEach((request) => request.destroy());
});

test("per-IP rate limit ignores spoofed forwarding and expires transient memory", async (t) => {
  let now = Date.now();
  const { post, sent } = await app(t, { clock: () => now });
  for (let i = 0; i < 3; i++) assert.equal((await post(valid(), { "x-contact-client-ip": `192.0.2.${i + 1}`, "x-forwarded-for": `192.0.2.${i + 1}` })).status, 200);
  const limited = await post();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "900");
  now += LIMITS.window;
  assert.equal((await post({ ...valid(), startedAt: now - 4000 })).status, 200);
  assert.equal(sent.length, 4);
});

test("global rate limit bounds configured proxy identities", async (t) => {
  const { post } = await app(t, { trustedProxies: new Set(["127.0.0.1"]) });
  for (let i = 0; i < LIMITS.global; i++) assert.equal((await post(valid(), { "x-contact-client-ip": `192.0.2.${i + 1}` })).status, 200);
  assert.equal((await post(valid(), { "x-contact-client-ip": "192.0.2.200" })).status, 429);
});

test("write concurrency is bounded and failures are generic/retryable", async (t) => {
  const release = [];
  const { post } = await app(t, { store: { add() { return new Promise((resolve) => release.push(resolve)); }, async setNotification() {} } });
  const first = post(), second = post();
  while (release.length < 2) await new Promise((resolve) => setImmediate(resolve));
  const busy = await post();
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get("retry-after"), "60");
  release.forEach((resolve) => resolve());
  assert.equal((await first).status, 200); assert.equal((await second).status, 200);
});

test("storage failure returns honest retryable failure", async (t) => {
  const { post } = await app(t, { store: { async add() { throw new Error("private storage failure"); } } });
  const response = await post();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.deepEqual(await response.json(), { ok: false, error: "unavailable" });
});

