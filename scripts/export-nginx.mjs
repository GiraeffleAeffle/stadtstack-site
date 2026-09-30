import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Static exports contain Next's inline hydration payloads. Hash the exact bytes
// rather than permitting arbitrary inline scripts or evaluating string code.
async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
const hashes = new Set();
for (const file of await htmlFiles("out")) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2]) continue;
    hashes.add(`'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`);
  }
}
if (!hashes.size) throw new Error("Export contains no hydration scripts; inspect the CSP generation before publishing.");
const template = await readFile("deploy/nginx.conf", "utf8");
if (!template.includes("__SCRIPT_CSP__")) throw new Error("Missing script CSP placeholder");
await writeFile(".next/export-nginx.conf", template.replace("__SCRIPT_CSP__", [...hashes].sort().join(" ")));
console.log(`Generated nginx CSP for ${hashes.size} inline script payloads.`);
