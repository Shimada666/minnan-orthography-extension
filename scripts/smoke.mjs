import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = await mkdtemp(path.join(tmpdir(), "minnan-extension-"));
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<!doctype html><meta charset=utf-8><p>伊講：<span id=word>毋知</span>影，閣有<span id=remainder>賰</span>。</p><p><span id=sentence>講好的山盟海誓毋知擱賰偌濟</span></p>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});

try {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.locator("#minnan-word-helper").waitFor({ state: "attached" });
  await page.locator("#word").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  const trigger = page.locator("[data-minnan-trigger]");
  await trigger.hover();
  const card = page.locator("[data-minnan-card]");
  await card.getByRole("heading", { name: "毋知", exact: true }).waitFor();
  assert.equal(await card.locator(".reading").innerText(), "m̄ tsai");
  assert.match(await card.locator(".definitions li").first().innerText(), /不知、不知道/);

  await page.mouse.move(0, 0);
  await page.locator("#remainder").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await trigger.hover();
  await card.getByRole("heading", { name: "賰", exact: true }).waitFor();
  assert.equal(await card.locator(".reading").innerText(), "tshun");
  assert.match(await card.locator(".definitions li").first().innerText(), /剩餘/);

  await page.mouse.move(0, 0);
  await page.locator("#sentence").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await trigger.hover();
  for (const word of ["毋知", "擱", "賰", "偌濟"]) {
    await card.getByRole("heading", { name: word, exact: true }).waitFor();
  }
  assert.match(await card.innerText(), /擱[\s\S]*異用字，正字：閣/);
  console.log("smoke ok: 单词查询和整句候选词提取通过。");
} finally {
  await context.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(profile, { recursive: true, force: true });
}
