#!/usr/bin/env node
import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const onlyStudio = args.has("--studio-only");
const onlyAssets = args.has("--assets-only");

const sourceDir = resolve(process.env.STUDIO_PREVIEW_SOURCE_DIR || join(root, "final_4k"));
const thumbDir = resolve(process.env.STUDIO_PREVIEW_THUMB_DIR || join(root, "data", "studio-preview-thumbs"));
const studioImagePattern = /\.(?:png|jpe?g|webp)$/i;

const assetJobs = [
  ["public/assets/mojing-home-vision.png", "public/assets/mojing-home-vision.jpg", 1600, 78],
  ["public/assets/mojing-ink-hero.png", "public/assets/mojing-ink-hero.jpg", 1600, 78],
  ["public/assets/mojing-workbench-bg.png", "public/assets/mojing-workbench-bg.jpg", 1600, 78],
  ["public/assets/mojing-panel-wash.png", "public/assets/mojing-panel-wash.jpg", 1400, 78],
  ["public/assets/studio-showcase-sample.png", "public/assets/studio-showcase-sample.jpg", 1200, 78],
  ["public/assets/studio-showcase-3view.png", "public/assets/studio-showcase-3view.jpg", 1400, 80]
].map(([input, output, maxSide, quality]) => ({
  input: join(root, input),
  output: join(root, output),
  maxSide,
  quality
}));

async function main() {
  const results = [];
  if (!onlyAssets) results.push(await compressStudioPreviews());
  if (!onlyStudio) results.push(await compressAssetImages());
  const created = results.reduce((sum, item) => sum + item.created, 0);
  const skipped = results.reduce((sum, item) => sum + item.skipped, 0);
  const failed = results.flatMap((item) => item.failed);
  process.stdout.write(`frontend image compression: created ${created}, skipped ${skipped}, failed ${failed.length}\n`);
  if (failed.length) {
    for (const item of failed.slice(0, 10)) {
      process.stdout.write(`failed: ${relative(root, item.input)} -> ${item.message}\n`);
    }
    process.exitCode = 1;
  }
}

async function compressStudioPreviews() {
  const entries = await listFiles(sourceDir);
  const jobs = entries
    .filter((input) => studioImagePattern.test(input))
    .map((input) => {
      const inputRelativePath = relative(sourceDir, input);
      const outputRelativePath = inputRelativePath.replace(extname(inputRelativePath), ".jpg");
      return {
        input,
        output: join(thumbDir, outputRelativePath),
        maxSide: 1280,
        quality: 78
      };
    });
  return runJobs(jobs, 4);
}

async function compressAssetImages() {
  return runJobs(assetJobs, 2);
}

async function runJobs(jobs, concurrency) {
  let created = 0;
  let skipped = 0;
  const failed = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        if (!force && await isFresh(job.input, job.output)) {
          skipped += 1;
          continue;
        }
        await mkdir(dirname(job.output), { recursive: true });
        await sipsToJpeg(job);
        created += 1;
      } catch (error) {
        failed.push({ input: job.input, message: error?.message || String(error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { created, skipped, failed };
}

async function listFiles(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function isFresh(input, output) {
  try {
    const [inputStat, outputStat] = await Promise.all([stat(input), stat(output)]);
    return outputStat.size > 0 && outputStat.mtimeMs >= inputStat.mtimeMs;
  } catch {
    return false;
  }
}

async function sipsToJpeg({ input, output, maxSide, quality }) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", String(quality),
      "-Z", String(maxSide),
      input,
      "--out", output
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.trim() || `sips exited with ${code}`));
    });
  });
}

await main();
