import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SCRIPT = `
const form = document.querySelector('form'), tokenInput = document.querySelector('#token');
const status = document.querySelector('#status'), list = document.querySelector('#list'), detail = document.querySelector('#detail');
let token = '', selected = '';
async function request(path, method = 'GET') {
  const response = await fetch(path, { method, headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Zugriff verweigert. Token prüfen.' : 'Posteingang derzeit nicht verfügbar.');
  return response.json();
}
async function refresh() {
  const data = await request('/api/inbox'); list.replaceChildren(); detail.replaceChildren(); selected = '';
  status.textContent = data.messages.length + ' gespeicherte Anfrage(n). Automatische Löschung nach 90 Tagen.';
  for (const message of data.messages) {
    const item = document.createElement('li'), button = document.createElement('button');
    button.textContent = new Date(message.createdAt).toLocaleString('de-DE') + ' · Benachrichtigung: ' + message.notification;
    button.onclick = async () => {
      try {
        const record = await request('/api/inbox/' + message.id); selected = record.id; detail.replaceChildren();
        const heading = document.createElement('h2'); heading.textContent = record.name || 'Kontaktanfrage';
        const email = document.createElement('p'); email.textContent = 'Antwortadresse: ' + record.email;
        const text = document.createElement('pre'); text.textContent = record.message;
        const remove = document.createElement('button'); remove.textContent = 'Anfrage endgültig löschen';
        remove.onclick = async () => { if (!confirm('Diese Anfrage endgültig löschen?')) return; try { await request('/api/inbox/' + selected, 'DELETE'); await refresh(); } catch (error) { status.textContent = error.message; } };
        detail.append(heading, email, text, remove);
      } catch (error) { status.textContent = error.message; }
    };
    item.append(button); list.append(item);
  }
}
form.onsubmit = async (event) => { event.preventDefault(); token = tokenInput.value; tokenInput.value = ''; try { await refresh(); } catch (error) { token = ''; list.replaceChildren(); detail.replaceChildren(); status.textContent = error.message; } };
document.querySelector('#logout').onclick = () => { token = ''; tokenInput.value = ''; list.replaceChildren(); detail.replaceChildren(); status.textContent = 'Abgemeldet.'; };
`;

function page(nonce) {
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stadtstack · Privater Posteingang</title>
<style nonce="${nonce}">body{font:16px system-ui,sans-serif;max-width:900px;margin:3rem auto;padding:0 1rem;color:#18312e;background:#f6f8f7}h1{font-size:2rem}form,section{padding:1.5rem;background:white;border:1px solid #c9d7d1;border-radius:12px;margin:1rem 0}input,button{font:inherit;padding:.65rem;border:1px solid #768f84;border-radius:6px}input{max-width:100%;box-sizing:border-box}button{cursor:pointer;background:#e5f1eb;color:#18312e;margin:.25rem}li{margin:.5rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}label{display:block;margin-bottom:.5rem}</style>
<header><h1>Privater Kontakt-Posteingang</h1><p>Nur für die berechtigte Verwaltung. Kein öffentlicher Zugang.</p></header>
<form><label for="token">Zugriffstoken</label><input id="token" type="password" required autocomplete="off" spellcheck="false"><button type="submit">Posteingang öffnen / aktualisieren</button><button id="logout" type="button">Abmelden</button><p>Das Token bleibt ausschließlich im Arbeitsspeicher dieses Tabs.</p></form>
<p id="status" role="status">Bitte mit dem privaten Zugriffstoken anmelden.</p><section aria-label="Anfragen"><ul id="list"></ul></section><section id="detail" aria-label="Ausgewählte Anfrage"></section>
<script nonce="${nonce}">${SCRIPT}</script></html>`;
}

export function createAdminServer({ store, adminToken }) {
  if (typeof adminToken !== "string" || adminToken.length < 32) throw new Error("Invalid admin token");
  const expected = createHash("sha256").update(`Bearer ${adminToken}`).digest();
  const server = http.createServer({ maxHeaderSize: 8192, headersTimeout: 5000, requestTimeout: 10_000,
    keepAliveTimeout: 1000, connectionsCheckingInterval: 1000 }, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const reply = (status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
    if (req.url === "/healthz" && req.method === "GET") { reply(200, { ok: true }); return; }
    if (req.url === "/" && req.method === "GET") {
      const nonce = randomBytes(18).toString("base64");
      res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(page(nonce)); return;
    }
    const supplied = createHash("sha256").update(req.headers.authorization || "").digest();
    if (!timingSafeEqual(expected, supplied)) { res.setHeader("WWW-Authenticate", "Bearer"); reply(401, { ok: false, error: "unauthorized" }); return; }
    if (req.headers.origin) {
      let allowed = false;
      try { const origin = new URL(req.headers.origin); allowed = ["http:", "https:"].includes(origin.protocol) && origin.host === req.headers.host; } catch {}
      if (!allowed) { reply(403, { ok: false, error: "forbidden" }); return; }
    }
    try {
      if (req.url === "/api/inbox" && req.method === "GET") { reply(200, { messages: await store.list() }); return; }
      const match = /^\/api\/inbox\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(req.url);
      if (match && req.method === "GET") {
        const record = await store.get(match[1]); reply(record ? 200 : 404, record || { ok: false, error: "not_found" }); return;
      }
      if (match && req.method === "DELETE") {
        const removed = await store.delete(match[1]); reply(removed ? 200 : 404, removed ? { ok: true } : { ok: false, error: "not_found" }); return;
      }
      reply(404, { ok: false, error: "not_found" });
    } catch { reply(503, { ok: false, error: "unavailable" }); }
  });
  server.maxConnections = 16;
  server.maxRequestsPerSocket = 100;
  server.on("clientError", (_error, socket) => socket.destroy());
  return server;
}
