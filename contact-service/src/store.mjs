import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const PURGE_INTERVAL_MS = 60_000;
const MAGIC = Buffer.from("SCI1");
const MAX_RECORD_BYTES = 32_768;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// A single process owns this directory. All metadata, including timestamps and
// notification status, is authenticated ciphertext; only random IDs are filenames.
export async function createStore({ directory, key, maxMessages = 1000, clock = Date.now,
  onEvent = () => {}, purgeInterval = PURGE_INTERVAL_MS }) {
  if (!Buffer.isBuffer(key) || key.length !== 32 || !Number.isSafeInteger(maxMessages) || maxMessages < 1 || maxMessages > 10_000) throw new Error("Invalid inbox configuration");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const records = new Map();
  let queue = Promise.resolve();
  const serial = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const syncDirectory = async () => {
    const handle = await open(directory, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  };
  const decode = (bytes, id) => {
    if (bytes.length < 32 || bytes.length > MAX_RECORD_BYTES || !bytes.subarray(0, 4).equals(MAGIC)) throw new Error("Invalid inbox record");
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(4, 16));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(bytes.subarray(16, 32));
    const record = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(32)), decipher.final()]).toString("utf8"));
    if (record.id !== id || !Number.isSafeInteger(record.createdAt) || !["pending", "sent", "failed"].includes(record.notification) ||
        typeof record.name !== "string" || typeof record.email !== "string" || typeof record.message !== "string") throw new Error("Invalid inbox record");
    return record;
  };
  const readRecord = async (id) => {
    const path = join(directory, `${id}.enc`);
    if ((await stat(path)).size > MAX_RECORD_BYTES) throw new Error("Oversized inbox record");
    return decode(await readFile(path), id);
  };
  const persist = async (record) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(record.id));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
    const bytes = Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
    if (bytes.length > MAX_RECORD_BYTES) throw new Error("Oversized inbox record");
    const temporary = join(directory, `${record.id}.${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, join(directory, `${record.id}.enc`));
      await syncDirectory();
    } finally { await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
  };
  const purge = async () => {
    let changed = false;
    for (const [id, record] of records) {
      if (clock() - record.createdAt < RETENTION_MS) continue;
      await unlink(join(directory, `${id}.enc`));
      records.delete(id);
      changed = true;
    }
    if (changed) await syncDirectory();
  };
  for (const file of await readdir(directory)) {
    if (/^[0-9a-f-]{36}\.[0-9a-f-]{36}\.tmp$/.test(file)) { await unlink(join(directory, file)); continue; }
    if (!file.endsWith(".enc") || !ID.test(file.slice(0, -4))) throw new Error("Unexpected inbox file");
    const id = file.slice(0, -4);
    const record = await readRecord(id);
    records.set(id, { createdAt: record.createdAt });
  }
  await purge();
  await syncDirectory();
  const timer = setInterval(() => { serial(purge).catch(() => onEvent("inbox_purge_failed")); }, purgeInterval);
  timer.unref();
  return {
    add(contact) { return serial(async () => {
      await purge();
      if (records.size >= maxMessages) throw new Error("Inbox capacity reached");
      const record = { ...contact, id: randomUUID(), createdAt: clock(), notification: "pending" };
      // Reserve capacity before writing: even an ambiguous fsync failure must
      // never let subsequent requests overfill or overwrite the retained record.
      records.set(record.id, { createdAt: record.createdAt });
      try { await persist(record); }
      catch (error) {
        try { await stat(join(directory, `${record.id}.enc`)); }
        catch (missing) { if (missing.code === "ENOENT") records.delete(record.id); }
        throw error;
      }
      return record.id;
    }); },
    list() { return serial(async () => {
      await purge();
      const list = [];
      for (const id of records.keys()) {
        const { createdAt, notification } = await readRecord(id);
        list.push({ id, createdAt, notification });
      }
      return list.sort((a, b) => b.createdAt - a.createdAt);
    }); },
    get(id) { return serial(async () => { await purge(); return records.has(id) ? readRecord(id) : null; }); },
    delete(id) { return serial(async () => {
      await purge();
      if (!records.has(id)) return false;
      await unlink(join(directory, `${id}.enc`));
      records.delete(id);
      await syncDirectory();
      return true;
    }); },
    setNotification(id, notification) { return serial(async () => {
      if (!["sent", "failed"].includes(notification)) throw new Error("Invalid notification status");
      if (!records.has(id)) return;
      const record = await readRecord(id);
      await persist({ ...record, notification });
    }); },
    purge() { return serial(purge); },
    async close() { clearInterval(timer); await queue; },
  };
}

export function createNotifier(url, token) {
  if (!/^tk_[A-Za-z0-9]{29}$/.test(token || "") || token.length !== 32) throw new Error("Invalid notification token");
  return async () => {
    const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(3000),
      headers: { "Content-Type": "text/plain; charset=utf-8", Authorization: `Bearer ${token}` },
      body: "Neue Kontaktanfrage auf stadtstack.eu" });
    const ok = response.ok;
    await response.body?.cancel();
    if (!ok) throw new Error("Notification failed");
  };
}
