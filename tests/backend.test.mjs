import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
const source = readFileSync(
  new URL("../apps-script/Code.gs", import.meta.url),
  "utf8",
);
function setup() {
  const headers = [
    "ลำดับ",
    "ประเภท",
    "ผู้รับผิดชอบ",
    "กลุ่ม/ฝ่าย",
    "AMS",
    "ปีที่จัดซื้อ (PC/NB)",
    "อายุ PC/NB",
    "สถานะ pc/nb",
    "ผลดำเนินการทดแทน",
    "จอ",
    "ปีที่จัดซื้อจอ (ถ้ามี)",
    "อายุจอ",
    "สถานะจอ",
    "ผลดำเนินการทดแทนจอ",
    "หมายเหตุ",
    "ตรวจสอบข้อมูล",
    "ติดตั้ง Firewall",
    "คอมที่ให้ฝ่ายบริหารแล้ว",
    "อยู่ที่กลุ่มตัวเอง",
    "ผู้แก้ไข",
    "เวลา",
    "เหตุผลความจำเป็นในการขอซื้อ",
  ];
  const make = (id, dept) => [
    id,
    "NB",
    "ผู้ทดสอบ " + id,
    dept,
    "TEST-" + id,
    2563,
    6,
    "รอดำเนินการ",
    "",
    "7440-006-99-99-000" + id,
    2562,
    7,
    "ปกติ",
    "",
    "หมายเหตุเดิม",
    "สูตรตรวจเดิม",
    true,
    "ส่งแล้ว",
    "ที่เดิม",
    "",
    "",
    "เหตุผลเดิม",
  ];
  const rows = [
    headers,
    make(1, "ฝ่ายบริหารทั่วไป"),
    make(2, "กลุ่มนโยบายและแผน"),
    Array(headers.length).fill(""),
  ];
  const formulas = new Map([["2,16", "=ARRAYFORMULA(...)"]]);
  const log = [];
  const logHeaders = ["วันที่/เวลา", "การกระทำ", "ผู้แก้ไข", "AMS", "รายละเอียด"];
  const book = {
    getUrl: () => "https://docs.google.com/spreadsheets/d/test",
    getSheetByName: (n) =>
      n === "Log"
        ? {
            appendRow: (v) => log.push(v),
            getLastColumn: () => logHeaders.length,
            getRange: () => ({ getDisplayValues: () => [logHeaders] }),
          }
        : sheet,
  };
  const sheet = {
    getName: () => "2569+จอ",
    getParent: () => book,
    getSheetId: () => 123,
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getRange: (r, c, n = 1, m = 1) => ({
      getValues: () =>
        Array.from({ length: n }, (_, i) =>
          rows[r - 1 + i].slice(c - 1, c - 1 + m),
        ),
      getDisplayValues: () =>
        Array.from({ length: n }, (_, i) =>
          rows[r - 1 + i].slice(c - 1, c - 1 + m).map(String),
        ),
      getFormulas: () => [
        Array.from(
          { length: m },
          (_, j) => formulas.get(`${r},${c + j}`) || "",
        ),
      ],
      setValue: (v) => {
        rows[r - 1][c - 1] = v;
      },
      setFormula: (v) => {
        formulas.set(`${r},${c}`, v);
      },
    }),
  };
  const properties = new Map([["SPREADSHEET_ID", "test"]]),
    cache = new Map();
  const ctx = vm.createContext({
    Date,
    JSON,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => properties.get(k),
        setProperty: (k, v) => properties.set(k, v),
        deleteProperty: (k) => properties.delete(k),
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_, s) => [...createHash("sha256").update(s).digest()],
      getUuid: randomUUID,
      formatDate: () => "2026",
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    Session: { getTemporaryActiveUserKey: () => "test-session" },
    SpreadsheetApp: { openById: () => book, flush: () => {} },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
  });
  vm.runInContext(source, ctx);
  properties.set(
    "ACCESS_CODE_SETUP",
    JSON.stringify([
      { code: "random-admin-test-code", role: "admin", department: "*" },
      {
        code: "random-staff-test-code",
        role: "staff",
        department: "ฝ่ายบริหารทั่วไป",
      },
      { code: "random-viewer-test-code", role: "viewer", department: "*" },
    ]),
  );
  ctx.configureAccess_();
  const admin = ctx.login("random-admin-test-code").token,
    staff = ctx.login("random-staff-test-code").token,
    viewer = ctx.login("random-viewer-test-code").token;
  return { ctx, rows, formulas, properties, admin, staff, viewer, log };
}
test("setup hashes credentials; read scope and write permissions are enforced", () => {
  const { ctx, properties, admin, staff, viewer } = setup();
  assert.equal(properties.has("ACCESS_CODE_SETUP"), false);
  assert.ok(!properties.get("ACCESS_RULES").includes("random-admin-test-code"));
  assert.equal(ctx.getInventory(admin).assets.length, 2);
  assert.equal(ctx.getInventory(staff).assets.length, 1);
  assert.throws(() => ctx.getInventory("invalid"), /เข้าใช้งาน/);
  assert.throws(() => ctx.saveAsset(viewer, {}), /อย่างเดียว/);
  const other = ctx.getInventory(admin).assets[1];
  assert.throws(
    () =>
      ctx.saveAsset(staff, {
        row: other.row,
        token: other.token,
        values: other,
      }),
    /เฉพาะกลุ่ม/,
  );
  assert.throws(
    () =>
      ctx.saveAsset(staff, {
        row: other.row,
        token: other.token,
        values: { ...other, department: "ฝ่ายบริหารทั่วไป" },
      }),
    /ฝ่ายอื่น/,
  );
});
test("saving monitor condition keeps computer outcome, notes, audit, and checkbox intact", () => {
  const { ctx, rows, admin, formulas, log } = setup();
  const a = ctx.getInventory(admin).assets[0];
  const result = ctx.saveAsset(admin, {
    row: a.row,
    token: a.token,
    values: { ...a, monitorCondition: "ชำรุด", monitorOutcome: "รอดำเนินการ" },
  });
  assert.equal(result.ok, true);
  assert.equal(rows[1][12], "ชำรุด");
  assert.equal(rows[1][13], "รอดำเนินการ");
  assert.equal(rows[1][8], "");
  assert.equal(rows[1][14], "หมายเหตุเดิม");
  assert.equal(rows[1][16], true);
  assert.equal(rows[1][17], "ส่งแล้ว");
  assert.equal(formulas.get("2,16"), "=ARRAYFORMULA(...)");
  assert.equal(log.length, 1);
  assert.equal(log[0].length, 5);
  assert.equal(log[0][1], "แก้ไขรายการ");
  assert.equal(log[0][3], "TEST-1");
  assert.match(log[0][4], /"sheet":"2569\+จอ"/);
  assert.ok(formulas.get("2,12").includes("VALUE(K2)"));
  assert.ok(formulas.get("2,7").includes("VALUE(F2)"));
  assert.ok(formulas.get("2,8").includes('I2="ทดแทนแล้ว"'));
  assert.throws(
    () => ctx.saveAsset(admin, { row: a.row, token: a.token, values: a }),
    /ถูกแก้ไขแล้ว/,
  );
});
test("duplicates, invalid years, stale rows and formula edits are rejected before writes", () => {
  const { ctx, rows, admin, formulas } = setup();
  const a = ctx.getInventory(admin).assets[0],
    before = JSON.stringify(rows);
  for (const values of [
    { ...a, monitorCode: "7440-006-99-99-0002" },
    { ...a, computerYear: 2570 },
    { ...a, monitorYear: 2563.5 },
  ])
    assert.throws(() =>
      ctx.saveAsset(admin, { row: a.row, token: a.token, values }),
    );
  assert.throws(
    () => ctx.saveAsset(admin, { row: a.row, token: "stale", values: a }),
    /ถูกแก้ไขแล้ว/,
  );
  formulas.set("2,13", "=L2>5");
  assert.throws(
    () => ctx.saveAsset(admin, { row: a.row, token: a.token, values: a }),
    /ยังเป็นสูตร/,
  );
  assert.equal(JSON.stringify(rows), before);
});
test("new records reuse prepared empty rows and protect formula-like input", () => {
  const { ctx, rows, admin } = setup();
  const a = ctx.getInventory(admin).assets[0];
  const result = ctx.saveAsset(admin, {
    values: {
      ...a,
      owner: "=1+1",
      computerCode: "NEW-1",
      monitorCode: "",
      monitorYear: "",
      monitorCondition: "",
      notes: "@formula",
      reason: "ขอเพิ่มเครื่อง",
    },
  });
  assert.equal(result.row, 4);
  assert.equal(rows[3][0], 3);
  assert.equal(rows[3][2], "'=1+1");
  assert.equal(rows[3][14], "'@formula");
  assert.equal(rows[3][21], "ขอเพิ่มเครื่อง");
});
