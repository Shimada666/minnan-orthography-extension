import { createServer } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = await mkdtemp(path.join(tmpdir(), "minnan-store-preview-"));
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><title>闽南语小工具</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; padding: 72px 70px; background: #f4f1eb; color: #29221d; font: 24px/1.8 Georgia, "Songti SC", serif; }
      .eyebrow { color: #a93624; font: 700 14px/1.4 system-ui, sans-serif; letter-spacing: .18em; }
      h1 { margin: 10px 0 32px; font-size: 42px; line-height: 1.2; }
      .copy { width: 430px; }
      .sentence { display: inline; padding: 3px 5px; background: #fffaf0; border-bottom: 2px solid #dfcfb2; }
      .hint { margin-top: 32px; color: #796658; font: 16px/1.6 system-ui, sans-serif; }
    </style>
    <main><div class="eyebrow">MINNAN DICTIONARY</div><h1>读网页，也读懂闽南语</h1><div class="copy">
      <span id="sentence" class="sentence">講好的山盟海誓毋知擱賰偌濟</span>
      <p class="hint">选中文字，悬浮右上角的“閩南” Label，即时查看台罗、词性、释义和辞典正字。</p>
    </div></main>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});

try {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator("#minnan-word-helper").waitFor({ state: "attached" });
  await page.locator("#sentence").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.locator("[data-minnan-trigger]").hover();
  await page.getByRole("heading", { name: "毋知", exact: true }).waitFor();
  await mkdir(path.join(root, "store-assets"), { recursive: true });
  await page.screenshot({ path: path.join(root, "store-assets/screenshot-current-1280x800.png") });
} finally {
  await context.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(profile, { recursive: true, force: true });
}
