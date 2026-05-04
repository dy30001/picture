import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { compressTemplatePreviews } from "./compress-template-previews.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const publicDir = join(root, "public");
const templateJsonPath = join(publicDir, "sorry-templates.json");
const previewDir = join(publicDir, "template-previews");
const maxEdge = "960";

const previewSources = {
  "portrait-axis-female-3view-v01": "review/identity_lock/female_lifestyle_v02/female_lifestyle_face_lock_sheet_v02.jpg",
  "portrait-axis-male-3view-v01": "review/identity_lock/male_2001_2002_v01/male_2001_2002_face_lock_sheet_v01.jpg",
  "portrait-axis-child-10yo-3view-v01": "review/contact_sheets/identity_child10_20260502094035_review.jpg",
  "portrait-axis-senior-couple-3view-v01": "review/contact_sheets/identity_landmark_20260502111256_review.jpg",
  "portrait-axis-best-friends-3view-v01": "review/contact_sheets/identity_friends_20260502094035_review.jpg",
  "portrait-wedding-couture-cover-v01": "final_4k/07_new_york_v01/wedding_055_new_york_brooklyn_bridge_cover_35mm_v01_4k.png",
  "portrait-wedding-documentary-travel-v01": "final_4k/01_paris_v02/wedding_004_paris_paris_street_walk_35mm_v02_4k.png",
  "portrait-couple-anniversary-street-v01": "final_4k/identity_travel_20260502094035/identity_travel_04_travel_04_4k.png",
  "portrait-couple-travel-soft-v01": "final_4k/identity_travel_20260502094035/identity_travel_01_travel_01_4k.png",
  "portrait-best-friends-studio-v01": "final_4k/identity_friends_20260502094035/identity_friends_01_friends_01_4k.png",
  "portrait-best-friends-outdoor-v01": "final_4k/identity_friends_20260502094035/identity_friends_05_friends_05_4k.png",
  "portrait-child-10yo-birthday-v01": "final_4k/identity_child10_20260502094035/identity_child10_01_child10_01_4k.png",
  "portrait-child-10yo-campus-v01": "final_4k/identity_child10_20260502094035/identity_child10_02_child10_02_4k.png",
  "portrait-senior-golden-hour-v01": "final_4k/identity_landmark_20260502111256/identity_landmark_01_landmark_01_4k.png",
  "portrait-senior-golden-anniversary-v01": "final_4k/identity_landmark_20260502111256/identity_landmark_05_landmark_05_4k.png",
  "portrait-female-editorial-studio-v01": "review/identity_lock/female_lifestyle_v02/L04_life_no_glasses_front.jpg",
  "portrait-female-outdoor-film-v01": "review/identity_lock/female_lifestyle_v02/L03_life_no_glasses_soft.jpg"
};

await mkdir(previewDir, { recursive: true });
const payload = JSON.parse(await readFile(templateJsonPath, "utf8"));
const templates = Array.isArray(payload.templates) ? payload.templates : [];
let materialized = 0;

for (const [id, source] of Object.entries(previewSources)) {
  const sourcePath = join(root, source);
  if (!existsSync(sourcePath)) throw new Error(`Missing preview source for ${id}: ${source}`);
  const outputName = `${safePreviewId(id)}.jpg`;
  const outputPath = join(previewDir, outputName);
  const result = spawnSync("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", "high",
    "-Z", maxEdge,
    sourcePath,
    "--out", outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`sips failed for ${id}: ${result.stderr || result.stdout}`);
  }
  const template = templates.find((item) => String(item.id) === id);
  if (!template) throw new Error(`Template not found: ${id}`);
  template.imageUrl = `/template-previews/${outputName}`;
  template.previewSourceUrl = source;
  template.previewCachedAt = new Date().toISOString();
  materialized += 1;
}

await writeFile(templateJsonPath, `${JSON.stringify({ ...payload, templates }, null, 2)}\n`);
const compressionSummary = await compressTemplatePreviews({ publicDir });

const missingImageCount = templates.filter((item) => !String(item.imageUrl || "").trim()).length;
const externalImageCount = templates.filter((item) => /^https?:\/\//i.test(String(item.imageUrl || ""))).length;
console.log(JSON.stringify({
  materialized,
  missingImageCount,
  externalImageCount,
  compressed: compressionSummary.optimized,
  converted: compressionSummary.converted,
  savedMB: compressionSummary.savedMB
}, null, 2));

function safePreviewId(value) {
  return String(value || "template-preview")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "template-preview";
}
