import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const DICTIONARY_URL = "https://sutian.moe.edu.tw/media/senn/ods/kautian.ods";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const odsPath = path.join(root, "data/kautian.ods");

const response = await fetch(DICTIONARY_URL);
if (!response.ok) throw new Error(`下载辞典失败：HTTP ${response.status}`);

const currentOds = new Uint8Array(await readFile(odsPath));
const downloadedOds = new Uint8Array(await response.arrayBuffer());
const currentContent = unzipSync(currentOds)["content.xml"];
const downloadedContent = unzipSync(downloadedOds)["content.xml"];
if (!Buffer.from(currentContent).equals(Buffer.from(downloadedContent))) {
  await writeFile(odsPath, downloadedOds);
  await import("./build-dictionary.mjs");
  console.log("dictionary updated from the latest ODS content");
} else {
  console.log("dictionary content is already current");
}
