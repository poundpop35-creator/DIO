/** DPTC Inventory — Google Sheet is the only source of truth.
 * Configure SPREADSHEET_ID and ACCESS_RULES in Script Properties.
 * Never put real access codes or personal inventory data in this repository.
 */
const DPTC_DEPARTMENTS = [
  "ฝ่ายบริหารทั่วไป",
  "กลุ่มนโยบายและแผน",
  "กลุ่มติดตามและประเมินผล",
  "กลุ่มวิชาการและวิเทศสัมพันธ์",
];
const DPTC_HEADERS = {
  id: ["ลำดับ"],
  type: ["ประเภท"],
  owner: ["ผู้รับผิดชอบ"],
  department: ["กลุ่ม/ฝ่าย"],
  computerCode: ["AMS", "เลขครุภัณฑ์ PC/NB"],
  computerYear: ["ปีที่จัดซื้อ", "ปีที่จัดซื้อ (PC/NB)", "ปีซื้อ PC/NB"],
  computerAge: ["อายุ PC/NB"],
  computerStatus: ["สถานะ pc/nb", "สถานะ PC/NB", "สถานะทดแทนคอม", "สถานะทดแทน"],
  computerOutcome: ["ผลดำเนินการทดแทน", "ผลดำเนินการทดแทนคอม", "ผลทดแทนคอม"],
  monitorCode: ["จอ", "เลขครุภัณฑ์จอ"],
  monitorYear: ["ปีที่จัดซื้อจอ"],
  monitorAge: ["อายุจอ"],
  monitorCondition: ["สถานะจอ"],
  monitorOutcome: ["ผลดำเนินการทดแทนจอ", "ผลทดแทนจอ"],
  notes: ["หมายเหตุ"],
  reason: ["เหตุผลความจำเป็นในการขอซื้อ"],
  firewall: ["ติดตั้ง Firewall"],
  editor: ["ผู้แก้ไข"],
  time: ["เวลา"],
};
const DPTC_EDITABLE = [
  "type",
  "owner",
  "department",
  "computerCode",
  "computerYear",
  "computerOutcome",
  "monitorCode",
  "monitorYear",
  "monitorCondition",
  "monitorOutcome",
  "notes",
  "reason",
];
function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("DPTC | ทะเบียนครุภัณฑ์")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
function year_() {
  return Number(Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy")) + 543;
}
function text_(v) {
  return String(v == null ? "" : v).trim();
}
function sha_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(v))
    .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
    .join("");
}
function config_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("ผู้ดูแลต้องตั้งค่า SPREADSHEET_ID ก่อนใช้งาน");
  return { id, sheet: p.getProperty("SHEET_NAME") || "2569+จอ" };
}
function sheet_() {
  const c = config_(),
    s = SpreadsheetApp.openById(c.id).getSheetByName(c.sheet);
  if (!s) throw new Error("ไม่พบชีต " + c.sheet);
  return s;
}
function schema_(s) {
  const headers = s
      .getRange(1, 1, 1, s.getLastColumn())
      .getDisplayValues()[0]
      .map(text_),
    seen = {};
  headers.forEach((h) => {
    if (h && seen[h]) throw new Error("หัวคอลัมน์ซ้ำ: " + h);
    if (h) seen[h] = true;
  });
  const map = {};
  Object.keys(DPTC_HEADERS).forEach((k) => {
    const found = DPTC_HEADERS[k]
      .map((h) => headers.indexOf(h))
      .filter((i) => i >= 0);
    if (found.length > 1)
      throw new Error("หัวคอลัมน์ซ้ำความหมาย: " + DPTC_HEADERS[k].join(" / "));
    map[k] = found.length ? found[0] : -1;
  });
  [
    "id",
    "type",
    "owner",
    "department",
    "computerCode",
    "computerYear",
    "computerAge",
    "computerStatus",
    "computerOutcome",
    "monitorCode",
    "monitorYear",
    "monitorAge",
    "monitorCondition",
    "monitorOutcome",
    "notes",
    "reason",
  ].forEach((k) => {
    if (map[k] < 0) throw new Error("ไม่พบหัวคอลัมน์ " + DPTC_HEADERS[k][0]);
  });
  return { headers, map };
}
function rules_() {
  let rules;
  try {
    rules = JSON.parse(
      PropertiesService.getScriptProperties().getProperty("ACCESS_RULES") ||
        "[]",
    );
  } catch (e) {
    throw new Error("ผู้ดูแลต้องตรวจรูปแบบ ACCESS_RULES");
  }
  if (!Array.isArray(rules) || !rules.length)
    throw new Error("ผู้ดูแลยังไม่ได้ตั้งรหัสเข้าใช้งาน");
  return rules;
}
function login(code) {
  code = text_(code);
  if (code.length < 8 || code.length > 200)
    throw new Error("รหัสเข้าใช้งานไม่ถูกต้อง");
  const cache = CacheService.getScriptCache(),
    key = "dptc-attempt-" + Session.getTemporaryActiveUserKey(),
    attempts = Number(cache.get(key) || 0);
  if (attempts >= 8) throw new Error("ลองรหัสเกินกำหนด กรุณารอ 5 นาที");
  const hash = sha_(code),
    rule = rules_().find(
      (r) =>
        r.hash === hash &&
        ["admin", "staff", "viewer"].includes(r.role) &&
        (r.department === "*" || DPTC_DEPARTMENTS.includes(r.department)),
    );
  if (!rule) {
    cache.put(key, String(attempts + 1), 300);
    throw new Error("รหัสเข้าใช้งานไม่ถูกต้อง");
  }
  if (rule.role === "staff" && rule.department === "*")
    throw new Error("บัญชีเจ้าหน้าที่ต้องระบุกลุ่ม/ฝ่าย");
  cache.remove(key);
  const token = Utilities.getUuid() + Utilities.getUuid(),
    user = {
      role: rule.role,
      department: rule.department,
      label: text_(rule.label) || rule.department,
    };
  cache.put("dptc-session-" + sha_(token), JSON.stringify(user), 14400);
  return { token, user };
}
function session_(token) {
  if (typeof token !== "string" || token.length > 200)
    throw new Error("กรุณาเข้าใช้งาน");
  const raw = CacheService.getScriptCache().get("dptc-session-" + sha_(token));
  if (!raw) throw new Error("การเข้าใช้งานหมดอายุ กรุณาเข้าใช้งานอีกครั้ง");
  return JSON.parse(raw);
}
function logout(token) {
  if (typeof token === "string")
    CacheService.getScriptCache().remove("dptc-session-" + sha_(token));
  return { ok: true };
}
function token_(row) {
  return sha_(
    JSON.stringify(row.map((v) => (v instanceof Date ? v.toISOString() : v))),
  );
}
function record_(row, index, map) {
  const item = { row: index, token: token_(row) };
  Object.keys(DPTC_HEADERS).forEach((k) => {
    if (map[k] >= 0) {
      let v = row[map[k]];
      if (v instanceof Date) v = v.toISOString();
      item[k] = v == null ? "" : v;
    }
  });
  return item;
}
function getInventory(token) {
  const user = session_(token),
    s = sheet_(),
    schema = schema_(s),
    rows =
      s.getLastRow() > 1
        ? s
            .getRange(2, 1, s.getLastRow() - 1, schema.headers.length)
            .getValues()
        : [];
  const assets = [];
  rows.forEach((row, i) => {
    if (!text_(row[schema.map.type])) return;
    if (
      user.department !== "*" &&
      text_(row[schema.map.department]) !== user.department
    )
      return;
    assets.push(record_(row, i + 2, schema.map));
  });
  return {
    assets,
    user,
    year: year_(),
    sheetUrl: s.getParent().getUrl() + "#gid=" + s.getSheetId(),
  };
}
function validateYear_(v, label) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2400 || n > year_())
    throw new Error(label + " ต้องเป็นปี พ.ศ. จำนวนเต็ม ไม่เกินปีปัจจุบัน");
  return n;
}
function validate_(input, user) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("ข้อมูลไม่ถูกต้อง");
  const out = {};
  DPTC_EDITABLE.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(input, k))
      out[k] = text_(input[k]);
  });
  if (!["PC", "NB", "PC (ห้องสมุด)"].includes(out.type))
    throw new Error("เลือกประเภท PC / NB / PC (ห้องสมุด)");
  if (!out.owner || out.owner.length > 180)
    throw new Error("กรอกผู้รับผิดชอบ ไม่เกิน 180 ตัวอักษร");
  if (!DPTC_DEPARTMENTS.includes(out.department))
    throw new Error("กลุ่ม/ฝ่ายไม่ถูกต้อง");
  if (user.department !== "*" && out.department !== user.department)
    throw new Error("แก้ไขได้เฉพาะกลุ่ม/ฝ่ายของตนเอง");
  ["computerOutcome", "monitorOutcome"].forEach((k) => {
    if (!["", "รอดำเนินการ", "ทดแทนแล้ว", "ไม่ทดแทน"].includes(out[k] || ""))
      throw new Error("ผลทดแทนไม่ถูกต้อง");
  });
  if (
    !["", "ปกติ", "ชำรุด", "อยู่ระหว่างซ่อม"].includes(
      out.monitorCondition || "",
    )
  )
    throw new Error("สถานะการใช้งานจอไม่ถูกต้อง");
  out.computerYear = validateYear_(out.computerYear, "ปีซื้อคอม");
  out.monitorYear = validateYear_(out.monitorYear, "ปีซื้อจอ");
  ["computerCode", "monitorCode"].forEach((k) => {
    if ((out[k] || "").length > 180) throw new Error("เลขครุภัณฑ์ยาวเกินกำหนด");
  });
  ["notes", "reason"].forEach((k) => {
    if ((out[k] || "").length > 3000)
      throw new Error("ข้อความยาวเกิน 3,000 ตัวอักษร");
  });
  return out;
}
function safe_(v) {
  return typeof v === "string" && /^\s*[=+@-]/.test(v) ? "'" + v : v;
}
function col_(i) {
  let n = i + 1,
    t = "";
  while (n) {
    n--;
    t = String.fromCharCode(65 + (n % 26)) + t;
    n = Math.floor(n / 26);
  }
  return t;
}
function ageFormula_(row, yearCol, typeCol) {
  const y = col_(yearCol) + row,
    b = col_(typeCol) + row;
  return (
    "=IFERROR(IF(OR(" +
    b +
    '="",' +
    y +
    '="",VALUE(' +
    y +
    ")<2400,VALUE(" +
    y +
    ")>YEAR(TODAY())+543,MOD(VALUE(" +
    y +
    '),1)<>0),"",YEAR(TODAY())+543-VALUE(' +
    y +
    '))," ")'.replace('" ")', '"")')
  );
}
function computerFormula_(r, m) {
  const b = col_(m.type) + r,
    a = col_(m.computerAge) + r,
    o = col_(m.computerOutcome) + r;
  return (
    "=IF(" +
    b +
    '="","",IF(OR(' +
    o +
    '="ทดแทนแล้ว",' +
    o +
    '="ไม่ทดแทน"),' +
    o +
    ",IF(" +
    a +
    '="","ตรวจสอบข้อมูล",IF(' +
    a +
    '<=5,"ปกติ","รอดำเนินการ"))))'
  );
}
function saveAsset(token, payload) {
  const user = session_(token);
  if (user.role === "viewer") throw new Error("สิทธิ์นี้ดูข้อมูลได้อย่างเดียว");
  const item = validate_(payload && payload.values, user),
    lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let changed = false;
  try {
    const s = sheet_(),
      { headers, map } = schema_(s),
      rows =
        s.getLastRow() > 1
          ? s.getRange(2, 1, s.getLastRow() - 1, headers.length).getValues()
          : [];
    let r = Number(payload.row),
      old = [];
    if (payload.row != null) {
      if (!Number.isInteger(r) || r < 2 || r > s.getLastRow())
        throw new Error("ไม่พบรายการ");
      old = rows[r - 2];
      if (
        user.department !== "*" &&
        text_(old[map.department]) !== user.department
      )
        throw new Error("ไม่มีสิทธิ์แก้ไขรายการของฝ่ายอื่น");
      if (!text_(old[map.type])) throw new Error("ไม่พบรายการ");
      if (!payload.token || token_(old) !== payload.token)
        throw new Error(
          "ข้อมูลถูกแก้ไขแล้ว กรุณาปิดหน้าต่างและรีเฟรชก่อนบันทึก",
        );
    } else {
      const empty = rows.findIndex((row) =>
        DPTC_EDITABLE.every((k) => !text_(row[map[k]])),
      );
      r = empty >= 0 ? empty + 2 : Math.max(2, s.getLastRow() + 1);
      if (r > s.getMaxRows())
        throw new Error(
          "แถวเตรียมไว้เต็ม กรุณาเพิ่มแถวและสูตรในชีตก่อนเพิ่มรายการ",
        );
    }
    for (const key of ["computerCode", "monitorCode"]) {
      const value = item[key];
      if (
        value &&
        rows.some(
          (row, i) =>
            i + 2 !== r &&
            text_(row[map.type]) &&
            text_(row[map[key]]) === value,
        )
      )
        throw new Error(
          (key === "computerCode" ? "เลขครุภัณฑ์คอม" : "เลขครุภัณฑ์จอ") +
            " ซ้ำกับรายการอื่น",
        );
    }
    // Preflight formula cells: never overwrite a spill anchor or per-row calculation with text.
    const existingFormulas = s
      .getRange(r, 1, 1, headers.length)
      .getFormulas()[0];
    for (const k of DPTC_EDITABLE) {
      if (existingFormulas[map[k]])
        throw new Error(
          "ช่อง " +
            headers[map[k]] +
            " ยังเป็นสูตร กรุณาปรับให้เป็นช่องกรอกก่อนบันทึก",
        );
    }
    if (payload.row == null) {
      const next =
        rows.reduce((max, row) => Math.max(max, Number(row[map.id]) || 0), 0) +
        1;
      s.getRange(r, map.id + 1).setValue(next);
      changed = true;
    }
    DPTC_EDITABLE.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(item, k)) {
        s.getRange(r, map[k] + 1).setValue(safe_(item[k]));
        changed = true;
      }
    });
    s.getRange(r, map.computerAge + 1).setFormula(
      ageFormula_(r, map.computerYear, map.type),
    );
    s.getRange(r, map.monitorAge + 1).setFormula(
      ageFormula_(r, map.monitorYear, map.type),
    );
    s.getRange(r, map.computerStatus + 1).setFormula(computerFormula_(r, map));
    if (map.editor >= 0)
      s.getRange(r, map.editor + 1).setValue(safe_(user.label));
    if (map.time >= 0) s.getRange(r, map.time + 1).setValue(new Date());
    SpreadsheetApp.flush();
    let warning = "";
    try {
      let log = s.getParent().getSheetByName("Log");
      if (!log) {
        log = s.getParent().insertSheet("Log");
        log.appendRow([
          "วันที่/เวลา",
          "การกระทำ",
          "กลุ่ม/ฝ่ายผู้แก้ไข",
          "รายละเอียด",
        ]);
      }
      log.appendRow([
        new Date(),
        payload.row == null ? "เพิ่มรายการ" : "แก้ไขรายการ",
        safe_(user.label),
        JSON.stringify({
          sheet: s.getName(),
          row: r,
          before: old,
          after: item,
        }),
      ]);
    } catch (error) {
      warning = "บันทึกข้อมูลแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาตรวจ Log";
    }
    return { ok: true, row: r, warning };
  } catch (error) {
    throw new Error(
      (changed ? "อาจบันทึกบางส่วนแล้ว กรุณารีเฟรชตรวจสอบ: " : "") +
        error.message,
    );
  } finally {
    lock.releaseLock();
  }
}
/** Run manually in the editor AFTER adding ACCESS_CODE_SETUP (a JSON array of {code,role,department,label}) to Script Properties.
 * This function is private to google.script.run because its name ends in underscore.
 * Clears plaintext setup codes after hashing. No codes are logged.
 */
function configureAccess_() {
  const p = PropertiesService.getScriptProperties(),
    raw = p.getProperty("ACCESS_CODE_SETUP");
  if (!raw) throw new Error("ตั้ง ACCESS_CODE_SETUP ใน Script Properties ก่อน");
  const input = JSON.parse(raw);
  if (!Array.isArray(input) || !input.length)
    throw new Error("ต้องมีอย่างน้อยหนึ่งบัญชี");
  const hashes = {};
  const rules = input.map((r) => {
    if (typeof r.code !== "string" || text_(r.code).length < 16)
      throw new Error("รหัสต้องยาวอย่างน้อย 16 ตัวอักษร");
    if (!["admin", "staff", "viewer"].includes(r.role))
      throw new Error("role ไม่ถูกต้อง");
    if (r.department !== "*" && !DPTC_DEPARTMENTS.includes(r.department))
      throw new Error("department ไม่ถูกต้อง");
    if (r.role === "staff" && r.department === "*")
      throw new Error("staff ต้องระบุฝ่าย");
    const hash = sha_(text_(r.code));
    if (hashes[hash]) throw new Error("ห้ามใช้รหัสซ้ำ");
    hashes[hash] = true;
    return {
      hash,
      role: r.role,
      department: r.department,
      label: text_(r.label) || r.department,
    };
  });
  p.setProperty("ACCESS_RULES", JSON.stringify(rules));
  p.deleteProperty("ACCESS_CODE_SETUP");
}
