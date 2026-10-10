import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createContactServer } from "../src/contact.mjs";
import { createAdminServer } from "../src/admin.mjs";
import { createNotifier, createStore, RETENTION_MS } from "../src/store.mjs";

const origin = "https://stadtstack.eu";
const token = "private-admin-token-" + "a".repeat(32);
const publishToken = `tk_B9${"b".repeat(27)}`;
const contact = { name: "Äda unique-person", email: "unique-person@example.test", message: "A confidential contact request with a unique marker." };
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), "encrypted-inbox-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function disk(t, options = {}) {
  const path = await directory(t);
  const key = randomBytes(32);
  const store = await createStore({ directory: path, key, ...options });
  t.after(() => store.close());
  return { store, path, key };
}
async function listen(t, server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
function submit(url) {
  return fetch(`${url}/api/contact`, { method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ ...contact, website: "", startedAt: Date.now() - 4000 }) });
}

// The assertions inspect actual filesystem bytes, not an encryption mock.
test("all persistent payload and metadata are authenticated ciphertext, restart recovers it", async (t) => {
  const { store, path, key } = await disk(t);
  const id = await store.add(contact);
  assert.deepEqual(await readdir(path), [`${id}.enc`]);
  const bytes = await readFile(join(path, `${id}.enc`));
  for (const value of Object.values(contact)) assert.equal(bytes.includes(Buffer.from(value)), false);
  for (const value of ["createdAt", "notification", "pending", id]) assert.equal(bytes.includes(Buffer.from(value)), false);
  assert.equal((await stat(join(path, `${id}.enc`))).mode & 0o777, 0o600);
  await store.close();
  const restarted = await createStore({ directory: path, key });
  t.after(() => restarted.close());
  const record = await restarted.get(id);
  assert.deepEqual({ name: record.name, email: record.email, message: record.message }, contact);
  assert.equal(record.notification, "pending");
  assert.equal((await restarted.list())[0].id, id);
});

test("wrong encryption key and tampered ciphertext fail startup rather than discarding data", async (t) => {
  const { store, path, key } = await disk(t);
  const id = await store.add(contact);
  await store.close();
  await assert.rejects(createStore({ directory: path, key: randomBytes(32) }));
  const file = join(path, `${id}.enc`);
  const bytes = await readFile(file); bytes[bytes.length - 1] ^= 1; await writeFile(file, bytes);
  await assert.rejects(createStore({ directory: path, key }));
  assert.deepEqual(await readdir(path), [`${id}.enc`]);
});

test("capacity is strictly bounded across concurrent writes and survives restart", async (t) => {
  const { store, path, key } = await disk(t, { maxMessages: 2 });
  const results = await Promise.allSettled([store.add(contact), store.add(contact), store.add(contact)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await readdir(path)).length, 2);
  await store.close();
  const restarted = await createStore({ directory: path, key, maxMessages: 2 });
  t.after(() => restarted.close());
  await assert.rejects(restarted.add(contact), /capacity/);
  const first = (await restarted.list())[0].id;
  assert.equal(await restarted.delete(first), true);
  await restarted.add(contact);
  assert.equal((await restarted.list()).length, 2);
});

test("90-day boundary purges ciphertext at startup and frees bounded capacity", async (t) => {
  let now = 1_800_000_000_000;
  const { store, path, key } = await disk(t, { clock: () => now, maxMessages: 1 });
  const id = await store.add(contact);
  now += RETENTION_MS - 1;
  assert.ok(await store.get(id));
  await store.close();
  now++;
  const restarted = await createStore({ directory: path, key, clock: () => now, maxMessages: 1 });
  t.after(() => restarted.close());
  assert.deepEqual(await readdir(path), []);
  assert.equal(await restarted.get(id), null);
  await restarted.add(contact);
  assert.equal((await restarted.list()).length, 1);
});

test("scheduled retention cleanup deletes files without requests", { timeout: 3000 }, async (t) => {
  let now = Date.now();
  const { store, path } = await disk(t, { clock: () => now, purgeInterval: 10 });
  await store.add(contact);
  now += RETENTION_MS;
  const deadline = Date.now() + 2000;
  while ((await readdir(path)).length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(await readdir(path), []);
});

test("startup removes only interrupted encrypted temporary writes", async (t) => {
  const path = await directory(t);
  await writeFile(join(path, "00000000-0000-4000-8000-000000000000.11111111-1111-4111-8111-111111111111.tmp"), randomBytes(64));
  const store = await createStore({ directory: path, key: randomBytes(32) });
  t.after(() => store.close());
  assert.deepEqual(await readdir(path), []);
});

test("private admin authenticates every inbox operation; public listener cannot expose admin", async (t) => {
  const { store, path } = await disk(t);
  const id = await store.add({ ...contact, message: "<script>alert('not executed')</script>" });
  const publicUrl = await listen(t, createContactServer({ origins: new Set([origin]), store, notify: async () => {} }));
  const privateUrl = await listen(t, createAdminServer({ store, adminToken: token }));
  const headers = { Authorization: `Bearer ${token}` };
  for (const route of ["/", "/api/inbox", `/api/inbox/${id}`]) {
    assert.equal((await fetch(publicUrl + route, { headers })).status, 404);
  }
  for (const method of ["GET", "DELETE"]) for (const authorization of [undefined, "Bearer wrong"]) {
    const response = await fetch(`${privateUrl}/api/inbox/${id}`, { method, headers: authorization ? { Authorization: authorization } : {} });
    assert.equal(response.status, 401);
  }
  const shell = await fetch(privateUrl);
  assert.match(shell.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const html = await shell.text();
  assert.ok(html.includes("Privater Kontakt-Posteingang"));
  assert.equal(html.includes(contact.email), false);
  assert.equal(html.includes("localStorage"), false);
  assert.equal((await fetch(`${privateUrl}/api/inbox/${id}`, { method: "DELETE", headers: { ...headers, Origin: "https://evil.example" } })).status, 403);
  const list = await fetch(`${privateUrl}/api/inbox`, { headers });
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.deepEqual(await list.json(), { messages: [{ id, createdAt: (await store.get(id)).createdAt, notification: "pending" }] });
  const message = await fetch(`${privateUrl}/api/inbox/${id}`, { headers });
  assert.equal((await message.json()).email, contact.email);
  assert.equal((await fetch(`${privateUrl}/api/inbox/${id}`, { method: "DELETE", headers })).status, 200);
  assert.equal((await fetch(`${privateUrl}/api/inbox/${id}`, { headers })).status, 404);
  assert.deepEqual(await readdir(path), []);
});

test("real local ntfy HTTP protocol gets immediate generic notification only after durable ciphertext", async (t) => {
  const { store, path } = await disk(t);
  const received = [];
  const ntfyUrl = await listen(t, http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const files = await readdir(path);
    const bytes = await readFile(join(path, files[0]));
    received.push({ method: req.method, path: req.url, body, title: req.headers.title, authorization: req.headers.authorization, bytes });
    res.writeHead(200, { "content-type": "application/json" }); res.end('{"event":"message"}');
  }));
  const url = await listen(t, createContactServer({ origins: new Set([origin]), store, notify: createNotifier(`${ntfyUrl}/contact`, publishToken) }));
  const response = await submit(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(received.length, 1);
  assert.equal(received[0].method, "POST"); assert.equal(received[0].path, "/contact");
  assert.equal(received[0].authorization, `Bearer ${publishToken}`);
  assert.equal(received[0].title, undefined);
  assert.equal(received[0].body, "Neue Kontaktanfrage auf stadtstack.eu");
  assert.equal(received[0].body.includes(publishToken), false);
  assert.equal(received[0].bytes.includes(Buffer.from(publishToken)), false);
  for (const value of Object.values(contact)) {
    assert.equal(received[0].body.includes(value), false);
    assert.equal(received[0].bytes.includes(Buffer.from(value)), false);
  }
  assert.equal((await store.list())[0].notification, "sent");
});

for (const failure of ["reject", "redirect", "disconnected"]) test(`ntfy ${failure} preserves durable message and reports only internal generic failure`, async (t) => {
  const { store } = await disk(t);
  const events = [];
  const ntfyUrl = await listen(t, http.createServer((req, res) => {
    if (failure === "disconnected") { req.socket.destroy(); return; }
    res.writeHead(failure === "redirect" ? 302 : 503, { Location: "https://ntfy.sh/forbidden-third-party" });
    res.end("remote sensitive error must not enter logs");
  }));
  const url = await listen(t, createContactServer({ origins: new Set([origin]), store,
    notify: createNotifier(`${ntfyUrl}/contact`, publishToken), onEvent: (event) => events.push(event) }));
  const response = await submit(url);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  const records = await store.list();
  assert.equal(records.length, 1); assert.equal(records[0].notification, "failed");
  assert.equal((await store.get(records[0].id)).message, contact.message);
  assert.deepEqual(events, ["inbox_notification_failed"]);
});

test("public request at actual disk-store capacity fails honestly without dropping or notifying", async (t) => {
  const { store, path } = await disk(t, { maxMessages: 1 });
  let notifications = 0;
  const url = await listen(t, createContactServer({ origins: new Set([origin]), store,
    notify: async () => { notifications++; } }));
  assert.equal((await submit(url)).status, 200);
  const first = (await store.list())[0].id;
  const response = await submit(url);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.deepEqual(await response.json(), { ok: false, error: "unavailable" });
  assert.equal(notifications, 1);
  assert.deepEqual(await readdir(path), [`${first}.enc`]);
  assert.equal((await store.get(first)).message, contact.message);
});

test("notification-status persistence failure leaves the durable record intact and pending", async (t) => {
  const { store } = await disk(t);
  const events = [];
  const url = await listen(t, createContactServer({ origins: new Set([origin]),
    store: { ...store, async setNotification() { throw new Error("private disk error"); } },
    notify: async () => {}, onEvent: (event) => events.push(event) }));
  assert.equal((await submit(url)).status, 200);
  const first = (await store.list())[0];
  assert.equal(first.notification, "pending");
  assert.equal((await store.get(first.id)).message, contact.message);
  assert.deepEqual(events, ["inbox_notification_status_failed"]);
});
