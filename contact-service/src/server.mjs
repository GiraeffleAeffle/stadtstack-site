import { configFromEnv, createContactServer } from "./contact.mjs";
import { createAdminServer } from "./admin.mjs";
import { createNotifier, createStore } from "./store.mjs";

let store;
let servers = [];
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => servers.forEach((server) => server.closeAllConnections()), 15_000);
  force.unref();
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  await store?.close();
  clearTimeout(force);
}
const onEvent = (event) => {
  // Only fixed event codes; never request payloads, IPs, tokens, or remote errors.
  if (["inbox_purge_failed", "inbox_notification_failed", "inbox_notification_status_failed"].includes(event)) process.stderr.write(`${event}\n`);
};
try {
  const config = configFromEnv();
  store = await createStore({ ...config, onEvent });
  servers = [createContactServer({ ...config, store, notify: createNotifier(config.ntfyUrl, config.ntfyToken), onEvent }),
    createAdminServer({ ...config, store })];
  await Promise.all(servers.map((server, index) => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(index === 0 ? config.port : config.adminPort, "0.0.0.0", resolve);
  })));
  for (const server of servers) server.on("error", () => {
    process.stderr.write("Contact listener failed.\n"); process.exitCode = 1; void stop();
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop(); });
} catch {
  process.stderr.write("Contact service configuration or storage startup failed.\n");
  process.exitCode = 1;
  await stop();
}
