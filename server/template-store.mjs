import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export function createTemplateStore({ publicDir }) {
  const readmePath = join(publicDir, "README_zh.md");
  const extraPath = join(publicDir, "sorry-templates.json");
  let cache = null;
  let pending = null;
  let pendingSignature = "";

  async function snapshot() {
    const signature = await templateSignature(readmePath, extraPath);
    if (cache?.signature === signature) return cache;
    if (!pending || pendingSignature !== signature) {
      pendingSignature = signature;
      pending = buildSnapshot(readmePath, extraPath, signature).finally(() => {
        pending = null;
        pendingSignature = "";
      });
    }
    cache = await pending;
    return cache;
  }

  return {
    async catalog({ full = false } = {}) {
      const current = await snapshot();
      return {
        total: current.templates.length,
        templates: full ? current.templates : current.summaries,
        categories: current.categories
      };
    },
    async find(id) {
      const current = await snapshot();
      return current.byId.get(String(id)) || null;
    }
  };
}

async function buildSnapshot(readmePath, extraPath, signature) {
  const markdown = await readFile(readmePath, "utf8");
  const templates = dedupeTemplates([
    ...parsePromptTemplates(markdown),
    ...await loadExtraPromptTemplates(extraPath)
  ]);
  return {
    signature,
    templates,
    summaries: templates.map(summarizeTemplate),
    categories: promptTemplateCategories(templates),
    byId: new Map(templates.map((template) => [template.id, template]))
  };
}

async function templateSignature(...paths) {
  const parts = await Promise.all(paths.map(async (path) => {
    try {
      const info = await stat(path);
      return `${path}:${info.size}:${Math.round(info.mtimeMs)}`;
    } catch {
      return `${path}:missing`;
    }
  }));
  return parts.join("|");
}

function summarizeTemplate(template) {
  const promptPreview = compactText(template.prompt, 180);
  return {
    id: template.id,
    title: template.title,
    category: template.category,
    description: compactText(template.description, 180),
    imageUrl: template.imageUrl,
    featured: template.featured,
    language: template.language,
    sourceUrl: template.sourceUrl,
    promptPreview,
    promptLength: template.prompt.length
  };
}

function compactText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function parsePromptTemplates(markdown) {
  const allPromptsAt = markdown.indexOf("## 📋 所有提示词");
  const matches = [...markdown.matchAll(/^### No\. (\d+): (.+)$/gm)];
  return matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const prompt = extractPrompt(section);
    if (!prompt) return [];
    const title = match[2]?.trim() ?? `模板 ${index + 1}`;
    return [{
      id: `tpl-${index + 1}`,
      index: Number(match[1]) || index + 1,
      title,
      category: extractCategory(title, start < allPromptsAt || allPromptsAt < 0),
      description: extractDescription(section),
      prompt,
      language: extractLanguage(section),
      imageUrl: extractImageUrl(section),
      sourceUrl: extractTryUrl(section),
      featured: start < allPromptsAt || allPromptsAt < 0,
      raycast: /Raycast/i.test(section)
    }];
  });
}

async function loadExtraPromptTemplates(extraPath) {
  try {
    const text = await readFile(extraPath, "utf8");
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.templates) ? parsed.templates : [];
    return list.map((item, index) => ({
      id: String(item.id || `extra-${index + 1}`),
      index: Number(item.index) || index + 1,
      title: String(item.title || item.name || `补充模板 ${index + 1}`),
      category: String(item.category || "补充模板"),
      description: String(item.description || ""),
      prompt: String(item.prompt || ""),
      language: String(item.language || "MIX"),
      imageUrl: String(item.imageUrl || item.preview_url || ""),
      sourceUrl: String(item.sourceUrl || ""),
      featured: Boolean(item.featured),
      raycast: false
    })).filter((item) => item.prompt);
  } catch {
    return [];
  }
}

function dedupeTemplates(templates) {
  const seen = new Set();
  const seenTitles = new Set();
  const result = [];
  for (const template of templates) {
    const titleKey = normalizeTemplateKey(`${template.category} ${template.title}`);
    if (titleKey && seenTitles.has(titleKey)) continue;
    const key = normalizeTemplateKey(`${template.title} ${template.prompt.slice(0, 180)}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (titleKey) seenTitles.add(titleKey);
    result.push(template);
  }
  return result;
}

function normalizeTemplateKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 220);
}

const priorityCategories = ["婚纱照", "人像基准", "情侣照", "闺蜜照", "女生写真", "10岁照", "10 岁照", "夕阳红"];

function promptTemplateCategories(templates, max = 16) {
  const counts = new Map();
  for (const template of templates) counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
  const byCount = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .map(([category]) => category);
  const result = [];
  for (const category of priorityCategories) {
    if (counts.has(category)) result.push(category);
  }
  for (const category of byCount) {
    if (!result.includes(category)) result.push(category);
    if (result.length >= max) break;
  }
  return result;
}

function extractPrompt(section) {
  return section.match(/#### 📝 提示词\s*```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```/)?.[1]?.trim() ?? "";
}

function extractDescription(section) {
  return cleanupMarkdown(section.match(/#### 📖 描述\s*([\s\S]*?)(?=\n#### )/)?.[1] ?? "");
}

function extractLanguage(section) {
  return section.match(/!\[Language-([^\]]+)\]/)?.[1]?.toUpperCase() ?? "UNK";
}

function extractImageUrl(section) {
  return section.match(/<img src="([^"]+)"/)?.[1] ?? "";
}

function extractTryUrl(section) {
  return section.match(/\*\*\[👉 立即尝试 →\]\(([^)]+)\)\*\*/)?.[1] ?? "";
}

function extractCategory(title, featured) {
  if (featured) return "精选";
  const separator = title.indexOf(" - ");
  if (separator > 0) return title.slice(0, separator).trim();
  const slash = title.indexOf(" / ");
  if (slash > 0) return title.slice(0, slash).trim();
  return "其他";
}

function cleanupMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
