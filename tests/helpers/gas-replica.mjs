// A stand-in for Apps Script + the "2569+จอ" sheet, built from web/snapshot.js (no personal names).
// Formula text and dropdown lists are copied from the real sheet; the per-row formulas
// (อายุ PC/NB, สถานะ pc/nb, อายุจอ) are recalculated after every write like Google Sheets does.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import { makeSnapshotAssets } from "../../web/snapshot.js";

export const NOW_BE = 2569; // Utilities.formatDate below is fixed to 2026
export const HEADERS = [
  "ลำดับ", "ประเภท", "ผู้รับผิดชอบ", "กลุ่ม/ฝ่าย", "AMS", "ปีที่จัดซื้อ", "อายุ PC/NB", "สถานะ pc/nb",
  "ผลดำเนินการทดแทน", "จอ", "ปีที่จัดซื้อจอ", "อายุจอ", "สถานะจอ", "ผลดำเนินการทดแทนจอ", "หมายเหตุ",
  "ตรวจสอบข้อมูล", "ติดตั้ง Firewall", "คอมที่ให้ฝ่ายบริหารแล้ว", "อยู่ที่กลุ่มตัวเอง", "ผู้แก้ไข", "เวลา",
  "เหตุผลความจำเป็นในการขอซื้อ",
];
// Exact formula text of the real sheet, row 2 → {r}
export const SHEET_FORMULAS = {
  7: '=IFERROR(IF(OR(B{r}="",F{r}="",VALUE(F{r})<2400,VALUE(F{r})>YEAR(TODAY())+543,MOD(VALUE(F{r}),1)<>0),"",YEAR(TODAY())+543-VALUE(F{r})),"")',
  8: '=IF(B{r}="","",IF(OR(I{r}="ทดแทนแล้ว",I{r}="ไม่ทดแทน"),I{r},IF(G{r}="","ตรวจสอบข้อมูล",IF(G{r}<=5,"ปกติ","รอดำเนินการ"))))',
  12: '=IFERROR(IF(OR(B{r}="",K{r}="",VALUE(K{r})<2400,VALUE(K{r})>YEAR(TODAY())+543,MOD(VALUE(K{r}),1)<>0),"",YEAR(TODAY())+543-VALUE(K{r})),"")',
};
// Dropdowns (data validation lists) of the real sheet, by column number
export const SHEET_DROPDOWNS = {
  2: ["PC", "NB", "PC (ห้องสมุด)", "จอมอนิเตอร์", "เครื่องพิมพ์", "อื่น ๆ"],
  4: ["ฝ่ายบริหารทั่วไป", "กลุ่มนโยบายและแผน", "กลุ่มติดตามและประเมินผล", "กลุ่มวิชาการและวิเทศสัมพันธ์"],
  8: ["ปกติ", "ชำรุด", "อยู่ระหว่างซ่อม", "รอดำเนินการ", "ทดแทนแล้ว", "ไม่ทดแทน", "ตรวจสอบข้อมูล"],
  9: ["รอดำเนินการ", "ทดแทนแล้ว", "ไม่ทดแทน"],
  13: ["ปกติ", "ชำรุด", "อยู่ระหว่างซ่อม"],
  14: ["รอดำเนินการ", "ทดแทนแล้ว", "ไม่ทดแทน"],
};
const LOG_HEADERS = ["วันที่/เวลา", "การกระทำ", "ผู้แก้ไข", "AMS", "รายละเอียด"];
const MAX_ROWS = 120;

const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
export const colName = (n) => {
  let s = "";
  for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function replicaData() {
  const values = [HEADERS.slice()];
  for (const a of makeSnapshotAssets()) {
    const row = Array(HEADERS.length).fill("");
    Object.assign(row, {
      0: a.id, 1: a.type, 2: a.owner || "ผู้รับผิดชอบ " + a.id, 3: a.department, 4: a.computerCode,
      5: a.computerYear, 8: a.computerOutcome, 9: a.monitorCode, 10: a.monitorYear, 12: a.monitorCondition,
      13: a.monitorOutcome, 14: a.notes, 16: false, 21: a.reason,
    });
    values[a.row - 1] = row;
  }
  for (let r = 1; r < MAX_ROWS; r++) values[r] ||= Array(HEADERS.length).fill("");
  const formulas = new Map();
  for (let r = 2; r <= MAX_ROWS; r++)
    for (const [c, f] of Object.entries(SHEET_FORMULAS)) formulas.set(`${r},${c}`, f.replaceAll("{r}", r));
  return { values, formulas };
}

function makeSheet(name, values, formulas, book, sheetId) {
  const writes = [];
  const get = (r, c) => (values[r - 1] ? (values[r - 1][c - 1] ?? "") : "");
  const set = (r, c, v) => {
    while (values.length < r) values.push(Array(values[0].length).fill(""));
    values[r - 1][c - 1] = v;
  };
  function evalFormula(r, f) {
    const age = f.match(/^=IFERROR\(IF\(OR\(([A-Z]+)\d+="",([A-Z]+)\d+="",VALUE/);
    if (age) {
      const b = get(r, colIndex(age[1])), y = get(r, colIndex(age[2])), n = Number(y);
      return b === "" || y === "" || !Number.isFinite(n) || n < 2400 || n > NOW_BE || n % 1 ? "" : NOW_BE - n;
    }
    const st = f.match(/^=IF\(([A-Z]+)\d+="","",IF\(OR\(([A-Z]+)\d+="ทดแทนแล้ว".*IF\(([A-Z]+)\d+="","ตรวจสอบข้อมูล"/);
    if (st) {
      const b = get(r, colIndex(st[1])), o = get(r, colIndex(st[2])), a = get(r, colIndex(st[3]));
      if (b === "") return "";
      if (o === "ทดแทนแล้ว" || o === "ไม่ทดแทน") return o;
      return a === "" ? "ตรวจสอบข้อมูล" : a <= 5 ? "ปกติ" : "รอดำเนินการ";
    }
  }
  const recalc = () => {
    for (let pass = 0; pass < 2; pass++)
      for (const [k, f] of formulas) {
        const [r, c] = k.split(",").map(Number), v = evalFormula(r, f);
        if (v !== undefined) set(r, c, v);
      }
  };
  recalc();
  const lastRow = () => {
    let last = 0;
    values.forEach((row, i) => row.some((v) => v !== "") && (last = i + 1));
    for (const k of formulas.keys()) last = Math.max(last, Number(k.split(",")[0]));
    return last;
  };
  return {
    values, formulas, writes,
    getName: () => name,
    getParent: () => book,
    getSheetId: () => sheetId,
    getLastColumn: () => values[0].length,
    getLastRow: lastRow,
    getMaxRows: () => Math.max(MAX_ROWS, values.length),
    appendRow(row) {
      const r = lastRow() + 1;
      row.forEach((v, i) => set(r, i + 1, v));
    },
    getRange(r, c, n = 1, m = 1) {
      const grid = (fn) => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => fn(r + i, c + j)));
      return {
        getValues: () => grid(get),
        getDisplayValues: () => grid((y, x) => String(get(y, x))),
        getFormulas: () => grid((y, x) => formulas.get(`${y},${x}`) || ""),
        getDataValidation: () =>
          name === "2569+จอ" && SHEET_DROPDOWNS[c] && r >= 2
            ? { getCriteriaType: () => "VALUE_IN_LIST", getCriteriaValues: () => [SHEET_DROPDOWNS[c].slice(), true] }
            : null,
        setValue(v) {
          formulas.delete(`${r},${c}`);
          set(r, c, v);
          writes.push({ r, c, v });
          recalc();
        },
        setFormula(f) {
          formulas.set(`${r},${c}`, f);
          writes.push({ r, c, f });
          recalc();
        },
      };
    },
  };
}

export function createReplica(props = {}) {
  const { values, formulas } = replicaData();
  const book = { getUrl: () => "https://docs.google.com/spreadsheets/d/TEST", getSheetByName: (n) => sheets[n] || null };
  const sheets = {
    "2569+จอ": makeSheet("2569+จอ", values, formulas, book, 1417596017),
    Log: makeSheet("Log", [LOG_HEADERS.slice()], new Map(), book, 2),
  };
  const properties = new Map(Object.entries({ SPREADSHEET_ID: "TEST", ...props }));
  const cache = new Map();
  const ctx = vm.createContext({
    Date,
    JSON,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (properties.has(k) ? properties.get(k) : null),
        setProperty: (k, v) => properties.set(k, v),
        deleteProperty: (k) => properties.delete(k),
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_, s) => [...createHash("sha256").update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: randomUUID,
      formatDate: () => "2026",
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    Session: { getTemporaryActiveUserKey: () => "tmp", getActiveUser: () => ({ getEmail: () => "" }) },
    SpreadsheetApp: { openById: () => book, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  });
  vm.runInContext(readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8"), ctx);
  return { ctx, main: sheets["2569+จอ"], log: sheets.Log, properties };
}

/** Cells (A1 notation) whose value or formula differs between two points in time. */
export function changedCells(sheet, fn) {
  const before = sheet.values.map((r) => r.slice()), beforeF = new Map(sheet.formulas);
  fn();
  const out = new Set();
  sheet.values.forEach((row, r) =>
    row.forEach((v, c) => {
      const old = before[r]?.[c] ?? "";
      const a = old instanceof Date ? old.getTime() : old, b = v instanceof Date ? v.getTime() : v;
      if (a !== b) out.add(colName(c + 1) + (r + 1));
    }),
  );
  for (const k of new Set([...beforeF.keys(), ...sheet.formulas.keys()]))
    if (beforeF.get(k) !== sheet.formulas.get(k)) {
      const [r, c] = k.split(",").map(Number);
      out.add(colName(c) + r);
    }
  return [...out].sort();
}
