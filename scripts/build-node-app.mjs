import { access, chmod, copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(join(dist, "public"), { recursive: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "scripts"), { recursive: true });

for (const file of ["index.html", "app.js", "styles.css", "README_zh.md", "sorry-templates.json", "manifest.webmanifest"]) {
  await copyIfExists(join(root, "public", file), join(dist, "public", file));
}
await copyPublicTree(join(root, "public", "assets"), join(dist, "public", "assets"));
await copyPublicTree(join(root, "public", "template-previews"), join(dist, "public", "template-previews"), { optional: true });
await copyIfExists(join(root, "index.html"), join(dist, "index.html"));
await copyIfExists(join(root, "manifest.webmanifest"), join(dist, "manifest.webmanifest"));
for (const file of ["index.mjs", "template-store.mjs"]) {
  await copyIfExists(join(root, "server", file), join(dist, "server", file));
}
await copyServerCredits(join(root, "server", "credits"), join(dist, "server", "credits"));
await copyIfExists(join(root, "scripts", "open-workbench.mjs"), join(dist, "scripts", "open-workbench.mjs"));
await copyIfExists(join(root, "启动图片生成工作台.command"), join(dist, "启动图片生成工作台.command"));
await chmod(join(dist, "启动图片生成工作台.command"), 0o755);
await writeFile(join(dist, "package.json"), `${JSON.stringify({
  name: "mojing-image-workbench-dist",
  version: "0.1.0",
  private: true,
  description: "墨境图像工作台独立运行包",
  type: "module",
  scripts: { start: "node server/index.mjs --host 127.0.0.1 --port 9999", open: "node scripts/open-workbench.mjs" },
  dependencies: { express: "^5.2.1" }
}, null, 2)}\n`);

console.log("node app build passed");

async function copyIfExists(from, to) {
  try {
    await access(from);
    await copyFile(from, to);
  } catch {
    throw new Error(`missing required public asset: ${from}`);
  }
}

async function copyPublicTree(fromDir, toDir, { optional = false } = {}) {
  try {
    const entries = await readdir(fromDir, { withFileTypes: true });
    await mkdir(toDir, { recursive: true });
    for (const entry of entries) {
      const from = join(fromDir, entry.name);
      const to = join(toDir, entry.name);
      if (entry.isDirectory()) {
        await copyPublicTree(from, to, { optional: false });
        continue;
      }
      if (!entry.isFile()) continue;
      await copyIfExists(from, to);
    }
  } catch (error) {
    if (optional && error?.code === "ENOENT") return;
    throw error;
  }
}

async function copyServerCredits(fromDir, toDir) {
  await mkdir(toDir, { recursive: true });
  const entries = await readdir(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await copyIfExists(join(fromDir, entry.name), join(toDir, entry.name));
  }
}
