export type SizeMode = "auto" | "ratio" | "custom";

export type SizeDraft = {
  mode: SizeMode;
  base: number;
  ratio: string;
  customWidth: string;
  customHeight: string;
};

export const sizeBases = [
  { label: "1K", value: 1024 },
  { label: "2K", value: 2048 },
  { label: "4K", value: 3840 }
];

export const sizeRatios = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9"];

export function createSizeDraft(size: string): SizeDraft {
  const match = size.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return { mode: "auto", base: 1024, ratio: "1:1", customWidth: "1024", customHeight: "1024" };
  }
  const width = Number(match[1]) || 1024;
  const height = Number(match[2]) || 1024;
  return {
    mode: "custom",
    base: nearestSizeBase(Math.max(width, height)),
    ratio: closestKnownRatio(width, height),
    customWidth: String(width),
    customHeight: String(height)
  };
}

export function sizeDraftDefaultsForMode(mode: SizeMode, current: SizeDraft): Partial<SizeDraft> {
  if (mode === "custom") {
    const resolved = current.mode === "custom" ? resolveSizeDraft(current) : ratioSize(current.base, current.ratio);
    const [width, height] = resolved.split("x");
    return { customWidth: width || "1024", customHeight: height || "1024" };
  }
  if (mode === "ratio") return { ratio: current.ratio || "1:1", base: current.base || 1024 };
  return {};
}

export function resolveSizeDraft(draft: SizeDraft): string {
  if (draft.mode === "auto") return "auto";
  if (draft.mode === "ratio") return ratioSize(draft.base, draft.ratio);
  return normalizeDimensions(Number(draft.customWidth) || 1024, Number(draft.customHeight) || 1024);
}

function ratioSize(base: number, ratio: string): string {
  const [wide = 1, tall = 1] = ratio.split(":").map((value) => Number(value) || 1);
  if (wide >= tall) return normalizeDimensions(base, base * tall / wide);
  return normalizeDimensions(base * wide / tall, base);
}

function normalizeDimensions(rawWidth: number, rawHeight: number): string {
  const minPixels = 655_360;
  const maxPixels = 8_294_400;
  let width = Math.max(16, rawWidth);
  let height = Math.max(16, rawHeight);
  const longest = Math.max(width, height);
  if (longest > 3840) {
    const scale = 3840 / longest;
    width *= scale;
    height *= scale;
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 3) {
    if (width > height) height = width / 3;
    else width = height / 3;
  }
  let pixels = width * height;
  if (pixels < minPixels) {
    const scale = Math.sqrt(minPixels / pixels);
    width *= scale;
    height *= scale;
  }
  pixels = width * height;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    width *= scale;
    height *= scale;
  }
  return `${roundToMultiple(width, 16)}x${roundToMultiple(height, 16)}`;
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.min(3840, Math.max(16, Math.round(value / multiple) * multiple));
}

function nearestSizeBase(value: number): number {
  return sizeBases.reduce((best, base) => Math.abs(base.value - value) < Math.abs(best - value) ? base.value : best, 1024);
}

function closestKnownRatio(width: number, height: number): string {
  const actual = width / height;
  return sizeRatios.reduce((best, ratio) => {
    const [wide = 1, tall = 1] = ratio.split(":").map((value) => Number(value) || 1);
    const score = Math.abs(wide / tall - actual);
    const bestParts = best.split(":").map((value) => Number(value) || 1);
    return score < Math.abs(bestParts[0] / bestParts[1] - actual) ? ratio : best;
  }, "1:1");
}
