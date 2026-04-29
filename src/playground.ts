export type StatusFilter = "all" | "running" | "succeeded" | "failed";
export type ApiMode = "images" | "responses";
export type Quality = "auto" | "low" | "medium" | "high";
export type OutputFormat = "png" | "jpeg" | "webp";
export type Moderation = "auto" | "low";
export type TaskStatus = "running" | "succeeded" | "failed";

export type Settings = {
  apiUrl: string;
  apiKey: string;
  codexCli: boolean;
  apiMode: ApiMode;
  mainModelId: string;
  modelId: string;
  toolName: string;
  timeoutSeconds: number;
};

export type Params = {
  size: string;
  quality: Quality;
  outputFormat: OutputFormat;
  compression: number | "";
  moderation: Moderation;
  count: number;
};

export type ReferenceImage = {
  id: string;
  name: string;
  dataUrl: string;
  mask: boolean;
};

export type Task = {
  id: string;
  prompt: string;
  params: Params;
  references: ReferenceImage[];
  status: TaskStatus;
  favorite: boolean;
  createdAt: number;
  finishedAt: number | null;
  outputImages: string[];
  error: string | null;
  revisedPrompt?: string;
};

export type AppState = {
  settings: Settings;
  params: Params;
  references: ReferenceImage[];
  tasks: Task[];
  selectedTaskIds: string[];
  statusFilter: StatusFilter;
  favoriteOnly: boolean;
  search: string;
  prompt: string;
};

export const defaultSettings: Settings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  codexCli: false,
  apiMode: "images",
  mainModelId: "gpt-5.5",
  modelId: "gpt-image-2",
  toolName: "image_generation",
  timeoutSeconds: 120
};

export const defaultParams: Params = {
  size: "auto",
  quality: "auto",
  outputFormat: "png",
  compression: "",
  moderation: "auto",
  count: 1
};

export function normalizePrompt(prompt: string): string {
  return prompt.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function canGenerate(prompt: string, settings: Settings): { ok: boolean; reason: string } {
  if (!settings.apiKey.trim()) return { ok: false, reason: "请先配置 API" };
  if (!normalizePrompt(prompt)) return { ok: false, reason: "请输入提示词" };
  return { ok: true, reason: "" };
}

export function updateParams(current: Params, patch: Partial<Params>): Params {
  const next = { ...current, ...patch };
  return {
    ...next,
    count: clampNumber(Number(next.count), 1, 4),
    compression: next.compression === "" ? "" : clampNumber(Number(next.compression), 0, 100)
  };
}

export function filterTasks(tasks: Task[], status: StatusFilter, favoriteOnly: boolean, query: string): Task[] {
  const keyword = query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (status !== "all" && task.status !== status) return false;
    if (favoriteOnly && !task.favorite) return false;
    if (!keyword) return true;
    return [
      task.prompt,
      task.params.size,
      task.params.quality,
      task.params.outputFormat,
      task.status,
      task.error ?? ""
    ].some((value) => String(value).toLowerCase().includes(keyword));
  });
}

export function createMockTask(
  prompt: string,
  params: Params,
  references: ReferenceImage[],
  now = Date.now()
): Task {
  const cleanPrompt = normalizePrompt(prompt);
  const task: Task = {
    id: `task-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: cleanPrompt,
    params: { ...params },
    references: references.map((reference) => ({ ...reference })),
    status: "succeeded",
    favorite: false,
    createdAt: now,
    finishedAt: now + 1320,
    outputImages: [],
    error: null
  };
  return {
    ...task,
    outputImages: buildMockOutputs(task)
  };
}

export function createPendingTask(
  prompt: string,
  params: Params,
  references: ReferenceImage[],
  now = Date.now()
): Task {
  return {
    id: `task-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: normalizePrompt(prompt),
    params: { ...params },
    references: references.map((reference) => ({ ...reference })),
    status: "running",
    favorite: false,
    createdAt: now,
    finishedAt: null,
    outputImages: [],
    error: null
  };
}

export function completeTask(task: Task, outputImages: string[], revisedPrompt?: string, now = Date.now()): Task {
  return {
    ...task,
    status: "succeeded",
    finishedAt: now,
    outputImages,
    error: null,
    revisedPrompt
  };
}

export function failTask(task: Task, error: string, now = Date.now()): Task {
  return {
    ...task,
    status: "failed",
    finishedAt: now,
    error
  };
}

export function summarizeParams(params: Params): string {
  const compression = params.outputFormat === "png" ? "PNG 无压缩" : `${params.compression || 100}%`;
  return `${params.size} · ${params.quality} · ${params.outputFormat.toUpperCase()} · ${compression} · ${params.count} 张`;
}

function buildMockOutputs(task: Task): string[] {
  return Array.from({ length: task.params.count }, (_, index) => {
    const prompt = escapeXml(task.prompt.slice(0, 42) || "AlexAI GPT Image");
    const palettes = [
      ["#f8fafc", "#dbeafe", "#2563eb"],
      ["#fff7ed", "#fed7aa", "#ea580c"],
      ["#f0fdf4", "#bbf7d0", "#16a34a"],
      ["#faf5ff", "#e9d5ff", "#7c3aed"]
    ];
    const [bg, soft, main] = palettes[index % palettes.length] ?? palettes[0];
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${bg}"/>
            <stop offset="1" stop-color="${soft}"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="20" stdDeviation="26" flood-color="#0f172a" flood-opacity=".18"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg)"/>
        <rect x="118" y="118" width="788" height="788" rx="58" fill="#fff" filter="url(#shadow)"/>
        <rect x="176" y="176" width="672" height="430" rx="34" fill="${main}" opacity=".14"/>
        <circle cx="710" cy="296" r="70" fill="#fbbf24"/>
        <path d="M210 548 374 364l122 132 86-96 232 252H210Z" fill="${main}" opacity=".72"/>
        <text x="176" y="712" font-size="50" font-family="Arial, sans-serif" font-weight="700" fill="#111827">AlexAI Preview</text>
        <text x="176" y="774" font-size="29" font-family="Arial, sans-serif" fill="#475569">${prompt}</text>
        <text x="176" y="836" font-size="24" font-family="Arial, sans-serif" fill="#64748b">${task.params.size} · ${task.params.quality} · ${task.params.outputFormat.toUpperCase()}</text>
      </svg>
    `)}`;
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
