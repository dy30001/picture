import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const htmlPath = resolve(root, "docs/exports/墨境前端设计规范-v01.html");
const pdfPath = resolve(root, "docs/exports/墨境前端设计规范-v01.pdf");
const previewPath = resolve(root, "docs/exports/墨境前端设计规范-v01-cover.png");

await mkdir(dirname(pdfPath), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 2048 },
  deviceScaleFactor: 1.5
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.emulateMedia({ media: "print" });

await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: {
    top: "0",
    right: "0",
    bottom: "0",
    left: "0"
  }
});

await page.screenshot({
  path: previewPath,
  fullPage: false
});

await browser.close();

console.log(`pdf: ${pdfPath}`);
console.log(`preview: ${previewPath}`);
