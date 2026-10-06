// รหัส.gs against a replica of the "2569+จอ" sheet: what the app reads, which cells a save touches,
// and that totals match the sheet's own "แผนทดแทนครุภัณฑ์" tab (values copied from the sheet, 6 ต.ค. 2569).
import test from "node:test";
import assert from "node:assert/strict";
import { createReplica, changedCells, SHEET_FORMULAS } from "./helpers/gas-replica.mjs";
import { summarize, replacementPlan, computerStatus } from "../web/domain.js";

const open = () => createReplica({ OPEN_ACCESS: "true" });
const assetBy = (ctx, code) => ctx.getInventory("open").assets.find((a) => a.computerCode === code);
const save = (ctx, a, changes) => ctx.saveAsset("open", { row: a.row, token: a.token, values: { ...a, ...changes } });

test("reads every row and matches the sheet's summary tab", () => {
  const { ctx } = open();
  const inv = ctx.getInventory(ctx.openSession().token);
  assert.equal(inv.assets.length, 57);
  assert.equal(inv.computerConditions[1], "ชำรุด"); // from the สถานะ pc/nb dropdown
  const s = summarize(inv.assets, 2569);
  assert.deepEqual([s.computers, s.pc, s.nb, s.monitors, s.oldComputers, s.oldMonitors], [57, 28, 29, 30, 8, 8]);
  const byDept = {
    ฝ่ายบริหารทั่วไป: [7, 4, 6, 3, 2],
    กลุ่มนโยบายและแผน: [7, 7, 9, 2, 1],
    กลุ่มวิชาการและวิเทศสัมพันธ์: [9, 11, 6, 2, 2],
    กลุ่มติดตามและประเมินผล: [5, 7, 9, 1, 3],
  };
  for (const [name, want] of Object.entries(byDept)) {
    const d = summarize(inv.assets.filter((a) => a.department === name), 2569);
    assert.deepEqual([d.pc, d.nb, d.monitors, d.oldComputers, d.oldMonitors], want, name);
  }
  assert.deepEqual(
    replacementPlan(inv.assets, 2570, 2575, 2569).map((r) => [r.pc, r.nb, r.monitors]),
    [[1, 0, 1], [6, 6, 6], [6, 14, 1], [1, 0, 4], [1, 0, 0], [7, 7, 10]],
  );
});

test("formulas the app writes are character-for-character the sheet's own", () => {
  const { ctx, main } = open();
  const { map } = ctx.schema_(main);
  for (const r of [2, 27, 58, 59]) {
    assert.equal(ctx.ageFormula_(r, map.computerYear, map.type), SHEET_FORMULAS[7].replaceAll("{r}", r));
    assert.equal(ctx.computerFormula_(r, map), SHEET_FORMULAS[8].replaceAll("{r}", r));
    assert.equal(ctx.ageFormula_(r, map.monitorYear, map.type), SHEET_FORMULAS[12].replaceAll("{r}", r));
  }
});

test("สถานะ pc/nb = ชำรุด touches only H, ผู้แก้ไข, เวลา; อัตโนมัติ restores the formula", () => {
  const { ctx, main, log } = open();
  let a = assetBy(ctx, "7440-001-03-24-0041 (ชำรุด)");
  assert.deepEqual(changedCells(main, () => save(ctx, a, { computerCondition: "ชำรุด" })), ["H27", "T27", "U27"]);
  assert.equal(main.values[26][7], "ชำรุด");
  const entry = log.values.at(-1);
  assert.deepEqual(entry.slice(1, 4), ["แก้ไขรายการ", "ผู้ใช้แอป (ไม่ใช้รหัส)", "7440-001-03-24-0041 (ชำรุด)"]);
  assert.deepEqual(JSON.parse(entry[4]).changes, { "สถานะ pc/nb": ["ปกติ", "ชำรุด"] });
  a = ctx.getInventory("open").assets.find((x) => x.row === 27);
  assert.equal(computerStatus(a, 2569), "ชำรุด");
  assert.equal(summarize(ctx.getInventory("open").assets, 2569).brokenComputers, 1);

  save(ctx, a, { computerCondition: "" });
  assert.equal(main.formulas.get("27,8"), SHEET_FORMULAS[8].replaceAll("{r}", 27));
  assert.equal(main.values[26][7], "ปกติ");
});

test("old + broken computer stays in the over-5-years count", () => {
  const { ctx } = open();
  save(ctx, assetBy(ctx, "7440-001-01-24-0089"), { computerCondition: "ชำรุด" });
  const s = summarize(ctx.getInventory("open").assets, 2569);
  assert.deepEqual([s.brokenComputers, s.pendingComputers], [1, 8]);
});

test("สถานะจอ = ชำรุด touches only M, ผู้แก้ไข, เวลา", () => {
  const { ctx, main } = open();
  const m = ctx.getInventory("open").assets.find((x) => x.monitorCode === "7440-006-02-24-0141");
  assert.deepEqual(changedCells(main, () => save(ctx, m, { monitorCondition: "ชำรุด" })), ["M3", "T3", "U3"]);
  assert.equal(summarize(ctx.getInventory("open").assets, 2569).brokenMonitors, 1);
});

test("saving without changes writes nothing; untouched cells keep their exact text", () => {
  const { ctx, main, log } = open();
  main.values[4][2] = "ชื่อมีเว้นวรรคท้าย ";
  const a = ctx.getInventory("open").assets.find((x) => x.row === 5);
  const logLen = log.values.length;
  assert.deepEqual(changedCells(main, () => assert.equal(save(ctx, a, {}).unchanged, true)), []);
  assert.equal(log.values.length, logLen);
  assert.deepEqual(changedCells(main, () => save(ctx, a, { notes: "x" })), ["O5", "T5", "U5"]);
  assert.equal(main.values[4][2], "ชื่อมีเว้นวรรคท้าย ");
});

test("a new record goes to the first prepared row with formulas intact", () => {
  const { ctx, main, log } = open();
  const res = ctx.saveAsset("open", {
    row: null,
    token: null,
    values: { type: "NB", owner: "ทดสอบ", department: "กลุ่มนโยบายและแผน", computerCode: "TEST-1", computerYear: 2569, computerCondition: "" },
  });
  assert.equal(res.row, 59);
  assert.deepEqual(main.values[58].slice(0, 8), [58, "NB", "ทดสอบ", "กลุ่มนโยบายและแผน", "TEST-1", 2569, 0, "ปกติ"]);
  assert.equal(main.formulas.get("59,8"), SHEET_FORMULAS[8].replaceAll("{r}", 59));
  assert.equal(log.values.at(-1)[1], "เพิ่มรายการ");
  assert.equal(ctx.getInventory("open").assets.length, 58);
});

test("rejected saves write nothing at all", () => {
  const { ctx, main, log } = open();
  const a = assetBy(ctx, "7440-001-01-24-0106");
  const cases = [
    [{ computerCondition: "พัง" }, /สถานะ pc\/nb ต้องเป็น/],
    [{ monitorCondition: "เสีย" }, /สถานะจอ ต้องเป็น/],
    [{ computerCode: "7440-001-01-24-0107" }, /ซ้ำ/],
    [{ computerYear: 2570 }, /ปี พ.ศ./],
    [{ department: "ฝ่ายอื่น" }, /กลุ่ม\/ฝ่าย/],
    [{ type: "โทรศัพท์" }, /ประเภทต้องเป็น/],
    [{ computerOutcome: "อื่นๆ" }, /ผลทดแทน/],
  ];
  for (const [changes, re] of cases)
    assert.deepEqual(changedCells(main, () => assert.throws(() => save(ctx, a, changes), re)), [], JSON.stringify(changes));
  assert.deepEqual(
    changedCells(main, () =>
      assert.throws(() => ctx.saveAsset("open", { row: a.row, token: "stale", values: a }), /ถูกแก้ไขแล้ว/),
    ),
    [],
  );
  assert.equal(log.values.length, 1);
});

test("rows typed directly in the sheet with a shared code can still be edited", () => {
  const { ctx, main } = open();
  main.values[3][4] = main.values[2][4]; // row 4 now repeats row 3's AMS
  const a = ctx.getInventory("open").assets.find((x) => x.row === 4);
  assert.deepEqual(changedCells(main, () => save(ctx, a, { notes: "ok" })), ["O4", "T4", "U4"]);
});

test("access codes still work when OPEN_ACCESS is off", () => {
  const { ctx } = createReplica({
    ACCESS_CODE_SETUP: JSON.stringify([{ code: "TEST-staff-code-0001", role: "staff", department: "ฝ่ายบริหารทั่วไป" }]),
  });
  ctx.configureAccess_();
  assert.equal(ctx.openSession(), null);
  assert.throws(() => ctx.getInventory("open"), /เข้าใช้งาน/);
  const staff = ctx.login("TEST-staff-code-0001");
  const assets = ctx.getInventory(staff.token).assets;
  assert.equal(assets.length, 11);
  assert.throws(
    () => ctx.saveAsset(staff.token, { row: assets[0].row, token: assets[0].token, values: { ...assets[0], department: "กลุ่มนโยบายและแผน" } }),
    /เฉพาะกลุ่ม/,
  );
});
