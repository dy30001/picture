import express from "express";
import { spawn } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const identityRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(identityRoot, "..");
const publicDir = join(identityRoot, "public");
const reviewDir = join(workspaceRoot, "review");
const generatedDir = join(workspaceRoot, "generated");
const referenceDir = join(workspaceRoot, "reference");
const final4kDir = join(workspaceRoot, "final_4k");
const chengpinDir = join(workspaceRoot, "成片");
const generationJobDir = join(generatedDir, "identity_accelerated", "_jobs");
const generationScript = join(workspaceRoot, "scripts", "newapi_generate_identity_scene_batch.py");

const generationJobs = new Map();
const sceneLabels = {
  wedding: "婚纱照",
  friendsWedding: "闺蜜婚纱",
  friends: "闺蜜照",
  travel: "旅游照",
  landmark: "地标打卡照",
  child10: "儿童10岁照"
};

const app = express();
app.use(express.json({ limit: "80mb" }));
app.use("/review", express.static(reviewDir));
app.use("/generated", express.static(generatedDir));
app.use("/reference", express.static(referenceDir));
app.use("/final_4k", express.static(final4kDir));
app.use("/chengpin", express.static(chengpinDir));
app.use(express.static(publicDir, { extensions: ["html"] }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "identity-workflow", time: new Date().toISOString() });
});

app.get("/api/workflow/status", async (_request, response) => {
  try {
    response.json({ ok: true, workflow: await workflowStatus() });
  } catch (error) {
    response.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/generation/jobs", (_request, response) => {
  response.json({ ok: true, jobs: Array.from(generationJobs.values()).map(serializeJob).reverse() });
});

app.get("/api/generation/jobs/:jobId", (request, response) => {
  const job = generationJobs.get(request.params.jobId);
  if (!job) {
    response.status(404).json({ ok: false, message: "generation job not found" });
    return;
  }
  response.json({ ok: true, job: serializeJob(job) });
});

app.post("/api/generation/accelerate", async (request, response) => {
  try {
    const scenes = normalizeGenerationScenes(request.body);
    const concurrency = normalizeConcurrency(request.body?.concurrency);
    const jobId = makeJobId();
    const referenceFiles = await saveReferenceFiles(jobId, scenes, request.body?.refs || {});
    const config = {
      jobId,
      scenes,
      concurrency,
      outfits: normalizeOutfits(request.body?.outfits || {}),
      referenceFiles
    };
    await mkdir(generationJobDir, { recursive: true });
    const configPath = join(generationJobDir, `${jobId}.json`);
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    const job = startGenerationJob({ jobId, scenes, concurrency, configPath });
    response.status(202).json({ ok: true, job: serializeJob(job) });
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) });
  }
});

app.use((_request, response) => {
  response.sendFile(join(publicDir, "index.html"));
});

const { host, port } = parseArgs(process.argv.slice(2));
app.listen(port, host, () => {
  process.stdout.write(`identity-workflow listening on http://${host}:${port}\n`);
});

async function workflowStatus() {
  const batches = [
    ...(await generatedIdentityBatches()),
    batchConfig("01_paris_v02", "Paris v02", "paris_batch_9_v02_4k_review.jpg", "build_report_paris_v02_identity_4k_v01.md", "重点复核 001 / 009 / 007"),
    batchConfig("02_santorini_v02", "Santorini v02", "santorini_batch_9_v02_4k_review.jpg", "build_report_santorini_v02_identity_4k_v01.md", "重点复核 010 / 015 / 018 / 016"),
    batchConfig("03_venice_v09_repair", "Venice v09", "venice_batch_9_v09_4k_repair_review.jpg", "build_report_venice_v09_4k_repair_v01.md", "已修复 v04 漂移问题"),
    batchConfig("04_kyoto_v01", "Kyoto v01", "kyoto_batch_9_v01_4k_review.jpg", "build_report_kyoto_full_batch_xhs_v01.md", "候选复核 036 / 034"),
    batchConfig("05_swiss_alps_v01", "Swiss Alps v01", "swiss_alps_batch_9_v01_4k_review.jpg", "build_report_swiss_alps_style_wardrobe_v01.md", "候选复核 037 / 042 / 045"),
    batchConfig("06_maldives_v01", "Maldives v01", "maldives_batch_9_v01_4k_review.jpg", "build_report_maldives_style_wardrobe_v01.md", "候选复核 046 / 051 / 054"),
    batchConfig("07_new_york_v01", "New York v01", "new_york_batch_9_v01_4k_review.jpg", "build_report_new_york_style_wardrobe_v01.md", "候选复核 060 / 063"),
    batchConfig("08_cappadocia_v01", "Cappadocia v01", "cappadocia_batch_9_v01_4k_review.jpg", "build_report_cappadocia_style_wardrobe_v01.md", "候选复核 064 / 069 / 072"),
    batchConfig("09_prague_v01", "Prague v01", "prague_batch_9_v01_4k_review.jpg", "build_report_prague_style_wardrobe_v01.md", "候选复核 078 / 081 / 080")
  ];
  const batchStatuses = await Promise.all(batches.map(readBatchStatus));
  const finalTotal = await countDeliveryPngs(final4kDir);
  const chengpinTotal = await countDeliveryPngs(chengpinDir);
  const baselineCompare = "/review/contact_sheets/newapi_face_lock_trial_v02_original_refs_compare.jpg";
  return {
    identityBaseline: {
      label: "人物已确认",
      status: "accepted",
      sourcePolicy: "以当前场景素材为准。",
      anchorPath: "generated/90_face_locked_samples/newapi_face_lock_trial_v02_original_refs.png",
      anchorUrl: "/generated/90_face_locked_samples/newapi_face_lock_trial_v02_original_refs.png",
      compareSheetUrl: baselineCompare,
      compareSheetExists: await pathExists(join(reviewDir, "contact_sheets", "newapi_face_lock_trial_v02_original_refs_compare.jpg")),
      turnaroundUrl: "/review/contact_sheets/current_identity_turnaround_female_v07_male_v02.jpg",
      turnaroundExists: await pathExists(join(reviewDir, "contact_sheets", "current_identity_turnaround_female_v07_male_v02.jpg"))
    },
    stages: [
      stage("originals", "场景素材", "ready", "已导入"),
      stage("face", "人物确认", "manual", "待确认"),
      stage("turnaround", "三视图", "ready", "待复核"),
      stage("identity", "交付复核", "accepted", "已确认"),
      stage("batch", "模板样片", "ready", `${batchStatuses.filter((batch) => batch.kind === "sceneTemplate").length} 组`),
      stage("delivery", "交付成片", finalTotal === chengpinTotal ? "synced" : "warning", `原图 ${finalTotal} / 成片 ${chengpinTotal}`)
    ],
    totals: {
      final4k: finalTotal,
      chengpin: chengpinTotal,
      synced: finalTotal === chengpinTotal
    },
    batches: batchStatuses,
    activeGeneration: latestGenerationJob(),
    nextActions: [
      "人物一致性复核",
      "身形比例复核",
      "场景一致性复核",
      "确认选片和交付数量"
    ]
  };
}

function batchConfig(folder, label, contactSheet, buildReport, risk, extra = {}) {
  return { folder, label, contactSheet, buildReport, risk, ...extra };
}

async function generatedIdentityBatches() {
  try {
    const entries = await readdir(final4kDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^identity_[^/]+/.test(entry.name))
      .sort((left, right) => right.name.localeCompare(left.name, "zh-Hans-CN", { numeric: true }))
      .map((entry) => {
        const match = /^identity_([^_]+)_(.+)$/.exec(entry.name);
        const sceneId = match?.[1] || "";
        const label = sceneLabels[sceneId] || "场景";
        return batchConfig(
          entry.name,
          `${label}加速`,
          `${entry.name}_review.jpg`,
          `build_report_${entry.name}.md`,
          "场景样片 9 张",
          { kind: "sceneTemplate", sceneId }
        );
      });
  } catch {
    return [];
  }
}

function stage(id, label, status, evidence) {
  return { id, label, status, evidence };
}

async function readBatchStatus(batch) {
  const finalFolder = join(final4kDir, batch.folder);
  const chengpinFolder = join(chengpinDir, batch.folder);
  const isSceneTemplate = batch.kind === "sceneTemplate";
  const finalCount = await countPngs(finalFolder);
  const chengpinCount = isSceneTemplate ? 0 : await countPngs(chengpinFolder);
  const finalImages = await listPngImages(finalFolder, `/final_4k/${encodeURIComponent(batch.folder)}`, "final_4k");
  const chengpinImages = isSceneTemplate ? [] : await listPngImages(chengpinFolder, `/chengpin/${encodeURIComponent(batch.folder)}`, "成片");
  const contactSheetPath = join(reviewDir, "contact_sheets", batch.contactSheet);
  const buildReportPath = join(workspaceRoot, "planning", batch.buildReport);
  return {
    ...batch,
    finalCount,
    chengpinCount,
    synced: isSceneTemplate ? finalCount > 0 : finalCount === chengpinCount && finalCount > 0,
    contactSheetExists: await pathExists(contactSheetPath),
    buildReportExists: await pathExists(buildReportPath),
    contactSheetUrl: `/review/contact_sheets/${encodeURIComponent(batch.contactSheet)}`,
    finalPath: `final_4k/${batch.folder}`,
    chengpinPath: isSceneTemplate ? "" : `成片/${batch.folder}`,
    images: isSceneTemplate ? finalImages : chengpinImages.length ? chengpinImages : finalImages,
    finalImages,
    chengpinImages
  };
}

async function listPngImages(folder, urlRoot, source) {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true }))
      .map((entry, index) => ({
        id: `${source}-${index + 1}`,
        name: entry.name,
        title: imageTitle(entry.name, index),
        source,
        url: `${urlRoot}/${encodeURIComponent(entry.name)}`
      }));
  } catch {
    return [];
  }
}

function imageTitle(name, index) {
  const match = /wedding_(\d+)/i.exec(name);
  return match ? `#${match[1]}` : `#${String(index + 1).padStart(2, "0")}`;
}

async function countPngs(folder) {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const fullPath = join(folder, entry.name);
      if (entry.isDirectory()) count += await countPngs(fullPath);
      if (entry.isFile() && /\.png$/i.test(entry.name)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

async function countDeliveryPngs(folder) {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.name.startsWith("identity_")) continue;
      const fullPath = join(folder, entry.name);
      if (entry.isDirectory()) count += await countPngs(fullPath);
      if (entry.isFile() && /\.png$/i.test(entry.name)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(args) {
  const next = { host: "127.0.0.1", port: 4184 };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--host" && args[index + 1]) next.host = args[index + 1];
    if (args[index] === "--port" && args[index + 1]) next.port = Number(args[index + 1]) || 4184;
  }
  return next;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function makeJobId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${stamp}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeGenerationScenes(body) {
  const allowed = Object.keys(sceneLabels);
  const rawScenes = body?.allScenes
    ? allowed
    : Array.isArray(body?.scenes)
      ? body.scenes
      : [body?.sceneId || "wedding"];
  const scenes = [...new Set(rawScenes)].filter((scene) => allowed.includes(scene));
  if (!scenes.length) throw new Error("没有可生成的场景");
  return scenes;
}

function normalizeConcurrency(value) {
  const concurrency = Number(value);
  if (!Number.isFinite(concurrency)) return 10;
  return Math.min(Math.max(Math.floor(concurrency), 1), 12);
}

function normalizeOutfits(raw) {
  const outfits = {};
  if (!raw || typeof raw !== "object") return outfits;
  for (const [sceneId, outfit] of Object.entries(raw)) {
    if (!sceneLabels[sceneId] || !outfit || typeof outfit !== "object") continue;
    outfits[sceneId] = {
      title: String(outfit.title || "").slice(0, 120),
      detail: String(outfit.detail || "").slice(0, 240),
      prompt: String(outfit.prompt || "").slice(0, 360)
    };
  }
  return outfits;
}

async function saveReferenceFiles(jobId, scenes, refs) {
  const saved = {};
  if (!refs || typeof refs !== "object") return saved;
  for (const sceneId of scenes) {
    const sceneRefs = refs[sceneId];
    if (!sceneRefs || typeof sceneRefs !== "object") continue;
    const paths = [];
    for (const [role, items] of Object.entries(sceneRefs)) {
      if (!Array.isArray(items)) continue;
      for (const [index, item] of items.slice(0, 8).entries()) {
        const dataUrl = typeof item?.dataUrl === "string" ? item.dataUrl : "";
        const decoded = decodeDataUrl(dataUrl);
        if (!decoded) continue;
        const folder = join(generationJobDir, jobId, "refs", sceneId);
        await mkdir(folder, { recursive: true });
        const filename = `${sanitizeName(role)}_${String(index + 1).padStart(2, "0")}.${decoded.extension}`;
        const targetPath = join(folder, filename);
        await writeFile(targetPath, decoded.buffer);
        paths.push(targetPath);
      }
    }
    if (paths.length) saved[sceneId] = paths;
  }
  return saved;
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 18 * 1024 * 1024) return null;
  return { buffer, extension: match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase() };
}

function sanitizeName(value) {
  return String(value || "ref").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 48) || "ref";
}

function startGenerationJob({ jobId, scenes, concurrency, configPath }) {
  const child = spawn("python3", [generationScript, "--config", configPath], {
    cwd: workspaceRoot,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const job = {
    id: jobId,
    status: "running",
    scenes,
    concurrency,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    endedAt: "",
    exitCode: null,
    signal: "",
    tail: []
  };
  generationJobs.set(jobId, job);
  const append = (chunk) => {
    const text = String(chunk || "").trim();
    if (!text) return;
    job.tail.push(...text.split(/\r?\n/).slice(-20));
    job.tail = job.tail.slice(-80);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", (error) => {
    job.status = "failed";
    job.endedAt = new Date().toISOString();
    append(errorMessage(error));
  });
  child.on("exit", (code, signal) => {
    job.status = code === 0 ? "completed" : "failed";
    job.exitCode = code;
    job.signal = signal || "";
    job.endedAt = new Date().toISOString();
  });
  return job;
}

function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    scenes: job.scenes,
    sceneLabels: job.scenes.map((sceneId) => sceneLabels[sceneId] || sceneId),
    concurrency: job.concurrency,
    pid: job.pid,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    signal: job.signal,
    tail: job.tail.slice(-30)
  };
}

function latestGenerationJob() {
  const jobs = Array.from(generationJobs.values());
  if (!jobs.length) return null;
  const running = jobs.findLast?.((job) => job.status === "running");
  return serializeJob(running || jobs[jobs.length - 1]);
}
