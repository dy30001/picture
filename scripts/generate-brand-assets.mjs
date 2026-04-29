import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const assetDir = join(root, "public", "assets");
await mkdir(assetDir, { recursive: true });

const browser = await chromium.launch();

await renderAsset({
  file: "mojing-ink-hero.png",
  width: 2400,
  height: 900,
  body: heroArtwork()
});

await renderAsset({
  file: "mojing-panel-wash.png",
  width: 1600,
  height: 1000,
  body: panelArtwork()
});

await renderAsset({
  file: "mojing-icon-512.png",
  width: 512,
  height: 512,
  body: sealIcon(512)
});

await renderAsset({
  file: "mojing-icon-192.png",
  width: 192,
  height: 192,
  body: sealIcon(192)
});

await renderAsset({
  file: "mojing-share-card.png",
  width: 1200,
  height: 630,
  body: shareCard()
});

await browser.close();
console.log("brand assets generated");

async function renderAsset({ file, width, height, body }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  await page.setContent(baseHtml(width, height, body), { waitUntil: "load" });
  await page.screenshot({ path: join(assetDir, file), fullPage: false });
  await page.close();
}

function baseHtml(width, height, body) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        html, body {
          width: ${width}px;
          height: ${height}px;
          margin: 0;
          overflow: hidden;
          font-family: "Songti SC", "STSong", "PingFang SC", "Microsoft YaHei", serif;
          background: #f7efe0;
        }
        .stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

function paperTexture() {
  return `
    <defs>
      <filter id="paper">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="4" seed="29" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.92  0 0 0 0 0.79  0 0 0 .32 0" />
      </filter>
      <filter id="inkBlur"><feGaussianBlur stdDeviation="12" /></filter>
      <linearGradient id="paperGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fffaf0"/>
        <stop offset=".48" stop-color="#f8ecd5"/>
        <stop offset="1" stop-color="#eef4ed"/>
      </linearGradient>
      <radialGradient id="sun" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#c84537" stop-opacity=".84"/>
        <stop offset="1" stop-color="#a93127" stop-opacity=".34"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#paperGrad)"/>
    <rect width="100%" height="100%" filter="url(#paper)" opacity=".72"/>
  `;
}

function heroArtwork() {
  return `
    <div class="stage">
      <svg viewBox="0 0 2400 900" width="2400" height="900" aria-hidden="true">
        ${paperTexture()}
        <circle cx="1818" cy="182" r="78" fill="url(#sun)" opacity=".54"/>
        <path d="M0 646 C250 526 396 468 586 506 C760 540 844 408 1020 390 C1204 372 1302 510 1466 468 C1635 424 1736 286 1904 324 C2072 360 2230 506 2400 430 L2400 900 L0 900Z" fill="#172033" opacity=".14"/>
        <path d="M0 710 C250 610 420 606 622 642 C790 672 902 546 1076 562 C1242 574 1365 674 1520 650 C1720 618 1848 518 2018 552 C2180 584 2268 694 2400 660 L2400 900 L0 900Z" fill="#1f6f61" opacity=".11"/>
        <path d="M0 768 C380 706 600 730 856 748 C1044 760 1215 697 1446 730 C1696 766 1874 714 2084 740 C2220 756 2320 786 2400 806 L2400 900 L0 900Z" fill="#172033" opacity=".16"/>
        <g fill="none" stroke="#172033" stroke-linecap="round" opacity=".18">
          <path d="M108 450 C226 376 296 330 396 322" stroke-width="17"/>
          <path d="M126 512 C290 438 378 420 502 418" stroke-width="10"/>
          <path d="M404 306 C506 222 648 186 820 212" stroke-width="14"/>
          <path d="M1492 410 C1600 328 1724 276 1874 296" stroke-width="12"/>
        </g>
        <g stroke="#1f6f61" stroke-linecap="round" opacity=".22">
          <path d="M2104 190 C2074 352 2056 512 2048 730" stroke-width="10"/>
          <path d="M2148 230 C2110 410 2092 558 2078 764" stroke-width="8"/>
          <path d="M2032 286 C2104 328 2158 358 2206 420" stroke-width="6"/>
          <path d="M2012 398 C2094 434 2148 472 2198 532" stroke-width="6"/>
          <path d="M2018 520 C2080 546 2140 588 2184 652" stroke-width="6"/>
        </g>
        <g opacity=".2" fill="#a93127">
          <rect x="138" y="116" width="86" height="86" rx="12"/>
          <rect x="158" y="136" width="46" height="46" rx="7" fill="#fffaf0"/>
          <rect x="170" y="148" width="22" height="22" rx="4"/>
        </g>
        <path d="M0 820 C290 790 600 816 890 802 C1210 786 1530 832 1804 806 C2078 780 2240 814 2400 798" fill="none" stroke="#b88945" stroke-width="3" opacity=".34"/>
      </svg>
    </div>`;
}

function panelArtwork() {
  return `
    <div class="stage">
      <svg viewBox="0 0 1600 1000" width="1600" height="1000" aria-hidden="true">
        ${paperTexture()}
        <rect x="46" y="46" width="1508" height="908" rx="34" fill="#fffdf7" opacity=".44" stroke="#c9ad7a" stroke-width="2"/>
        <g fill="none" stroke="#172033" stroke-linecap="round" stroke-linejoin="round" opacity=".16">
          <path d="M120 744 C330 644 522 650 704 710 C880 768 1050 760 1226 694 C1370 640 1484 654 1544 696" stroke-width="22"/>
          <path d="M94 830 C360 772 554 834 794 812 C992 794 1174 752 1504 812" stroke-width="11"/>
        </g>
        <g transform="translate(1058 590)" opacity=".28">
          <path d="M0 130 C88 4 214 2 330 126 C210 116 118 116 0 130Z" fill="#1f6f61"/>
          <path d="M140 118 C164 32 232 0 306 28 C252 66 210 96 140 118Z" fill="#a93127" opacity=".42"/>
          <path d="M180 130 C220 56 290 58 350 94" fill="none" stroke="#172033" stroke-width="8" stroke-linecap="round"/>
        </g>
        <g opacity=".12" fill="#a93127">
          <circle cx="168" cy="164" r="70"/>
          <circle cx="1430" cy="164" r="44"/>
          <circle cx="228" cy="842" r="34"/>
        </g>
        <g stroke="#b88945" stroke-width="2" opacity=".24">
          <path d="M80 170 H540"/>
          <path d="M1020 876 H1510"/>
          <path d="M1312 106 C1438 146 1498 244 1500 378"/>
        </g>
      </svg>
    </div>`;
}

function sealIcon(size) {
  return `
    <div class="stage">
      <svg viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <filter id="texture">
            <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="4" seed="7"/>
            <feColorMatrix type="matrix" values="0 0 0 0 .66  0 0 0 0 .18  0 0 0 0 .14  0 0 0 .22 0"/>
          </filter>
          <linearGradient id="red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#c94d3c"/>
            <stop offset=".58" stop-color="#a93127"/>
            <stop offset="1" stop-color="#7f251f"/>
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill="#fffaf0"/>
        <rect x="56" y="56" width="400" height="400" rx="92" fill="url(#red)"/>
        <rect x="56" y="56" width="400" height="400" rx="92" filter="url(#texture)" opacity=".42"/>
        <rect x="104" y="104" width="304" height="304" rx="52" fill="none" stroke="#fffaf0" stroke-width="24"/>
        <path d="M168 178 C222 118 336 146 342 234 C348 322 260 370 194 326 C138 288 142 218 200 198 C244 184 286 214 284 254 C282 296 238 314 208 292" fill="none" stroke="#fffaf0" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M160 374 H352 M256 124 V160 M256 352 V388" stroke="#fffaf0" stroke-width="22" stroke-linecap="round"/>
      </svg>
    </div>`;
}

function shareCard() {
  return `
    <div class="stage">
      <svg viewBox="0 0 1200 630" width="1200" height="630" aria-hidden="true">
        ${paperTexture()}
        <circle cx="910" cy="142" r="62" fill="url(#sun)" opacity=".35"/>
        <path d="M0 470 C128 410 238 372 356 396 C480 420 526 326 642 316 C766 306 836 402 946 374 C1038 350 1100 284 1200 300 L1200 630 L0 630Z" fill="#172033" opacity=".09"/>
        <path d="M0 540 C190 500 330 518 498 530 C652 542 774 500 936 520 C1056 536 1138 562 1200 574 L1200 630 L0 630Z" fill="#1f6f61" opacity=".10"/>
        <rect x="62" y="62" width="1076" height="506" rx="26" fill="#fffdf7" opacity=".78" stroke="#c9ad7a" stroke-width="2"/>
        <g transform="translate(114 130)">
          <rect width="104" height="104" rx="24" fill="#a93127"/>
          <rect x="24" y="24" width="56" height="56" rx="10" fill="none" stroke="#fffaf0" stroke-width="10"/>
          <path d="M35 58 C52 28 87 46 78 74 C70 102 32 94 42 62" fill="none" stroke="#fffaf0" stroke-width="8" stroke-linecap="round"/>
        </g>
        <text x="246" y="172" fill="#1f6f61" font-size="26" font-weight="800">本地图像创作</text>
        <text x="246" y="240" fill="#172033" font-size="64" font-weight="900">墨境图像工作台</text>
        <text x="246" y="304" fill="#5f5a51" font-size="30">模板、参考图、生成历史和下载整理在一个紧凑界面里</text>
        <g transform="translate(246 372)" font-size="24" font-weight="800">
          <rect width="178" height="48" rx="12" fill="#a93127"/><text x="28" y="32" fill="#fffaf0">2300+ 模板</text>
          <rect x="196" width="166" height="48" rx="12" fill="#1f6f61"/><text x="224" y="32" fill="#fffaf0">本地运行</text>
          <rect x="382" width="192" height="48" rx="12" fill="#172033"/><text x="410" y="32" fill="#fffaf0">一键保存</text>
        </g>
        <path d="M66 532 C282 492 456 520 644 500 C832 480 972 512 1138 488" fill="none" stroke="#b88945" stroke-width="3" opacity=".46"/>
      </svg>
    </div>`;
}
