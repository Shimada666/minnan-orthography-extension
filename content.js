const TABLE_NS = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";

const host = document.createElement("div");
host.id = "minnan-word-helper";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <style>
    :host { all: initial; }
    button, article { box-sizing: border-box; }
    .trigger {
      position: fixed;
      z-index: 2147483647;
      width: 25px;
      height: 25px;
      border: 1px solid rgba(255, 255, 255, .9);
      border-radius: 50%;
      padding: 0;
      background: #c94b32;
      color: #fff9eb;
      box-shadow: 0 3px 12px rgba(53, 28, 18, .28);
      font: 700 13px/23px Georgia, "Noto Serif TC", serif;
      text-align: center;
      cursor: pointer;
    }
    .trigger:hover { background: #a93624; transform: translateY(-1px); }
    .card {
      position: fixed;
      z-index: 2147483647;
      width: min(480px, calc(100vw - 24px));
      max-height: min(520px, calc(100vh - 24px));
      overflow: auto;
      border: 1px solid #dfcfb2;
      border-radius: 12px;
      padding: 13px 15px;
      background:
        radial-gradient(circle at 90% 8%, rgba(201, 75, 50, .1), transparent 38%),
        #fffaf0;
      color: #30261f;
      box-shadow: 0 14px 38px rgba(53, 28, 18, .24);
      font: 14px/1.4 Georgia, "Noto Serif TC", serif;
    }
    .card[hidden], .trigger[hidden] { display: none; }
    .word { margin: 0; color: #211813; font-size: 21px; line-height: 1.2; }
    .reading { margin: 4px 0 9px; color: #a93624; font-size: 16px; font-weight: 700; }
    .definitions { margin: 0; padding: 0 0 0 22px; }
    .definitions li + li { margin-top: 4px; }
    .entry {
      display: grid;
      grid-template-columns: minmax(58px, auto) minmax(105px, 145px) 1fr;
      gap: 10px;
      align-items: start;
      padding: 9px 0;
    }
    .entry + .entry { border-top: 1px solid #e6d8bf; }
    .entry .reading { margin: 2px 0 0; font-size: 14px; }
    .entry .definitions { padding-left: 18px; }
    .variant-note { margin-top: 3px; color: #8f5d3c; font-size: 10px; line-height: 1.25; }
    .part-of-speech {
      display: inline-block;
      margin-right: 6px;
      border-radius: 999px;
      padding: 1px 7px;
      background: #eadbc0;
      color: #66513d;
      font-size: 12px;
    }
    .status { margin: 0; color: #725d4a; }
    .source { margin: 8px 0 0; color: #8a7562; font-size: 10px; }
    @media (max-width: 560px) {
      .entry { grid-template-columns: minmax(54px, auto) 1fr; }
      .entry .definitions { grid-column: 1 / -1; }
    }
  </style>
  <button class="trigger" data-minnan-trigger aria-label="查询选中的闽南语词语" hidden>台</button>
  <article class="card" data-minnan-card role="tooltip" hidden></article>
`;
document.documentElement.append(host);

const trigger = shadow.querySelector(".trigger");
const card = shadow.querySelector(".card");
let selectedText = "";
let dictionaryPromise;
let hideTimer;

function cellValue(cell) {
  const paragraphs = [...cell.getElementsByTagNameNS("*", "p")];
  if (paragraphs.length) return paragraphs.map((node) => node.textContent).join("\n");
  return cell.getAttributeNS(OFFICE_NS, "value") ?? "";
}

function parseSheet(documentNode, sheetName) {
  const table = [...documentNode.getElementsByTagNameNS(TABLE_NS, "table")]
    .find((node) => node.getAttributeNS(TABLE_NS, "name") === sheetName);
  if (!table) throw new Error(`辞典缺少“${sheetName}”工作表`);

  const matrix = [...table.getElementsByTagNameNS(TABLE_NS, "table-row")].map((row) => {
    const values = [];
    for (const cell of row.children) {
      if (cell.namespaceURI !== TABLE_NS || cell.localName !== "table-cell") continue;
      const repeat = Number(cell.getAttributeNS(TABLE_NS, "number-columns-repeated") || 1);
      for (let index = 0; index < repeat; index += 1) values.push(cellValue(cell));
    }
    return values;
  });

  const headers = matrix.shift();
  return matrix.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""])
  ));
}

function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch(chrome.runtime.getURL("data/kautian.ods"))
      .then((response) => {
        if (!response.ok) throw new Error("无法读取辞典文件");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const archive = fflate.unzipSync(new Uint8Array(buffer));
        const xml = new TextDecoder().decode(archive["content.xml"]);
        const documentNode = new DOMParser().parseFromString(xml, "application/xml");
        return {
          terms: parseSheet(documentNode, "詞目"),
          definitions: parseSheet(documentNode, "義項"),
          variants: parseSheet(documentNode, "異用字")
        };
      });
  }
  return dictionaryPromise;
}

function lookup(dictionary, word) {
  const variant = dictionary.variants.find((row) => row["異用字"] === word);
  const term = dictionary.terms.find((row) =>
    String(row["漢字"]).replace(/【[^】]+】/g, "") === word
      || variant && String(row["詞目id"]) === String(variant["詞目id"])
  );
  if (!term) throw new Error(`辞典没有收录“${word}”`);

  const id = String(term["詞目id"]);
  return {
    word,
    canonicalWord: String(term["漢字"]).replace(/【[^】]+】/g, ""),
    isVariant: Boolean(variant) && String(term["漢字"]).replace(/【[^】]+】/g, "") !== word,
    romanization: term["羅馬字"],
    definitions: dictionary.definitions
      .filter((row) => String(row["詞目id"]) === id && row["解說"])
      .map((row) => ({ type: String(row["詞性"]), text: String(row["解說"]) }))
  };
}

function lookupSelection(dictionary, text) {
  const ignoredSingleCharacters = new Set("的了是在有和就也都而及與著過個這那我你他她它們");
  const headwords = dictionary.terms.map((term) => String(term["漢字"]).replace(/【[^】]+】/g, ""));
  const variantWords = dictionary.variants.map((variant) => String(variant["異用字"]));
  const candidates = [...new Set([...headwords, ...variantWords])]
    .map((word) => ({ word }))
    .filter(({ word }) => word && text.includes(word))
    .filter(({ word }) => word.length > 1 || !ignoredSingleCharacters.has(word))
    .map(({ word }) => ({ word, index: text.indexOf(word) }))
    .sort((left, right) => right.word.length - left.word.length || left.index - right.index);

  const occupied = new Set();
  const entries = [];
  for (const candidate of candidates) {
    const positions = Array.from(
      { length: candidate.word.length },
      (_, offset) => candidate.index + offset
    );
    if (positions.some((position) => occupied.has(position))) continue;

    const entry = lookup(dictionary, candidate.word);
    if (!entry.definitions.length) continue;
    positions.forEach((position) => occupied.add(position));
    entries.push({ ...entry, index: candidate.index });
  }

  return entries.sort((left, right) => left.index - right.index).slice(0, 12);
}

function addTextElement(parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderEntry(entry) {
  card.replaceChildren();
  addTextElement(card, "h2", "word", entry.word);
  if (entry.isVariant) {
    addTextElement(card, "div", "variant-note", `異用字，辭典正字：${entry.canonicalWord}`);
  }
  addTextElement(card, "div", "reading", entry.romanization || "未标注读音");
  const list = document.createElement("ol");
  list.className = "definitions";
  if (entry.definitions.length) {
    for (const definition of entry.definitions) {
      const item = document.createElement("li");
      if (definition.type) addTextElement(item, "span", "part-of-speech", definition.type);
      item.append(document.createTextNode(definition.text));
      list.append(item);
    }
  } else {
    addTextElement(list, "li", "", "此词目没有可显示的释义。");
  }
  card.append(list);
  addTextElement(card, "p", "source", "资料来源：教育部《臺灣台語常用詞辭典》");
}

function renderSelection(entries, text) {
  if (!entries.length) throw new Error(`辞典没有找到“${text}”中的词目`);
  if (entries.length === 1 && entries[0].word === text) {
    renderEntry(entries[0]);
    return;
  }

  card.replaceChildren();
  addTextElement(card, "p", "status", `找到 ${entries.length} 个可能需要解释的词`);
  for (const entry of entries) {
    const section = document.createElement("section");
    section.className = "entry";
    const headword = document.createElement("div");
    addTextElement(headword, "h2", "word", entry.word);
    if (entry.isVariant) {
      addTextElement(headword, "div", "variant-note", `異用字，正字：${entry.canonicalWord}`);
    }
    section.append(headword);
    addTextElement(section, "div", "reading", entry.romanization || "未标注读音");
    const list = document.createElement("ol");
    list.className = "definitions";
    for (const definition of entry.definitions) {
      const item = document.createElement("li");
      if (definition.type) addTextElement(item, "span", "part-of-speech", definition.type);
      item.append(document.createTextNode(definition.text));
      list.append(item);
    }
    section.append(list);
    card.append(section);
  }
  addTextElement(card, "p", "source", "资料来源：教育部《臺灣台語常用詞辭典》");
}

function renderError(error) {
  card.replaceChildren();
  addTextElement(card, "p", "status", error.message);
}

function positionCard() {
  const triggerRect = trigger.getBoundingClientRect();
  const left = Math.max(12, Math.min(triggerRect.left, window.innerWidth - card.offsetWidth - 12));
  const top = Math.min(triggerRect.bottom + 7, window.innerHeight - Math.min(520, card.scrollHeight || 180) - 12);
  card.style.left = `${left}px`;
  card.style.top = `${Math.max(12, top)}px`;
}

function showCard() {
  clearTimeout(hideTimer);
  card.hidden = false;
  card.replaceChildren();
  addTextElement(card, "p", "status", `正在查询“${selectedText}”…`);
  positionCard();
  loadDictionary()
    .then((dictionary) => renderSelection(lookupSelection(dictionary, selectedText), selectedText))
    .then(positionCard)
    .catch((error) => {
      renderError(error);
      positionCard();
      throw error;
    });
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { card.hidden = true; }, 160);
}

trigger.addEventListener("mouseenter", showCard);
trigger.addEventListener("mouseleave", scheduleHide);
card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
card.addEventListener("mouseleave", scheduleHide);

document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const word = selection?.toString().trim();
  if (!word || selection.rangeCount === 0) {
    trigger.hidden = true;
    card.hidden = true;
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  selectedText = word;
  trigger.style.left = `${Math.min(window.innerWidth - 33, rect.right + 7)}px`;
  trigger.style.top = `${Math.max(8, rect.top - 27)}px`;
  trigger.hidden = false;
  card.hidden = true;
});
