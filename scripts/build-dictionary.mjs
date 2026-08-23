import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, strFromU8, strToU8, unzipSync } from "fflate";
import { SaxesParser } from "saxes";

const TABLE_NS = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const SHEET_NAMES = new Set(["詞目", "義項", "異用字"]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function attributeValue(node, namespace, localName) {
  return Object.values(node.attributes).find(
    (attribute) => attribute.uri === namespace && attribute.local === localName
  )?.value;
}

function parseSheets(xml) {
  const sheets = new Map([...SHEET_NAMES].map((name) => [name, []]));
  const parser = new SaxesParser({ xmlns: true });
  let sheetName;
  let headers;
  let row;
  let cell;
  let paragraph;

  parser.on("opentag", (node) => {
    if (node.uri === TABLE_NS && node.local === "table") {
      const name = attributeValue(node, TABLE_NS, "name");
      sheetName = SHEET_NAMES.has(name) ? name : undefined;
      headers = undefined;
      return;
    }
    if (!sheetName) return;

    if (node.uri === TABLE_NS && node.local === "table-row") {
      row = [];
      return;
    }
    if (node.uri === TABLE_NS && node.local === "table-cell") {
      cell = {
        paragraphs: [],
        repeat: Number(attributeValue(node, TABLE_NS, "number-columns-repeated") || 1),
        value: attributeValue(node, OFFICE_NS, "value") || ""
      };
      return;
    }
    if (cell && node.uri === TEXT_NS && node.local === "p") paragraph = "";
  });

  parser.on("text", (text) => {
    if (paragraph !== undefined) paragraph += text;
  });

  parser.on("closetag", (node) => {
    if (cell && node.uri === TEXT_NS && node.local === "p") {
      cell.paragraphs.push(paragraph);
      paragraph = undefined;
      return;
    }
    if (sheetName && node.uri === TABLE_NS && node.local === "table-cell") {
      const value = cell.paragraphs.length ? cell.paragraphs.join("\n") : cell.value;
      for (let index = 0; index < cell.repeat; index += 1) row.push(value);
      cell = undefined;
      return;
    }
    if (sheetName && node.uri === TABLE_NS && node.local === "table-row") {
      if (!headers) {
        headers = row;
      } else {
        sheets.get(sheetName).push(Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? ""])
        ));
      }
      row = undefined;
      return;
    }
    if (node.uri === TABLE_NS && node.local === "table") sheetName = undefined;
  });

  parser.write(xml).close();
  for (const [name, rows] of sheets) {
    if (!rows.length) throw new Error(`辞典缺少“${name}”工作表或该工作表没有数据`);
  }
  return sheets;
}

function requiredCell(row, sheetName, columnName) {
  if (!(columnName in row)) throw new Error(`“${sheetName}”工作表缺少“${columnName}”列`);
  return String(row[columnName]);
}

function buildDictionary(sheets) {
  const definitionsById = new Map();
  for (const definition of sheets.get("義項")) {
    const id = requiredCell(definition, "義項", "詞目id");
    const explanation = requiredCell(definition, "義項", "解說");
    if (!explanation) continue;
    const definitions = definitionsById.get(id) || [];
    definitions.push([requiredCell(definition, "義項", "詞性"), explanation]);
    definitionsById.set(id, definitions);
  }

  const entries = [];
  const entryById = new Map();
  const canonicalSurfaces = [];
  for (const term of sheets.get("詞目")) {
    const id = requiredCell(term, "詞目", "詞目id");
    const canonicalWord = requiredCell(term, "詞目", "漢字").replace(/【[^】]+】/g, "");
    if (!canonicalWord) continue;
    const entryIndex = entries.length;
    entries.push([
      canonicalWord,
      requiredCell(term, "詞目", "羅馬字"),
      definitionsById.get(id) || []
    ]);
    if (!entryById.has(id)) entryById.set(id, entryIndex);
    canonicalSurfaces.push([canonicalWord, entryIndex, 0]);
  }

  const variantSurfaces = [];
  for (const variant of sheets.get("異用字")) {
    const word = requiredCell(variant, "異用字", "異用字");
    if (!word) continue;
    const id = requiredCell(variant, "異用字", "詞目id");
    const entryIndex = entryById.get(id);
    if (entryIndex === undefined) throw new Error(`异用字“${word}”引用了不存在的詞目id：${id}`);
    variantSurfaces.push([word, entryIndex, 1]);
  }

  const trie = [[-1, 0, Object.create(null)]];
  for (const [word, entryIndex, isVariant] of [...canonicalSurfaces, ...variantSurfaces]) {
    let nodeIndex = 0;
    for (const character of word) {
      const children = trie[nodeIndex][2];
      if (children[character] === undefined) {
        children[character] = trie.length;
        trie.push([-1, 0, Object.create(null)]);
      }
      nodeIndex = children[character];
    }
    if (trie[nodeIndex][0] === -1) {
      trie[nodeIndex][0] = entryIndex;
      trie[nodeIndex][1] = isVariant;
    }
  }

  return { entries, trie };
}

const ods = new Uint8Array(await readFile(path.join(root, "data/kautian.ods")));
const archive = unzipSync(ods);
const sheets = parseSheets(strFromU8(archive["content.xml"]));
const dictionary = buildDictionary(sheets);
const output = gzipSync(strToU8(JSON.stringify(dictionary)), { level: 9, mtime: 0 });
await writeFile(path.join(root, "data/dictionary.json.gz"), output);
console.log(`dictionary built: ${dictionary.entries.length} entries, ${dictionary.trie.length} trie nodes, ${output.length} bytes`);
