export type PromptTemplate = {
  id: string;
  index: number;
  title: string;
  category: string;
  description: string;
  prompt: string;
  language: string;
  imageUrl: string;
  sourceUrl: string;
  featured: boolean;
  raycast: boolean;
};

export function parsePromptTemplates(markdown: string): PromptTemplate[] {
  const allPromptsAt = markdown.indexOf("## 📋 所有提示词");
  const matches = [...markdown.matchAll(/^### No\. (\d+): (.+)$/gm)];
  return matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const prompt = extractPrompt(section);
    if (!prompt) return [];
    const title = match[2]?.trim() ?? `模板 ${index + 1}`;
    return [
      {
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
      }
    ];
  });
}

export function filterPromptTemplates(
  templates: PromptTemplate[],
  query: string,
  category: string
): PromptTemplate[] {
  const keyword = query.trim().toLowerCase();
  return templates.filter((template) => {
    if (category === "featured" && !template.featured) return false;
    if (category !== "all" && category !== "featured" && template.category !== category) return false;
    if (!keyword) return true;
    return [template.title, template.category, template.description, template.prompt, template.language]
      .some((value) => value.toLowerCase().includes(keyword));
  });
}

export function promptTemplateCategories(templates: PromptTemplate[], max = 8): string[] {
  const counts = new Map<string, number>();
  for (const template of templates) {
    counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, max)
    .map(([category]) => category);
}

function extractPrompt(section: string): string {
  const match = section.match(/#### 📝 提示词\s*```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```/);
  return match?.[1]?.trim() ?? "";
}

function extractDescription(section: string): string {
  const match = section.match(/#### 📖 描述\s*([\s\S]*?)(?=\n#### )/);
  return cleanupMarkdown(match?.[1] ?? "");
}

function extractLanguage(section: string): string {
  return section.match(/!\[Language-([^\]]+)\]/)?.[1]?.toUpperCase() ?? "UNK";
}

function extractImageUrl(section: string): string {
  return section.match(/<img src="([^"]+)"/)?.[1] ?? "";
}

function extractTryUrl(section: string): string {
  return section.match(/\*\*\[👉 立即尝试 →\]\(([^)]+)\)\*\*/)?.[1] ?? "";
}

function extractCategory(title: string, featured: boolean): string {
  if (featured) return "精选";
  const separator = title.indexOf(" - ");
  if (separator > 0) return title.slice(0, separator).trim();
  const slash = title.indexOf(" / ");
  if (slash > 0) return title.slice(0, slash).trim();
  return "其他";
}

function cleanupMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
