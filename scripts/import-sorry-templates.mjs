import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheTemplatePreviews, clearOrphanedTemplatePreviews } from "./template-preview-cache.mjs";

const sourceListUrl = "https://img.sorry.ink/api/templates";
const sourceTemplateUrl = "https://img.sorry.ink/api/templates/";
const outputPath = new URL("../public/sorry-templates.json", import.meta.url);
const readmePath = new URL("../public/README_zh.md", import.meta.url);
const publicDir = join(process.cwd(), "public");
const maxPerCategory = 260;
const maxTotal = 2200;
const detailConcurrency = 12;
const previewConcurrency = 12;
const genericTokens = new Set([
  "生成", "现代", "详细", "高清", "风格", "设计", "场景", "具有", "包含", "一个", "使用", "模板", "图片",
  "image", "style", "modern", "detailed", "generate", "featuring", "with", "using", "design", "scene",
  "prompt", "default", "theme", "color", "main", "high", "quality"
]);

const existingMarkdown = await readFile(readmePath, "utf8");
const existingDocs = parseExistingTemplates(existingMarkdown);
const localTemplates = await readLocalTemplates(outputPath);
const sourceList = await fetchJson(sourceListUrl);

const existingFingerprints = new Set(existingDocs.flatMap((item) => styleFingerprints(item)));
const selected = [];
const selectedFingerprints = new Set();
const categoryCounts = new Map();
const sourceByCategory = groupByCategory(sourceList);
const categoryOrder = [...sourceByCategory.entries()]
  .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0], "zh-CN"))
  .map(([category]) => category);

let cursor = 0;
while (selected.length < maxTotal && categoryOrder.length) {
  const category = categoryOrder[cursor % categoryOrder.length];
  const group = sourceByCategory.get(category) || [];
  const item = group.shift();
  if (!item) {
    categoryOrder.splice(cursor % categoryOrder.length, 1);
    continue;
  }
  cursor += 1;
  if ((categoryCounts.get(category) || 0) >= maxPerCategory) continue;
  const candidate = normalizeSourceSummary(item);
  const fingerprints = styleFingerprints(candidate);
  if (fingerprints.some((fingerprint) => existingFingerprints.has(fingerprint) || selectedFingerprints.has(fingerprint))) continue;
  selected.push(candidate);
  categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  for (const fingerprint of fingerprints) selectedFingerprints.add(fingerprint);
}

const enriched = [];
const enrichedTitleKeys = new Set();
for (const item of await mapLimit(selected, detailConcurrency, enrichTemplate)) {
  if (!item) continue;
  const titleKey = `${item.category}:${item.title}`;
  if (enrichedTitleKeys.has(titleKey)) continue;
  enrichedTitleKeys.add(titleKey);
  enriched.push(item);
}

async function enrichTemplate(item) {
  const detail = await fetchJson(`${sourceTemplateUrl}${item.sourceId}`);
  const variables = parseVariables(detail.variables || item.variables);
  const prompt = applyVariableDefaults(String(detail.prompt || ""), variables);
  if (!prompt.trim()) return null;
  return {
    id: `sorry-${item.sourceId}`,
    sourceId: item.sourceId,
    title: item.title,
    titleEn: item.titleEn,
    category: item.category,
    description: item.description,
    prompt,
    imageUrl: item.imageUrl,
    previewSourceUrl: item.imageUrl,
    sourceUrl: "https://img.sorry.ink/templates",
    language: /[\u4e00-\u9fff]/.test(prompt) ? "ZH" : "EN",
    importedAt: new Date().toISOString().slice(0, 10)
  };
}

const cached = await cacheTemplatePreviews(enriched, {
  publicDir,
  concurrency: previewConcurrency
});
const allTemplates = [...localTemplates, ...cached];
await clearOrphanedTemplatePreviews(publicDir, allTemplates);
await writeFile(outputPath, `${JSON.stringify({ source: sourceListUrl, imported: enriched.length, local: localTemplates.length, templates: allTemplates }, null, 2)}\n`);

console.log(JSON.stringify({
  source: sourceListUrl,
  sourceCount: sourceList.length,
  selected: enriched.length,
  cachedPreviews: cached.filter((item) => String(item.imageUrl || "").startsWith("/template-previews/")).length,
  local: localTemplates.length,
  maxPerCategory,
  categories: Object.fromEntries([...categoryCounts.entries()].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")))
}, null, 2));

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return await response.json();
}

async function readLocalTemplates(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    const list = Array.isArray(parsed.templates) ? parsed.templates : [];
    return list.filter((item) => String(item.sourceUrl || "").startsWith("local://") || String(item.sourceId || "").startsWith("local-"));
  } catch {
    return [];
  }
}

function groupByCategory(list) {
  const grouped = new Map();
  for (const item of list) {
    const category = String(item.category || "其他");
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  }
  return grouped;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeSourceSummary(item) {
  return {
    sourceId: Number(item.id),
    title: String(item.name_zh || item.name || `模板 ${item.id}`),
    titleEn: String(item.name || ""),
    category: String(item.category || "其他"),
    description: String(item.description_zh || item.description || ""),
    imageUrl: String(item.preview_url || ""),
    variables: parseVariables(item.variables)
  };
}

function parseVariables(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function applyVariableDefaults(prompt, variables) {
  const byKey = new Map(variables.map((item) => [String(item.key || ""), String(item.default || item.label_zh || item.label || item.key || "")]));
  return prompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => byKey.get(String(key).trim()) || String(key).trim());
}

function parseExistingTemplates(markdown) {
  const matches = [...markdown.matchAll(/^### No\. \d+: (.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index || 0;
    const end = matches[index + 1]?.index || markdown.length;
    const section = markdown.slice(start, end);
    return {
      title: match[1],
      category: inferCategory(match[1]),
      description: section.match(/#### 📖 描述\s*([\s\S]*?)(?=\n#### )/)?.[1] || "",
      prompt: section.match(/#### 📝 提示词\s*```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```/)?.[1] || ""
    };
  });
}

function inferCategory(title) {
  const separator = title.indexOf(" - ");
  return separator > 0 ? title.slice(0, separator) : "";
}

function styleFingerprints(item) {
  const text = `${item.category} ${item.title} ${item.titleEn || ""} ${item.description || ""} ${(item.variables || []).map((variable) => `${variable.key || ""} ${variable.default || ""}`).join(" ")}`;
  const tokens = tokenize(text);
  const head = tokens.slice(0, 7).join("-");
  const category = normalizeToken(item.category || "其他");
  const specific = tokens.filter((token) => !genericTokens.has(token)).slice(0, 5).join("-");
  return [head, `${category}:${specific}`].filter((value) => value.length > 4);
}

function tokenize(value) {
  const raw = String(value || "")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/gu) || [];
  const tokens = raw.map(normalizeToken).filter((token) => token && !genericTokens.has(token));
  return [...new Set(tokens)].slice(0, 24);
}

function normalizeToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu, "");
}
