import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDirs = ["server", "src", "public", "tests", "scripts", "identity-workflow"];
const lintableFile = /\.(?:js|mjs|ts|css|html)$/;
const failures = [];
const files = walk(sourceDirs.map((dir) => join(root, dir)));

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/\t/.test(text)) failures.push(`${relative(file)} contains tab indentation`);
  if (/[ \t]+$/m.test(text)) failures.push(`${relative(file)} contains trailing whitespace`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`lint:strict passed (${files.length} files)`);

function walk(paths) {
  const files = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) files.push(...walk([join(path, entry)]));
    } else if (lintableFile.test(path)) {
      files.push(path);
    }
  }
  return files;
}

function relative(file) {
  return file.slice(root.length + 1);
}
