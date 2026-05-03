import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

export const templatePreviewDirName = "template-previews";

export async function ensureTemplatePreviewDir(publicDir) {
  const dir = join(publicDir, templatePreviewDirName);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cacheTemplatePreviews(templates, {
  publicDir,
  concurrency = 10,
  timeoutMs = 20000
} = {}) {
  const templatePreviewDir = await ensureTemplatePreviewDir(publicDir);
  const tasks = templates.map((item, index) => async () => {
    try {
      return await cacheTemplatePreview(item, {
        publicDir,
        templatePreviewDir,
        index,
        timeoutMs
      });
    } catch (error) {
      return {
        ...item,
        previewSourceUrl: String(item.previewSourceUrl || item.remoteImageUrl || item.imageUrl || ""),
        previewCacheError: error instanceof Error ? error.message : String(error)
      };
    }
  });
  return await mapLimit(tasks, concurrency);
}

export function previewLocalPath(id, contentType = "image/webp") {
  return `/${templatePreviewDirName}/${safePreviewId(id)}${previewExtension(contentType)}`;
}

export function previewFilePath(publicDir, id, contentType = "image/webp") {
  return join(publicDir, templatePreviewDirName, `${safePreviewId(id)}${previewExtension(contentType)}`);
}

export function remotePreviewUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "cms-assets.youmind.com") {
      return `https://wsrv.nl/?url=${encodeURIComponent(parsed.toString())}&w=720&output=webp`;
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function cacheTemplatePreview(template, {
  publicDir,
  templatePreviewDir = join(publicDir, templatePreviewDirName),
  timeoutMs = 20000
} = {}) {
  const existingLocalPath = await findExistingPreviewPath(templatePreviewDir, template.id);
  if (existingLocalPath) {
    return {
      ...template,
      imageUrl: `/${templatePreviewDirName}/${existingLocalPath}`,
      previewSourceUrl: String(template.previewSourceUrl || template.remoteImageUrl || template.imageUrl || ""),
      previewCachedAt: String(template.previewCachedAt || new Date().toISOString())
    };
  }
  const sourceUrl = String(template.previewSourceUrl || template.remoteImageUrl || template.imageUrl || "").trim();
  if (!sourceUrl.startsWith("http")) return { ...template, imageUrl: String(template.imageUrl || "") };
  const remoteUrl = remotePreviewUrl(sourceUrl);
  if (!remoteUrl) return { ...template, imageUrl: String(template.imageUrl || "") };
  const response = await fetch(remoteUrl, {
    headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`preview fetch failed: ${response.status} ${remoteUrl}`);
  const contentType = normalizeContentType(response.headers.get("content-type"));
  const bytes = Buffer.from(await response.arrayBuffer());
  const filePath = join(templatePreviewDir, `${safePreviewId(template.id)}${previewExtension(contentType)}`);
  await mkdir(dirname(filePath), { recursive: true });
  const sameFile = await sameBytes(filePath, bytes);
  if (!sameFile) await writeFile(filePath, bytes);
  return {
    ...template,
    imageUrl: `/${templatePreviewDirName}/${safePreviewId(template.id)}${previewExtension(contentType)}`,
    previewSourceUrl: sourceUrl,
    previewCachedAt: new Date().toISOString()
  };
}

export async function clearOrphanedTemplatePreviews(publicDir, activeTemplates) {
  const templatePreviewDir = join(publicDir, templatePreviewDirName);
  const active = new Set(activeTemplates
    .map((item) => String(item.imageUrl || ""))
    .filter((value) => value.startsWith(`/${templatePreviewDirName}/`))
    .map((value) => value.slice(`/${templatePreviewDirName}/`.length)));
  try {
    const entries = await readFile(join(templatePreviewDir, ".keep"), "utf8");
    void entries;
  } catch {}
  try {
    const files = await readDirFiles(templatePreviewDir);
    await Promise.all(files
      .filter((name) => !active.has(name))
      .map((name) => rm(join(templatePreviewDir, name), { force: true })));
  } catch {
    return;
  }
}

async function readDirFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

async function sameBytes(path, nextBytes) {
  try {
    const info = await stat(path);
    if (info.size !== nextBytes.length) return false;
    const current = await readFile(path);
    return createHash("sha1").update(current).digest("hex") === createHash("sha1").update(nextBytes).digest("hex");
  } catch {
    return false;
  }
}

async function findExistingPreviewPath(templatePreviewDir, id) {
  const base = safePreviewId(id);
  for (const extension of [".webp", ".jpg", ".png", ".gif", ".avif", ".img"]) {
    const candidate = `${base}${extension}`;
    try {
      await stat(join(templatePreviewDir, candidate));
      return candidate;
    } catch {}
  }
  return "";
}

async function mapLimit(tasks, limit) {
  const results = new Array(tasks.length);
  let index = 0;
  const workerCount = Math.min(limit, tasks.length || 1);
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  });
  await Promise.all(workers);
  return results;
}

function safePreviewId(value) {
  return String(value || "template-preview")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "template-preview";
}

function normalizeContentType(value) {
  return String(value || "image/webp").split(";")[0].trim().toLowerCase() || "image/webp";
}

function previewExtension(contentType) {
  const direct = extname(contentType);
  if (direct) return direct;
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif"
  }[contentType] || ".img";
}
