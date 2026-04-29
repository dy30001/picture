import type { Params, ReferenceImage, Settings } from "./playground";

export type ImageApiResult = {
  images: string[];
  revisedPrompt?: string;
};

export type ApiTestResult = {
  ok: boolean;
  message: string;
};

type ImageResponseItem = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
};

type ImagesApiResponse = {
  data?: ImageResponseItem[];
  error?: { message?: string; type?: string; code?: string };
};

type ResponsesApiOutput = {
  type?: string;
  result?: string;
  revised_prompt?: string;
};

type ResponsesApiResponse = {
  output?: ResponsesApiOutput[];
  error?: { message?: string; type?: string; code?: string };
};

export async function generateOpenAIImage(
  settings: Settings,
  prompt: string,
  params: Params,
  references: ReferenceImage[]
): Promise<ImageApiResult> {
  if (settings.apiMode === "responses") {
    return generateViaResponsesApi(settings, prompt, params, references);
  }
  if (references.length > 0) {
    return editViaImagesApi(settings, prompt, params, references);
  }
  return generateViaImagesApi(settings, prompt, params);
}

export async function testOpenAIConnection(settings: Settings): Promise<ApiTestResult> {
  if (!settings.apiKey.trim()) {
    return { ok: false, message: "API Key 为空" };
  }
  try {
    const response = await fetchWithTimeout(joinUrl(settings.apiUrl, "/models"), settings, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`
      }
    });
    const json = await parseJson<{ data?: unknown[]; error?: { message?: string } }>(response);
    assertOk(response, json);
    const count = Array.isArray(json.data) ? json.data.length : 0;
    return { ok: true, message: count ? `连接成功，读取到 ${count} 个模型` : "连接成功" };
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      return { ok: false, message: "请求失败：请检查 API URL 或跨域/CORS 设置" };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim() || "https://alexai.work/v1";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    url.search = "";
    url.hash = "";
    const parts = url.pathname.split("/").filter(Boolean);
    const v1Index = parts.findIndex((part) => part === "v1");
    url.pathname = v1Index >= 0 ? `/${parts.slice(0, v1Index + 1).join("/")}` : "/v1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function buildImagesGenerationBody(settings: Settings, prompt: string, params: Params): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: settings.modelId.trim() || "gpt-image-2",
    prompt,
    n: params.count
  };
  addImageOptions(body, params);
  return body;
}

export function buildResponsesBody(
  settings: Settings,
  prompt: string,
  params: Params,
  references: ReferenceImage[]
): Record<string, unknown> {
  const tool: Record<string, unknown> = {
    type: settings.toolName.trim() || "image_generation",
    action: references.length > 0 ? "edit" : "generate"
  };
  addImageOptions(tool, params);

  const content: Record<string, string>[] = [{ type: "input_text", text: prompt }];
  for (const reference of references) {
    content.push({ type: "input_image", image_url: reference.dataUrl });
  }

  return {
    model: responseModel(settings.mainModelId),
    input: [{ role: "user", content }],
    tools: [tool],
    tool_choice: { type: settings.toolName.trim() || "image_generation" }
  };
}

async function generateViaImagesApi(settings: Settings, prompt: string, params: Params): Promise<ImageApiResult> {
  const response = await fetchWithTimeout(joinUrl(settings.apiUrl, "/images/generations"), settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(buildImagesGenerationBody(settings, prompt, params))
  });
  const json = await parseJson<ImagesApiResponse>(response);
  assertOk(response, json);
  return imagesResult(json, params.outputFormat);
}

async function editViaImagesApi(
  settings: Settings,
  prompt: string,
  params: Params,
  references: ReferenceImage[]
): Promise<ImageApiResult> {
  const form = new FormData();
  form.set("model", settings.modelId.trim() || "gpt-image-2");
  form.set("prompt", prompt);
  form.set("n", String(params.count));
  addImageOptions(form, params);
  for (const reference of references) {
    form.append("image", dataUrlToBlob(reference.dataUrl), reference.name || "reference.png");
  }
  const response = await fetchWithTimeout(joinUrl(settings.apiUrl, "/images/edits"), settings, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: form
  });
  const json = await parseJson<ImagesApiResponse>(response);
  assertOk(response, json);
  return imagesResult(json, params.outputFormat);
}

async function generateViaResponsesApi(
  settings: Settings,
  prompt: string,
  params: Params,
  references: ReferenceImage[]
): Promise<ImageApiResult> {
  const response = await fetchWithTimeout(joinUrl(settings.apiUrl, "/responses"), settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(buildResponsesBody(settings, prompt, params, references))
  });
  const json = await parseJson<ResponsesApiResponse>(response);
  assertOk(response, json);
  const calls = (json.output ?? []).filter((item) => item.type === "image_generation_call" && item.result);
  const images = calls.map((item) => asDataImage(String(item.result), params.outputFormat));
  if (!images.length) throw new Error("API 未返回图片数据");
  return {
    images,
    revisedPrompt: calls.find((item) => item.revised_prompt)?.revised_prompt
  };
}

function addImageOptions(target: Record<string, unknown> | FormData, params: Params): void {
  setValue(target, "size", params.size);
  setValue(target, "quality", params.quality);
  setValue(target, "output_format", params.outputFormat);
  if (params.outputFormat !== "png" && params.compression !== "") {
    setValue(target, "output_compression", params.compression);
  }
  if (params.moderation !== "auto") {
    setValue(target, "moderation", params.moderation);
  }
}

function setValue(target: Record<string, unknown> | FormData, key: string, value: string | number): void {
  if (target instanceof FormData) {
    target.set(key, String(value));
  } else {
    target[key] = value;
  }
}

function imagesResult(json: ImagesApiResponse, format: Params["outputFormat"]): ImageApiResult {
  const data = json.data ?? [];
  const images = data.flatMap((item) => {
    if (item.b64_json) return [asDataImage(item.b64_json, format)];
    if (item.url) return [item.url];
    return [];
  });
  if (!images.length) throw new Error("API 未返回图片数据");
  return {
    images,
    revisedPrompt: data.find((item) => item.revised_prompt)?.revised_prompt
  };
}

async function fetchWithTimeout(url: string, settings: Settings, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Math.max(1, settings.timeoutSeconds) * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`请求超时（${settings.timeoutSeconds} 秒）`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const contentType = response.headers.get("content-type") ?? "";
    if (/html/i.test(contentType) || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
      throw new Error("接口返回了网页 HTML，不是 JSON。请确认 API URL 使用 OpenAI 兼容地址，例如 https://alexai.work/v1");
    }
    throw new Error(text.slice(0, 300));
  }
}

function assertOk(response: Response, json: ImagesApiResponse | ResponsesApiResponse): void {
  if (response.ok && !json.error) return;
  const message = json.error?.message ?? `${response.status} ${response.statusText}`;
  throw new Error(message);
}

function asDataImage(base64: string, format: Params["outputFormat"]): string {
  return `data:${mimeType(format)};base64,${base64}`;
}

function mimeType(format: Params["outputFormat"]): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function joinUrl(base: string, path: string): string {
  return `${normalizeApiBaseUrl(base)}${path}`;
}

function responseModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed || trimmed.startsWith("gpt-image")) return "gpt-5.5";
  return trimmed;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("参考图格式无效");
  const mime = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const data = match[3] || "";
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}
