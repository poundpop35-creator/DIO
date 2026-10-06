import test from "node:test";
import assert from "node:assert/strict";
import {
  DEPARTMENTS,
  age,
  summarize,
  replacementPlan,
  computerStatus,
  monitorNeedsAction,
  validMonitor,
  issues,
  csvCell,
  escapeHtml,
} from "../web/domain.js";
import { makeDemoAssets } from "../web/demo.js";
const assets = makeDemoAssets();
test("fixture reconciliation: PC includes library; NB external monitors count independently", () => {
  const s = summarize(assets, 2569);
  assert.deepEqual(
    [
      s.computers,
      s.pc,
      s.nb,
      s.monitors,
      s.oldComputers,
      s.oldMonitors,
      s.brokenMonitors,
      s.missingMonitor,
      s.invalidMonitor,
    ],
    [57, 28, 29, 30, 8, 8, 0, 24, 3],
  );
  assert.equal(
    assets.filter((a) => a.type === "NB" && validMonitor(a)).length,
    10,
  );
  assert.equal(
    assets.filter((a) => age(a.monitorYear, 2569) !== null).length,
    41,
  );
  assert.deepEqual(
    DEPARTMENTS.map((d) => {
      const x = summarize(
        assets.filter((a) => a.department === d),
        2569,
      );
      return [x.pc, x.nb, x.monitors];
    }),
    [
      [7, 4, 6],
      [7, 7, 9],
      [5, 7, 9],
      [9, 11, 6],
    ],
  );
});
test("six-year plan counts once in purchase year + 6, with one total", () => {
  const rows = replacementPlan(assets, 2570, 2575, 2569);
  assert.deepEqual(
    rows.map((r) => [r.year, r.pc, r.nb, r.total, r.monitors]),
    [
      [2570, 1, 0, 1, 1],
      [2571, 6, 6, 12, 6],
      [2572, 6, 14, 20, 1],
      [2573, 1, 0, 1, 4],
      [2574, 1, 0, 1, 0],
      [2575, 7, 7, 14, 10],
    ],
  );
  assert.equal(
    rows.reduce((sum, r) => sum + r.total, 0) +
      summarize(assets, 2569).oldComputers,
    57,
  );
  assert.equal(
    rows.reduce((sum, r) => sum + r.monitors, 0) +
      summarize(assets, 2569).oldMonitors,
    30,
  );
});
test("calendar-year age boundary and unknown years", () => {
  assert.equal(age(2564, 2569), 5);
  assert.equal(age(2564, 2570), 6);
  for (const y of ["", null, 2570, 2564.5, "unknown", 2021])
    assert.equal(age(y, 2569), null);
  assert.equal(computerStatus({ computerYear: 2564 }, 2569), "ปกติ");
  assert.equal(computerStatus({ computerYear: 2563 }, 2569), "เข้าเกณฑ์อายุ");
  assert.equal(
    computerStatus({ computerYear: 2563, computerOutcome: "ทดแทนแล้ว" }, 2569),
    "ทดแทนแล้ว",
  );
});
test("monitor condition is independent from age and computer outcome", () => {
  const a = {
    monitorCode: "7440-006-01-01-0001",
    monitorYear: 2559,
    monitorCondition: "ปกติ",
    computerOutcome: "ทดแทนแล้ว",
  };
  assert.equal(monitorNeedsAction(a), false);
  assert.equal(
    monitorNeedsAction({ ...a, monitorYear: 2569, monitorCondition: "ชำรุด" }),
    true,
  );
  assert.equal(
    monitorNeedsAction({
      ...a,
      monitorCondition: "ชำรุด",
      monitorOutcome: "ทดแทนแล้ว",
    }),
    false,
  );
  assert.equal(
    monitorNeedsAction({ ...a, monitorCode: "", monitorCondition: "ชำรุด" }),
    false,
  );
  assert.equal(age({ ...a, monitorCode: "" }.monitorYear, 2569), 10);
  assert.ok(
    issues({ ...a, computerYear: 2569, monitorCode: "" }, 2569).includes(
      "มีปีซื้อจอ แต่ยังไม่มีรหัส",
    ),
  );
});
test("spreadsheet export and HTML do not execute user text", () => {
  assert.equal(csvCell(" =1+1"), '"\' =1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});
