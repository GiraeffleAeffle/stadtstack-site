import http from "node:http";
import { isIP } from "node:net";
import { isAbsolute } from "node:path";

export const LIMITS = Object.freeze({ body: 24_576, message: 5000, minFill: 3000, maxFill: 7_200_000,
  window: 900_000, perIp: 3, global: 30, ips: 1000, requests: 16, deliveries: 2 });
export const DEFAULT_MAX_MESSAGES = 1000;
const EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export function configFromEnv(env = process.env) {
  const origins = new Set((env.CONTACT_ALLOWED_ORIGINS || "").split(",").filter(Boolean));
  if (!origins.size || [...origins].some((origin) => {
    try { const url = new URL(origin); return url.origin !== origin || !["http:", "https:"].includes(url.protocol); }
    catch { return true; }
  })) throw new Error("Invalid contact origins configuration");
  const trustedProxies = new Set((env.CONTACT_TRUSTED_PROXIES || "").split(",").filter(Boolean));
  if ([...trustedProxies].some((ip) => !isIP(ip))) throw new Error("Invalid trusted proxy configuration");
  const port = Number(env.PORT || 8081);
  const adminPort = Number(env.ADMIN_PORT || 8082);
  const maxMessages = Number(env.CONTACT_MAX_MESSAGES || DEFAULT_MAX_MESSAGES);
  const key = Buffer.from(env.CONTACT_ENCRYPTION_KEY || "", "base64");
  if (![port, adminPort].every((value) => Number.isInteger(value) && value >= 1 && value <= 65535) || port === adminPort ||
      key.length !== 32 || key.toString("base64") !== env.CONTACT_ENCRYPTION_KEY ||
      typeof env.CONTACT_ADMIN_TOKEN !== "string" || env.CONTACT_ADMIN_TOKEN.length < 32 || /[\s\x00-\x1f\x7f]/.test(env.CONTACT_ADMIN_TOKEN) ||
      !env.CONTACT_STORE_DIR || !isAbsolute(env.CONTACT_STORE_DIR) ||
      !Number.isSafeInteger(maxMessages) || maxMessages < 1 || maxMessages > 10_000) throw new Error("Invalid contact inbox configuration");
  let ntfyUrl;
  try { ntfyUrl = new URL(env.NTFY_URL); } catch { throw new Error("Invalid notification configuration"); }
  // A short service name resolves in the pod's namespace. Loopback is for local
  // protocol tests; direct publication to external services is excluded.
  if (ntfyUrl.protocol !== "http:" || !(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(ntfyUrl.hostname) || ntfyUrl.hostname === "127.0.0.1" || ntfyUrl.hostname === "[::1]") ||
      ntfyUrl.username || ntfyUrl.password || ntfyUrl.search || ntfyUrl.hash ||
      !/^\/[A-Za-z0-9_-]{1,64}$/.test(ntfyUrl.pathname) ||
      !/^tk_[A-Za-z0-9]{29}$/.test(env.NTFY_TOKEN || "") || env.NTFY_TOKEN.length !== 32) throw new Error("Invalid notification configuration");
  return { origins, trustedProxies, port, adminPort, directory: env.CONTACT_STORE_DIR, key, maxMessages,
    adminToken: env.CONTACT_ADMIN_TOKEN, ntfyUrl: ntfyUrl.href, ntfyToken: env.NTFY_TOKEN };
}

function validate(data, now) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (Object.keys(data).some((key) => !["name", "email", "message", "website", "startedAt"].includes(key))) return null;
  if (data.name !== undefined && (typeof data.name !== "string" || data.name.length > 120 || /[\u0000-\u001f\u007f]/.test(data.name))) return null;
  if (data.website !== undefined && (typeof data.website !== "string" || data.website !== "")) return null;
  if (typeof data.email !== "string" || data.email.length > 254 || !EMAIL.test(data.email)) return null;
  if (typeof data.message !== "string" || data.message.length > LIMITS.message ||
      data.message.trim().length < 10 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.message)) return null;
  if (!Number.isSafeInteger(data.startedAt) || now - data.startedAt < LIMITS.minFill || now - data.startedAt > LIMITS.maxFill) return null;
  return { name: data.name?.trim() || "", email: data.email, message: data.message.trim() };
}

function clientIp(req, trustedProxies) {
  const peer = req.socket.remoteAddress || "unknown";
  const header = req.headers["x-contact-client-ip"];
  if (trustedProxies.has(peer) && typeof header === "string" && isIP(header)) return header;
  return peer;
}

export function createContactServer({ origins, trustedProxies = new Set(), store, notify, onEvent = () => {}, clock = Date.now }) {
  const rates = new Map();
  let globalStart = clock(), globalCount = 0, requests = 0, deliveries = 0;
  const prune = () => {
    const now = clock();
    for (const [ip, entry] of rates) if (now - entry.start >= LIMITS.window) rates.delete(ip);
  };
  const cleanup = setInterval(prune, 60_000);
  cleanup.unref();
  function admit(ip) {
    const now = clock();
    prune();
    if (now - globalStart >= LIMITS.window) { globalStart = now; globalCount = 0; }
    const entry = rates.get(ip);
    if (globalCount >= LIMITS.global || (entry && entry.count >= LIMITS.perIp) || (!entry && rates.size >= LIMITS.ips)) return false;
    rates.set(ip, { start: entry?.start ?? now, count: (entry?.count ?? 0) + 1 });
    globalCount++;
    return true;
  }
  const server = http.createServer({ maxHeaderSize: 8192, headersTimeout: 5000, requestTimeout: 10_000,
    keepAliveTimeout: 1000, connectionsCheckingInterval: 1000 }, async (req, res) => {
    const reply = (status, error) => {
      if (res.destroyed || res.writableEnded) return;
      if (status === 429) res.setHeader("Retry-After", "900");
      if (status === 503) res.setHeader("Retry-After", "60");
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Connection": "close" });
      res.end(JSON.stringify(error ? { ok: false, error } : { ok: true }));
    };
    if (req.url === "/healthz" && req.method === "GET") { reply(200); return; }
    if (req.url !== "/api/contact") { reply(404, "invalid_request"); return; }
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); reply(405, "invalid_request"); return; }
    if (!origins.has(req.headers.origin) || (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin")) { reply(403, "forbidden"); return; }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers["content-type"] || "") || req.headers["content-encoding"]) { reply(415, "invalid_request"); return; }
    if (Number(req.headers["content-length"]) > LIMITS.body) { reply(413, "invalid_request"); return; }
    if (requests >= LIMITS.requests) { reply(503, "unavailable"); return; }
    if (!admit(clientIp(req, trustedProxies))) { reply(429, "rate_limited"); return; }
    requests++;
    let bodyTimer;
    try {
      const data = await new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0, ended = false;
        const fail = (status) => { if (!ended) { ended = true; reject(status); } };
        bodyTimer = setTimeout(() => fail(408), 3000);
        req.on("data", (chunk) => {
          if (ended) return;
          size += chunk.length;
          if (size > LIMITS.body) { fail(413); return; }
          chunks.push(chunk);
        });
        req.on("end", () => { if (!ended) { ended = true; resolve(Buffer.concat(chunks).toString("utf8")); } });
        req.on("aborted", () => fail(400));
        req.on("error", () => fail(400));
      });
      clearTimeout(bodyTimer);
      let parsed;
      try { parsed = JSON.parse(data); } catch { reply(400, "invalid_request"); return; }
      const contact = validate(parsed, clock());
      if (!contact) { reply(400, "invalid_request"); return; }
      if (deliveries >= LIMITS.deliveries) { reply(503, "unavailable"); return; }
      deliveries++;
      try {
        const id = await store.add(contact);
        let notification = "sent";
        try { await notify(); }
        catch { notification = "failed"; onEvent("inbox_notification_failed"); }
        try { await store.setNotification(id, notification); }
        catch { onEvent("inbox_notification_status_failed"); }
        reply(200);
      } catch { reply(503, "unavailable"); }
      finally { deliveries--; }
    } catch (status) { reply(typeof status === "number" ? status : 400, "invalid_request"); }
    finally { clearTimeout(bodyTimer); requests--; }
  });
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 1;
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("close", () => { clearInterval(cleanup); rates.clear(); });
  return server;
}
