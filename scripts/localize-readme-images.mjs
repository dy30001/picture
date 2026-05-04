import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheTemplatePreviews } from "./template-preview-cache.mjs";
import { compressTemplatePreviews } from "./compress-template-previews.mjs";

const publicDir = join(process.cwd(), "public");

export async function localizeReadmeImages({
  publicDir: targetPublicDir = publicDir,
  readmeFile = "README_zh.md",
  concurrency = 12
} = {}) {
  const readmePath = join(targetPublicDir, readmeFile);
  const original = await readFile(readmePath, "utf8");
  const items = collectReadmeImages(original);
  const externalItems = items.filter((item) => /^https?:/i.test(item.imageUrl));
  if (!externalItems.length) {
    return {
      totalImages: items.length,
      externalImages: 0,
      localizedImages: 0,
      compressed: 0,
      savedMB: 0,
      templates: items
    };
  }

  const cachedItems = await cacheTemplatePreviews(externalItems, {
    publicDir: targetPublicDir,
    concurrency
  });
  const compressionSummary = await compressTemplatePreviews({
    publicDir: targetPublicDir,
    extraTemplates: cachedItems,
    includeJsonTemplates: false
  });
  const updatedItemsByKey = new Map(cachedItems.map((item) => [item.key, item]));
  const replacements = externalItems
    .map((item) => ({ ...item, localUrl: updatedItemsByKey.get(item.key)?.imageUrl || item.imageUrl }))
    .filter((item) => item.localUrl && item.localUrl !== item.imageUrl)
    .sort((left, right) => right.start - left.start);

  let updated = original;
  for (const item of replacements) {
    updated = `${updated.slice(0, item.start)}${item.tag.replace(item.imageUrl, item.localUrl)}${updated.slice(item.end)}`;
  }

  await writeFile(readmePath, updated);
  return {
    totalImages: items.length,
    externalImages: externalItems.length,
    localizedImages: replacements.length,
    compressed: compressionSummary.optimized,
    savedMB: compressionSummary.savedMB,
    templates: [...items.filter((item) => !/^https?:/i.test(item.imageUrl)), ...cachedItems]
  };
}

function collectReadmeImages(markdown) {
  const headings = [...markdown.matchAll(/^### No\. (\d+): (.+)$/gm)];
  const items = [];
  for (const [headingIndex, heading] of headings.entries()) {
    const sectionStart = heading.index ?? 0;
    const sectionEnd = headings[headingIndex + 1]?.index ?? markdown.length;
    const section = markdown.slice(sectionStart, sectionEnd);
    const images = [...section.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
    for (const [imageIndex, image] of images.entries()) {
      const templateId = `tpl-${headingIndex + 1}`;
      const id = imageIndex === 0 ? templateId : `${templateId}-image-${imageIndex + 1}`;
      const start = sectionStart + (image.index ?? 0);
      items.push({
        id,
        key: `${id}:${start}`,
        title: heading[2]?.trim() || templateId,
        imageUrl: image[1] || "",
        sourceUrl: "",
        previewSourceUrl: image[1] || "",
        tag: image[0],
        start,
        end: start + image[0].length
      });
    }
  }
  return items;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  localizeReadmeImages()
    .then((summary) => {
      const { templates, ...output } = summary;
      console.log(JSON.stringify(output, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
