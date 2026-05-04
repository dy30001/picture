import { chromium } from "playwright";
import { readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultPublicDir = join(root, "public");
const previewDirName = "template-previews";
const imageMimeTypes = {
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function compressTemplatePreviews({
  publicDir = defaultPublicDir,
  extraTemplates = [],
  includeJsonTemplates = true,
  maxEdge = Number(process.env.TEMPLATE_PREVIEW_MAX_EDGE || 480),
  quality = Number(process.env.TEMPLATE_PREVIEW_WEBP_QUALITY || 0.72),
  minSavingRatio = Number(process.env.TEMPLATE_PREVIEW_MIN_SAVING_RATIO || 0.05),
  removeReplaced = process.env.TEMPLATE_PREVIEW_KEEP_ORIGINALS !== "1",
  dryRun = false
} = {}) {
  const templateJsonPath = join(publicDir, "sorry-templates.json");
  const previewDir = join(publicDir, previewDirName);
  const payload = JSON.parse(await readFile(templateJsonPath, "utf8"));
  const jsonTemplates = includeJsonTemplates && Array.isArray(payload.templates) ? payload.templates : [];
  const jsonTemplateSet = new Set(jsonTemplates);
  const templates = [...jsonTemplates, ...extraTemplates];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const summary = {
    total: templates.length,
    checked: 0,
    optimized: 0,
    converted: 0,
    missing: 0,
    skipped: 0,
    beforeBytes: 0,
    afterBytes: 0,
    savedBytes: 0,
    maxEdge,
    quality
  };
  let changedJson = false;
  const processedUrls = new Set();

  try {
    for (const template of templates) {
      const imageUrl = String(template.imageUrl || "");
      if (processedUrls.has(imageUrl)) {
        summary.skipped += 1;
        continue;
      }
      processedUrls.add(imageUrl);
      if (!imageUrl.startsWith(`/${previewDirName}/`)) {
        summary.skipped += 1;
        continue;
      }
      const currentName = basename(imageUrl);
      const sourcePath = join(previewDir, currentName);
      if (!existsSync(sourcePath)) {
        summary.missing += 1;
        continue;
      }
      const extension = extname(sourcePath).toLowerCase();
      const mimeType = imageMimeTypes[extension];
      if (!mimeType) {
        summary.skipped += 1;
        continue;
      }

      const sourceBytes = await readFile(sourcePath);
      const originalSize = sourceBytes.length;
      const compressed = await encodeWebp(page, sourceBytes, mimeType, { maxEdge, quality });
      const targetName = `${currentName.slice(0, -extension.length)}.webp`;
      const targetPath = join(previewDir, targetName);
      const targetUrl = `/${previewDirName}/${targetName}`;
      const isMeaningfullySmaller = compressed.bytes.length < originalSize * (1 - minSavingRatio);

      summary.checked += 1;
      summary.beforeBytes += originalSize;

      if (!isMeaningfullySmaller) {
        summary.afterBytes += originalSize;
        summary.skipped += 1;
        continue;
      }

      summary.afterBytes += compressed.bytes.length;
      summary.savedBytes += originalSize - compressed.bytes.length;
      summary.optimized += 1;
      if (targetPath !== sourcePath) summary.converted += 1;

      if (!dryRun) {
        await writeFile(targetPath, compressed.bytes);
        if (targetPath !== sourcePath && removeReplaced) {
          await rm(sourcePath, { force: true });
        }
        if (template.imageUrl !== targetUrl) {
          template.imageUrl = targetUrl;
          if (jsonTemplateSet.has(template)) changedJson = true;
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (changedJson && !dryRun) {
    await writeFile(templateJsonPath, `${JSON.stringify({ ...payload, templates }, null, 2)}\n`);
  }

  return {
    ...summary,
    beforeMB: toMB(summary.beforeBytes),
    afterMB: toMB(summary.afterBytes),
    savedMB: toMB(summary.savedBytes)
  };
}

async function encodeWebp(page, sourceBytes, mimeType, { maxEdge, quality }) {
  const source = `data:${mimeType};base64,${sourceBytes.toString("base64")}`;
  const result = await page.evaluate(async ({ source, maxEdge, quality }) => {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    await image.decode();

    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("WebP encoding failed");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, width, height };
  }, { source, maxEdge, quality });
  const encoded = String(result.dataUrl || "");
  const marker = encoded.indexOf(",");
  if (marker < 0) throw new Error("Invalid encoded WebP data URL");
  return {
    bytes: Buffer.from(encoded.slice(marker + 1), "base64"),
    width: result.width,
    height: result.height
  };
}

function toMB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes("--dry-run");
  compressTemplatePreviews({ dryRun })
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
