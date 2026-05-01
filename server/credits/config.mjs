export const creditPricingVersion = "2026-05-02-v1";

export const creditPackages = [
  { id: "trial", name: "试用包", credits: 100, bonus: 0, amountCny: 9.9, badge: "体验" },
  { id: "starter", name: "创作包", credits: 300, bonus: 30, amountCny: 29.9, badge: "常用" },
  { id: "studio", name: "工作室包", credits: 800, bonus: 120, amountCny: 79.9, badge: "推荐" },
  { id: "pro", name: "批量包", credits: 1800, bonus: 360, amountCny: 169, badge: "批量" }
];

export const creditPricing = {
  baseGenerate: 20,
  baseEdit: 30,
  highQualityExtra: 10,
  twoKExtra: 20,
  fourKExtra: 60,
  multiReferenceExtra: 10
};

export function publicCreditPackages() {
  return creditPackages.map((item) => ({
    id: item.id,
    name: item.name,
    credits: item.credits,
    bonus: item.bonus,
    amountCny: item.amountCny,
    badge: item.badge
  }));
}

export function findCreditPackage(packageId) {
  return creditPackages.find((item) => item.id === packageId) || null;
}

export function estimateCreditCost(params = {}, references = [], options = {}) {
  const normalizedParams = normalizeCostParams(params);
  const referenceCount = Array.isArray(references) ? references.filter(Boolean).length : 0;
  const successfulImageCount = Number.isFinite(Number(options.successfulImageCount))
    ? Math.max(0, Math.round(Number(options.successfulImageCount)))
    : normalizedParams.count;
  const baseCost = referenceCount > 0 ? creditPricing.baseEdit : creditPricing.baseGenerate;
  const qualityExtra = normalizedParams.quality === "high" ? creditPricing.highQualityExtra : 0;
  const sizeExtra = sizeExtraCost(normalizedParams.size);
  const referenceExtra = referenceCount >= 2 ? creditPricing.multiReferenceExtra : 0;
  const unitCost = baseCost + qualityExtra + sizeExtra + referenceExtra;
  return {
    version: creditPricingVersion,
    unitCost,
    estimatedCost: unitCost * normalizedParams.count,
    finalCost: unitCost * successfulImageCount,
    count: normalizedParams.count,
    successfulImageCount,
    referenceCount,
    breakdown: {
      baseCost,
      qualityExtra,
      sizeExtra,
      referenceExtra
    }
  };
}

function normalizeCostParams(params) {
  return {
    size: String(params?.size || "auto"),
    quality: String(params?.quality || "auto"),
    count: clampNumber(Number(params?.count) || 1, 1, 4)
  };
}

function sizeExtraCost(size) {
  const longest = longestSizeEdge(size);
  if (longest >= 3840) return creditPricing.fourKExtra;
  if (longest >= 2048) return creditPricing.twoKExtra;
  return 0;
}

function longestSizeEdge(size) {
  const match = String(size || "").match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return 0;
  return Math.max(Number(match[1]) || 0, Number(match[2]) || 0);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
