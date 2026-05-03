import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheTemplatePreviews, clearOrphanedTemplatePreviews } from "./template-preview-cache.mjs";

const publicDir = join(process.cwd(), "public");
const outputPath = join(publicDir, "sorry-templates.json");
const concurrency = 12;

const payload = JSON.parse(await readFile(outputPath, "utf8"));
const templates = Array.isArray(payload.templates) ? payload.templates : [];
const localItems = templates.filter((item) => String(item.sourceUrl || "").startsWith("local://") || String(item.sourceId || "").startsWith("local-"));
const externalItems = templates.filter((item) => !localItems.includes(item));

const cachedExternal = await cacheTemplatePreviews(externalItems, { publicDir, concurrency });
const nextTemplates = [...localItems, ...cachedExternal];

await clearOrphanedTemplatePreviews(publicDir, nextTemplates);
await writeFile(outputPath, `${JSON.stringify({ ...payload, templates: nextTemplates }, null, 2)}\n`);

// Remove an accidental old cache location if it exists from previous experiments.
await rm(join(process.cwd(), "template-previews"), { recursive: true, force: true });

console.log(JSON.stringify({
  total: nextTemplates.length,
  external: cachedExternal.length,
  local: localItems.length,
  cached: cachedExternal.filter((item) => String(item.imageUrl || "").startsWith("/template-previews/")).length
}, null, 2));
