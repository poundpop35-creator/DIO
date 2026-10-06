export const DEPARTMENTS = [
  "ฝ่ายบริหารทั่วไป",
  "กลุ่มนโยบายและแผน",
  "กลุ่มติดตามและประเมินผล",
  "กลุ่มวิชาการและวิเทศสัมพันธ์",
];
export const OUTCOMES = ["", "รอดำเนินการ", "ทดแทนแล้ว", "ไม่ทดแทน"];
export const CONDITIONS = ["", "ปกติ", "ชำรุด", "อยู่ระหว่างซ่อม"];
export const currentYear = () =>
  Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(new Date()),
  ) + 543;
export function age(year, now = currentYear()) {
  if (year === "" || year == null) return null;
  const n = Number(year);
  return Number.isInteger(n) && n >= 2400 && n <= now ? now - n : null;
}
export const isComputer = (a) => ["PC", "NB", "PC (ห้องสมุด)"].includes(a.type);
export const isPC = (a) => ["PC", "PC (ห้องสมุด)"].includes(a.type);
export const validMonitor = (a) =>
  /^7440-006-\d{2}-\d{2}-\d{4}$/.test(String(a.monitorCode || "").trim());
export const hasMonitorInfo = (a) => Boolean(a.monitorCode || a.monitorYear);
export function computerStatus(a, now = currentYear()) {
  if (["ทดแทนแล้ว", "ไม่ทดแทน"].includes(a.computerOutcome))
    return a.computerOutcome;
  const n = age(a.computerYear, now);
  return n === null ? "ตรวจปีซื้อ" : n > 5 ? "เข้าเกณฑ์อายุ" : "ปกติ";
}
export const monitorStatus = (a) =>
  a.monitorCondition ||
  (hasMonitorInfo(a) ? "ยังไม่ระบุสภาพ" : "ไม่มีข้อมูลจอ");
export const monitorNeedsAction = (a) =>
  validMonitor(a) &&
  a.monitorCondition === "ชำรุด" &&
  !["ทดแทนแล้ว", "ไม่ทดแทน"].includes(a.monitorOutcome);
export function issues(a, now = currentYear()) {
  const out = [];
  if (age(a.computerYear, now) === null) out.push("ตรวจปีซื้อคอม");
  if (!a.monitorCode)
    out.push(
      a.monitorYear ? "มีปีซื้อจอ แต่ยังไม่มีรหัส" : "ยังไม่ระบุข้อมูลจอ",
    );
  else if (!validMonitor(a)) out.push("ตรวจรหัสจอ");
  if (validMonitor(a) && age(a.monitorYear, now) === null)
    out.push("ตรวจปีซื้อจอ");
  if ((age(a.computerYear, now) ?? 0) >= 20)
    out.push("ยืนยันปีซื้อคอม (อายุ 20 ปีขึ้นไป)");
  if ((age(a.monitorYear, now) ?? 0) >= 20)
    out.push("ยืนยันปีซื้อจอ (อายุ 20 ปีขึ้นไป)");
  return out;
}
export function summarize(assets, now = currentYear()) {
  const computers = assets.filter(isComputer),
    monitors = assets.filter(validMonitor);
  return {
    computers: computers.length,
    pc: computers.filter(isPC).length,
    nb: computers.filter((a) => a.type === "NB").length,
    monitors: new Set(monitors.map((a) => a.monitorCode.trim())).size,
    oldComputers: computers.filter((a) => (age(a.computerYear, now) ?? -1) > 5)
      .length,
    pendingComputers: computers.filter(
      (a) => computerStatus(a, now) === "เข้าเกณฑ์อายุ",
    ).length,
    oldMonitors: monitors.filter((a) => (age(a.monitorYear, now) ?? -1) > 5)
      .length,
    brokenMonitors: monitors.filter(monitorNeedsAction).length,
    issues: assets.filter((a) => issues(a, now).length).length,
    missingMonitor: assets.filter((a) => !a.monitorCode).length,
    invalidMonitor: assets.filter((a) => a.monitorCode && !validMonitor(a))
      .length,
  };
}
export function replacementPlan(
  assets,
  start = 2570,
  end = 2575,
  now = currentYear(),
) {
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const year = start + i;
    const c = assets.filter(
      (a) =>
        isComputer(a) &&
        age(a.computerYear, now) !== null &&
        Number(a.computerYear) + 6 === year,
    );
    const monitors = assets.filter(
      (a) =>
        validMonitor(a) &&
        age(a.monitorYear, now) !== null &&
        Number(a.monitorYear) + 6 === year,
    );
    return {
      year,
      completeYear: year - 1,
      pc: c.filter(isPC).length,
      nb: c.filter((a) => a.type === "NB").length,
      total: c.length,
      monitors: monitors.length,
    };
  });
}
export const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
