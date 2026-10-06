import {
  DEPARTMENTS,
  OUTCOMES,
  CONDITIONS,
  currentYear,
  age,
  isPC,
  isComputer,
  validMonitor,
  hasMonitorInfo,
  computerStatus,
  computerOld,
  computerBroken,
  COMPUTER_CONDITIONS,
  monitorStatus,
  monitorNeedsAction,
  issues,
  summarize,
  replacementPlan,
  escapeHtml,
  csvCell,
} from "./domain.js";
import { makeSnapshotAssets, SNAPSHOT_LABEL } from "./snapshot.js";
const ICONS = {
  monitor:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  laptop: '<path d="M5 16V5h14v11M2 16h20l-2 4H4z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  building:
    '<path d="M4 21V3h11v18M15 10h5v11M2 21h20M8 7h3M8 11h3M8 15h3M8 21v-3h3v3"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 8v5m0 3h.01"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4m0 3h.01"/>',
  external: '<path d="M14 3h7v7m0-7L11 13M10 5H4v15h15v-6"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 13-6l3 3M4 15l3 3a8 8 0 0 0 13-6"/>',
  settings:
    '<path d="m9 3 1 3h4l1-3 3 2-1 3 2 3h3v3l-3 1-2 3 1 3-3 1-2-3h-3l-2 3-3-2 1-3-2-3H2v-3l3-1 2-3-1-3z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  edit: '<path d="m15 4 5 5M4 16l12-12 4 4L8 20H4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.monitor}</svg>`;
const $ = (id) => document.getElementById(id),
  esc = escapeHtml;
const live = Boolean(window.google?.script?.run);
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1M8PgWp8kmsmvWRvqywJs3rCGL2rXuRFlAQ8Dw3tywiU/edit#gid=1417596017";
const state = {
  view: "overview",
  assets: live ? [] : makeSnapshotAssets(),
  department: "",
  type: "",
  query: "",
  scope: "computers",
  attention: "",
  year: currentYear(),
  token: "",
  user: { role: "viewer", department: "*" },
  sheetUrl: live ? "" : SHEET_URL,
  computerConditions: COMPUTER_CONDITIONS,
  monitorConditions: CONDITIONS.filter(Boolean),
  loading: live,
  error: "",
};
const labels = {
  overview: "ภาพรวม",
  inventory: "ทะเบียนครุภัณฑ์",
  departments: "กลุ่ม / ฝ่าย",
  plan: "แผนตามอายุ",
  quality: "ตรวจสอบข้อมูล",
};
const canEdit = () => state.user.role !== "viewer";
const sourceLabel = () =>
  live ? "Google Sheet · 2569+จอ" : "ชีต 2569+จอ ณ " + SNAPSHOT_LABEL;
// Public snapshot has no personal names, so show the role/note instead of a filler line.
const ownerText = (a) =>
  a.owner || (live ? "ยังไม่ระบุผู้รับผิดชอบ" : a.notes || "");
function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 4500);
}
function rpc(method, ...args) {
  return new Promise((resolve, reject) => {
    if (!live)
      return reject(new Error("หน้าทดลองยังไม่ได้เชื่อม Google Sheet"));
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((e) =>
        reject(new Error(e.message || "เชื่อมต่อไม่สำเร็จ")),
      )
      [method](...args);
  });
}
function toneOf(text) {
  return text === "ปกติ" || text === "ทดแทนแล้ว"
    ? "good"
    : text === "ชำรุด"
      ? "bad"
      : /เข้าเกณฑ์|รอ|ตรวจ|ซ่อม|ยังไม่ระบุสภาพ/.test(text)
        ? "warn"
        : "";
}
function badge(text, tone) {
  return `<span class="badge ${tone ?? toneOf(text)}"><i class="dot"></i>${esc(text)}</span>`;
}
function typeBadge(a, monitor = false) {
  return `<span class="type-badge ${monitor ? "mon" : a.type === "NB" ? "nb" : ""}">${icon(monitor ? "monitor" : a.type === "NB" ? "laptop" : "monitor")}${monitor ? "จอแยก" : esc(a.type)}</span>`;
}
function ageText(y) {
  const n = age(y, state.year);
  return n === null
    ? "—"
    : `<span class="age ${n > 5 ? "old" : ""}">${n} ปี</span>`;
}
function options(list, selected, emptyLabel) {
  return (
    (emptyLabel !== undefined
      ? `<option value="">${esc(emptyLabel)}</option>`
      : "") +
    list
      .map(
        (x) =>
          `<option value="${esc(x)}" ${x === selected ? "selected" : ""}>${esc(x)}</option>`,
      )
      .join("")
  );
}
function pageHead(title, sub, actions = "") {
  return `<div class="page-head"><div><div class="eyebrow">DPTC / ${state.year}</div><h1>${title}</h1><p>${sub}</p></div><div class="head-actions">${actions}</div></div>`;
}
// ตัวกรองสถานะ: label, ใช้กับแท็บคอมหรือจอ, เงื่อนไข
const STATUS_FILTERS = {
  "old-computers": {
    label: "คอมอายุเกิน 5 ปี (รอพิจารณา)",
    scope: "computers",
    test: (a) => computerOld(a, state.year),
  },
  "broken-computers": {
    label: "คอมชำรุด",
    scope: "computers",
    test: computerBroken,
  },
  "new-computers": {
    label: "คอมอายุไม่เกิน 5 ปี",
    scope: "computers",
    test: (a) => (age(a.computerYear, state.year) ?? 99) <= 5,
  },
  "old-monitors": {
    label: "จออายุเกิน 5 ปี",
    scope: "monitors",
    test: (a) => validMonitor(a) && (age(a.monitorYear, state.year) ?? -1) > 5,
  },
  "broken-monitors": {
    label: "จอชำรุด",
    scope: "monitors",
    test: monitorNeedsAction,
  },
  issues: {
    label: "ข้อมูลต้องตรวจสอบ",
    scope: "computers",
    test: (a) => issues(a, state.year).length > 0,
  },
};
function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.assets.filter(
    (a) =>
      (!state.department || a.department === state.department) &&
      (!state.type ||
        (state.type === "PC" ? isPC(a) : a.type === state.type)) &&
      (!q ||
        [a.owner, a.computerCode, a.monitorCode, a.notes, a.reason].some((x) =>
          String(x || "")
            .toLowerCase()
            .includes(q),
        )) &&
      (!state.attention || STATUS_FILTERS[state.attention].test(a)),
  );
}
function render() {
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.view === state.view),
    );
  $("breadcrumb").textContent = labels[state.view];
  $("year-label").textContent = `พ.ศ. ${state.year}`;
  $("quality-badge").textContent = summarize(state.assets, state.year).issues;
  $("mode-banner").innerHTML = live
    ? `<span>ข้อมูลสดจากชีต 2569+จอ · ${esc(state.user.department === "*" ? "ทุกกลุ่ม / ฝ่าย" : state.user.department)}</span>${state.user.open ? '<button id="open-live-sheet">เปิดชีต</button>' : '<button id="logout">ออกจากระบบ</button>'}`
    : `<span><strong>ข้อมูลจริงจากชีต 2569+จอ ณ ${SNAPSHOT_LABEL}</strong> · หน้านี้ดูอย่างเดียว ชื่อผู้รับผิดชอบดูได้ในชีต · แก้ไขข้อมูลที่ Google Sheet</span><button id="open-live-sheet">เปิดชีต</button>`;
  $("page").innerHTML = state.loading
    ? '<div class="loading"><span class="spinner"></span><p>กำลังอ่านทะเบียนครุภัณฑ์…</p></div>'
    : state.error
      ? `<div class="load-error"><h2>โหลดข้อมูลจากชีตไม่สำเร็จ</h2><p>${esc(state.error)}</p><button class="btn primary" id="retry-load">${icon("refresh")}ลองอีกครั้ง</button></div>`
      : {
        overview: renderOverview,
        inventory: renderInventory,
        departments: renderDepartments,
        plan: renderPlan,
        quality: renderQuality,
      }[state.view]();
  hydrateIcons();
  $("account-label").textContent = live
    ? state.user.open
      ? "แก้ไขได้ทุกฝ่าย"
      : state.user.role === "admin"
      ? "ผู้ดูแลระบบ"
      : state.user.role === "viewer"
        ? "ดูข้อมูล"
        : "เจ้าหน้าที่กลุ่ม/ฝ่าย"
    : "ข้อมูล ณ " + SNAPSHOT_LABEL;
}
function stat(label, value, unit, foot, cls, ico) {
  return `<div class="stat-card ${cls}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${foot}</div></div>`;
}
function alertTile(tone, n, title, sub, attrs, go) {
  return `<button class="alert-tile ${n ? tone : "ok"}" ${attrs}><span class="alert-num">${n}</span><span><h3>${title}</h3><p>${sub}</p><span class="alert-go">${go}${icon("chevron")}</span></span></button>`;
}
function renderOverview() {
  const s = summarize(state.assets, state.year),
    groups = DEPARTMENTS.map((name) => ({
      name,
      s: summarize(
        state.assets.filter((a) => a.department === name),
        state.year,
      ),
    })).filter((g) => g.s.computers);
  const max = Math.max(...groups.map((g) => g.s.computers), 1);
  return (
    pageHead(
      "ภาพรวมครุภัณฑ์",
      "คอมพิวเตอร์และจอของกองแผนงานและวิชาการ · เกณฑ์อายุทดแทน 5 ปี",
      `<button class="btn" data-action="export">${icon("download")}ส่งออก CSV</button>${canEdit() ? `<button class="btn primary" data-action="add">${icon("plus")}เพิ่มครุภัณฑ์</button>` : ""}`,
    ) +
    `<div class="stats">${stat("คอมพิวเตอร์ทั้งหมด", s.computers, "เครื่อง", "PC + NB ในทะเบียน", "featured", "layers")}${stat("PC ตั้งโต๊ะ", s.pc, "เครื่อง", "รวม PC ห้องสมุดแล้ว", "pc", "monitor")}${stat("โน้ตบุ๊ก NB", s.nb, "เครื่อง", "จอแยกนับต่างหาก", "nb", "laptop")}${stat("จอแยก", s.monitors, "จอ", "นับเฉพาะรหัส 7440-006-…", "mon", "monitor")}</div>
<h2 class="section-title">${icon("alert")}สิ่งที่ต้องดำเนินการ</h2>
<div class="alert-grid">${alertTile("warn", s.pendingComputers, "คอมอายุเกิน 5 ปี", "เข้าเกณฑ์พิจารณาทดแทน · ยังไม่บันทึกผล", 'data-attention="old-computers"', "ดูรายการ")}${alertTile("bad", s.brokenComputers, "คอมชำรุด", "สถานะ pc/nb = ชำรุด และยังไม่บันทึกผลทดแทน", 'data-attention="broken-computers"', "ดูรายการ")}${alertTile("bad", s.brokenMonitors, "จอชำรุด", "สถานะจอ = ชำรุด และยังไม่บันทึกผลทดแทน", 'data-attention="broken-monitors"', "ดูรายการ")}${alertTile("info", s.issues, "ข้อมูลยังไม่ครบ", "รหัสจอ ปีซื้อ หรือข้อมูลที่ควรยืนยัน", 'data-action="quality"', "ไปตรวจข้อมูล")}</div>
<div class="policy-note"><strong>จออายุเกิน 5 ปี ${s.oldMonitors} จอ</strong> — เข้าเกณฑ์อายุ แต่ถ้ายังใช้งานได้ <strong>ไม่จำเป็นต้องซื้อใหม่</strong></div>
<h2 class="section-title">${icon("building")}จำนวนเครื่องแต่ละกลุ่ม / ฝ่าย</h2>
<section class="panel"><div class="legend"><span><i class="swatch"></i>PC</span><span><i class="swatch nb"></i>NB</span><span><i class="swatch mon"></i>จอแยก (ตัวเลขใต้ยอดรวม)</span></div><div class="department-chart">${groups.map((g) => `<div class="dept-bar"><span class="dept-bar-label">${esc(g.name)}</span><div class="bar-track" role="img" aria-label="PC ${g.s.pc}, NB ${g.s.nb}"><span style="width:${(g.s.pc / max) * 100}%">${g.s.pc}</span><span class="nb" style="width:${(g.s.nb / max) * 100}%">${g.s.nb}</span></div><div class="dept-total"><strong>${g.s.computers}</strong><small>จอ ${g.s.monitors}</small></div></div>`).join("")}</div><div class="chart-foot"><button class="link-btn" data-action="departments">ดูรายละเอียดแต่ละฝ่าย${icon("chevron")}</button></div></section>
<section class="panel recent-panel"><div class="panel-head"><div><h2>คอมที่อายุเกิน 5 ปี</h2><p class="panel-subtitle">พิจารณาสภาพและความจำเป็นเป็นรายเครื่อง</p></div><button class="link-btn" data-attention="old-computers">ดูทั้งหมด${icon("chevron")}</button></div>${assetTable(state.assets.filter((a) => computerOld(a, state.year)).slice(0, 5), false)}</section>`
  );
}
function rowTone(a, mon) {
  return toneOf(mon ? monitorStatus(a) : computerStatus(a, state.year));
}
function openButton(a) {
  return `<button class="btn compact" data-edit="${a.row}" aria-label="เปิดรายการ ${esc(a.computerCode)}">${icon(canEdit() ? "edit" : "arrow")}${canEdit() ? "ดู / แก้ไข" : "ดูรายละเอียด"}</button>`;
}
function assetTable(rows, mon = false) {
  if (!rows.length)
    return '<div class="empty"><h3>ไม่มีรายการในเงื่อนไขนี้</h3><p>ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยเลขครุภัณฑ์</p></div>';
  return `<div class="table-wrap"><table class="cards-on-mobile"><thead><tr><th>${mon ? "จอแยก" : "คอมพิวเตอร์"}</th><th>กลุ่ม / ฝ่าย</th><th>ปีซื้อ / อายุ</th><th>${mon ? "สภาพจอ" : "สถานะคอม"}</th><th>${mon ? "เกณฑ์อายุ" : "จอแยก"}</th><th></th></tr></thead><tbody>${rows
    .map((a) => {
      const year = mon ? a.monitorYear : a.computerYear,
        monAge = age(a.monitorYear, state.year);
      return `<tr class="tone-${rowTone(a, mon) || "none"}"><td><div class="asset-cell">${typeBadge(a, mon)}<div><span class="asset-name">${esc(mon ? a.monitorCode || "ยังไม่มีรหัสจอ" : a.computerCode || "ยังไม่ระบุรหัส")}</span><small>${esc(mon ? "ใช้กับ " + (a.computerCode || a.type) : ownerText(a))}</small></div></div></td><td data-label="กลุ่ม / ฝ่าย">${esc(a.department)}</td><td data-label="ปีซื้อ / อายุ" class="tnum">${esc(year || "—")} <small>${ageText(year)}</small></td><td data-label="${mon ? "สภาพจอ" : "สถานะคอม"}">${badge(mon ? monitorStatus(a) : computerStatus(a, state.year))}</td><td data-label="${mon ? "เกณฑ์อายุ" : "จอแยก"}">${mon ? (monAge === null ? badge("ตรวจปีซื้อ", "warn") : monAge > 5 ? badge("เกิน 5 ปี · พิจารณาได้", "warn") : badge("ไม่เกิน 5 ปี", "good")) : validMonitor(a) ? badge("มีจอแยก", "info") : a.monitorCode ? badge("ตรวจรหัสจอ", "warn") : badge("ไม่มีรหัสจอ", "")}</td><td class="row-action">${openButton(a)}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function filters(withStatus = false) {
  const status = withStatus
    ? `<select id="status-filter" aria-label="สถานะ / อายุ" class="${state.attention ? "active-filter" : ""}"><option value="">ทุกสถานะ / อายุ</option>${Object.entries(
        STATUS_FILTERS,
      )
        .map(
          ([k, f]) =>
            `<option value="${k}" ${k === state.attention ? "selected" : ""}>${esc(f.label)}</option>`,
        )
        .join("")}</select>`
    : "";
  return `<div class="filter-bar"><div class="search">${icon("search")}<input id="search" type="search" placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ หรือรหัสจอ…" aria-label="ค้นหาครุภัณฑ์" value="${esc(state.query)}"></div>${status}<select id="department-filter" aria-label="กลุ่มฝ่าย">${options(DEPARTMENTS, state.department, "ทุกกลุ่ม / ฝ่าย")}</select><select id="type-filter" aria-label="ประเภทคอม">${options(["PC", "NB"], state.type, "ทุกประเภท")}</select></div>`;
}
const colorLegend =
  '<div class="legend"><span><i class="swatch good"></i>ปกติ</span><span><i class="swatch warn"></i>ต้องพิจารณา / ตรวจข้อมูล</span><span><i class="swatch bad"></i>ชำรุด</span></div>';
function renderInventory() {
  let rows = filtered();
  if (state.scope === "monitors") rows = rows.filter(hasMonitorInfo);
  return (
    pageHead(
      "ทะเบียนครุภัณฑ์",
      "คอมและจออยู่ในรายการเดียวกัน แต่บันทึกผลทดแทนแยกกัน",
      `<button class="btn" data-action="export">${icon("download")}ส่งออก CSV</button>${canEdit() ? `<button class="btn primary" data-action="add">${icon("plus")}เพิ่มรายการ</button>` : ""}`,
    ) +
    filters(true) +
    `<section class="panel"><div class="panel-head"><div class="segmented" role="tablist"><button data-scope="computers" class="${state.scope === "computers" ? "active" : ""}">${icon("laptop")}คอมพิวเตอร์</button><button data-scope="monitors" class="mon ${state.scope === "monitors" ? "active" : ""}">${icon("monitor")}จอแยก</button></div><span class="count-pill">${rows.length} รายการ</span></div>${state.attention ? `<div class="filter-note"><span>กำลังกรอง: ${esc(STATUS_FILTERS[state.attention].label)}</span><button class="link-btn" data-action="clear-attention">ล้างตัวกรอง ✕</button></div>` : ""}${colorLegend}${assetTable(rows, state.scope === "monitors")}</section>`
  );
}
function renderDepartments() {
  return (
    pageHead(
      "ครุภัณฑ์รายกลุ่ม / ฝ่าย",
      "จำนวนเครื่องและรายการที่ควรติดตามของแต่ละฝ่าย",
    ) +
    `<div class="department-cards">${DEPARTMENTS.filter(
      (name) =>
        state.user.department === "*" ||
        !live ||
        state.user.department === name,
    )
      .map((name) => {
        const s = summarize(
          state.assets.filter((a) => a.department === name),
          state.year,
        );
        return `<section class="panel department-card"><div class="card-title"><span class="stat-icon">${icon("building")}</span><h2>${esc(name)}</h2></div><div class="numbers"><div><strong>${s.pc}</strong><span>PC</span></div><div><strong>${s.nb}</strong><span>NB</span></div><div><strong>${s.monitors}</strong><span>จอแยก</span></div></div><div class="card-flags">${badge(`คอมเกิน 5 ปี ${s.oldComputers} เครื่อง`, s.oldComputers ? "warn" : "good")}${badge(`จอเกิน 5 ปี ${s.oldMonitors} จอ`, s.oldMonitors ? "warn" : "good")}${badge(`คอมชำรุด ${s.brokenComputers}`, s.brokenComputers ? "bad" : "good")}${badge(`จอชำรุด ${s.brokenMonitors}`, s.brokenMonitors ? "bad" : "good")}</div><div class="card-bottom"><button class="btn" data-department="${esc(name)}">เปิดทะเบียนฝ่ายนี้${icon("chevron")}</button></div></section>`;
      })
      .join("")}</div>`
  );
}
function num(n, cls) {
  return `<span class="${n ? cls : "zero"}">${n}</span>`;
}
function renderPlan() {
  const assets = state.department
      ? state.assets.filter((a) => a.department === state.department)
      : state.assets,
    rows = replacementPlan(assets, 2570, 2575, state.year),
    s = summarize(assets, 2569),
    sum = rows.reduce(
      (a, r) => ({
        pc: a.pc + r.pc,
        nb: a.nb + r.nb,
        total: a.total + r.total,
        monitors: a.monitors + r.monitors,
      }),
      { pc: 0, nb: 0, total: 0, monitors: 0 },
    ),
    peak = Math.max(...rows.map((r) => r.total)),
    scale = Math.max(peak, 1);
  return (
    pageHead(
      "แผนตามอายุ 2570–2575",
      "แต่ละเครื่องนับครั้งเดียว ในปีที่อายุเริ่มเกิน 5 ปี",
      `<button class="btn" data-action="print">${icon("download")}พิมพ์ / PDF</button>`,
    ) +
    `<div class="callout">${icon("shield")}<div><strong>เข้าเกณฑ์อายุ ≠ ต้องซื้อใหม่</strong>จอที่ยังใช้งานได้ให้คงสถานะปกติ พิจารณาทดแทนเมื่อชำรุดและจำเป็น · ตัวเลขยังไม่หักผลทดแทนที่บันทึกแล้ว</div></div><div class="filter-bar"><select id="department-filter" aria-label="เลือกกลุ่มฝ่ายของแผน">${options(DEPARTMENTS, state.department, "ทุกกลุ่ม / ฝ่าย")}</select>${badge(`เกินเกณฑ์แล้ว ณ 2569: คอม ${s.oldComputers} · จอ ${s.oldMonitors}`, "warn")}</div><section class="panel"><div class="legend"><span><i class="swatch"></i>PC</span><span><i class="swatch nb"></i>NB</span><span><i class="swatch mon"></i>จอ</span></div><div class="table-wrap"><table class="plan-table"><thead><tr><th>ปีที่เริ่มเกิน 5 ปี</th><th>PC</th><th>NB</th><th>รวมคอม</th><th>จอ</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.total === peak && peak ? "peak" : ""}"><td>${r.year}${r.total === peak && peak ? '<span class="peak-tag">สูงสุด</span>' : ""}<small>ซื้อปี ${r.year - 6}</small></td><td>${num(r.pc, "n-pc")}</td><td>${num(r.nb, "n-nb")}</td><td><div class="plan-bar"><strong>${r.total}</strong><span class="track"><i style="width:${(r.pc / scale) * 100}%"></i><i class="nb" style="width:${(r.nb / scale) * 100}%"></i></span></div></td><td>${num(r.monitors, "n-mon")}</td></tr>`).join("")}<tr class="plan-totals"><td>รวม 6 ปี</td><td>${sum.pc}</td><td>${sum.nb}</td><td>${sum.total}</td><td>${sum.monitors}</td></tr></tbody></table></div><div class="chart-foot">ปีที่เริ่มเกิน 5 ปี = ปีซื้อ + 6 · ไม่รวมรายการที่เกินเกณฑ์แล้วก่อนปี 2570 · จอนับเฉพาะรหัสที่ถูกรูปแบบ</div></section>`
  );
}
function renderQuality() {
  const rows = filtered().filter((a) => issues(a, state.year).length);
  return (
    pageHead(
      "ตรวจสอบข้อมูล",
      "รายการที่ข้อมูลยังไม่ครบ ควรแก้ในชีตก่อนนำไปจัดทำคำขอซื้อ",
    ) +
    filters() +
    `<section class="panel"><div class="panel-head"><h2>รายการที่ควรตรวจ</h2><span class="count-pill">${rows.length} รายการ</span></div>${
      rows.length
        ? `<div class="table-wrap"><table class="cards-on-mobile"><thead><tr><th>คอมพิวเตอร์</th><th>กลุ่ม / ฝ่าย</th><th>จุดที่ควรตรวจ</th><th></th></tr></thead><tbody>${rows
            .map(
              (a) =>
                `<tr class="tone-warn"><td><div class="asset-cell">${typeBadge(a)}<div><span class="asset-name">${esc(a.computerCode)}</span><small>${esc(ownerText(a))}</small></div></div></td><td data-label="กลุ่ม / ฝ่าย">${esc(a.department)}</td><td data-label="ควรตรวจ"><div class="issue-list">${issues(
                  a,
                  state.year,
                )
                  .map((t) => badge(t, "warn"))
                  .join("")}</div></td><td class="row-action">${openButton(a)}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty"><h3>✓ ข้อมูลครบตามเงื่อนไขที่ตรวจ</h3></div>'
    }</section>`
  );
}
function go(view) {
  state.view = view;
  state.attention = "";
  state.query = "";
  state.type = "";
  state.department = "";
  $("sidebar").classList.remove("open");
  $("menu-toggle").setAttribute("aria-expanded", "false");
  render();
  window.scrollTo(0, 0);
}
function field(label, name, value, type = "text", wide = false) {
  return `<label class="${wide ? "wide" : ""}">${label}<input name="${name}" value="${esc(value)}" type="${type}" ${["owner", "computerCode"].includes(name) ? 'maxlength="180"' : ""} ${type === "number" ? `min="2400" max="${currentYear()}" step="1"` : ""} ${name === "owner" ? "required" : ""}></label>`;
}
// Keep a value already in the sheet selectable even if the dropdown list changed.
const withCurrent = (list, value) =>
  value && !list.includes(String(value)) ? [...list, String(value)] : list;
function selectField(label, name, list, value, empty = "ยังไม่ระบุ") {
  return `<label>${label}<select name="${name}">${options(list.filter(Boolean), value, empty)}</select></label>`;
}
function openAsset(row) {
  const existing = state.assets.find((a) => a.row === Number(row)),
    a = existing || {
      department:
        state.user.department === "*" ? DEPARTMENTS[0] : state.user.department,
      type: "PC",
      owner: "",
      computerCode: "",
      computerYear: "",
      monitorCode: "",
      monitorYear: "",
      monitorCondition: "",
      computerOutcome: "",
      computerCondition: "",
      monitorOutcome: "",
      notes: "",
      reason: "",
    };
  $("asset-title").textContent = existing
    ? `${a.type} · ${a.computerCode || ownerText(a)}`
    : "เพิ่มครุภัณฑ์";
  $("asset-kicker").textContent = existing
    ? `ลำดับ ${a.id} / ${sourceLabel()}`
    : "รายการใหม่";
  const departments =
    state.user.department === "*" || !live
      ? DEPARTMENTS
      : [state.user.department];
  $("asset-content").innerHTML =
    `<form id="asset-form"><fieldset ${!canEdit() ? "disabled" : ""} style="border:0;margin:0;padding:0"><div class="form-body"><div class="form-grid" style="margin-bottom:20px">${field("ผู้รับผิดชอบ", "owner", existing ? a.owner || (live ? "" : "(ดูชื่อในชีต)") : "")}${selectField("กลุ่ม / ฝ่าย", "department", departments, a.department, "เลือกกลุ่ม / ฝ่าย")}</div><div class="form-section"><h3>${icon("laptop")}คอมพิวเตอร์ PC / NB</h3><div class="form-grid">${selectField("ประเภท", "type", withCurrent(["PC", "NB", "PC (ห้องสมุด)"], a.type), a.type, "เลือกประเภท")}${field("เลขครุภัณฑ์คอมพิวเตอร์", "computerCode", a.computerCode)}${field("ปีซื้อคอม (พ.ศ.)", "computerYear", a.computerYear, "number")}${selectField("สถานะ pc/nb", "computerCondition", withCurrent(state.computerConditions, a.computerCondition), a.computerCondition, "อัตโนมัติตามอายุ")}${selectField("ผลทดแทนเฉพาะคอม", "computerOutcome", OUTCOMES, a.computerOutcome, "ยังไม่บันทึกผล")}</div><p class="form-hint">อายุคอม ${age(a.computerYear, state.year) ?? "—"} ปี · ไม่เกิน 5 ปี = ปกติ / เกิน 5 ปี = เข้าเกณฑ์อายุพิจารณาทดแทน · สถานะ pc/nb เลือก "ชำรุด" ได้ทันที เลือก "อัตโนมัติตามอายุ" เพื่อกลับไปใช้สูตรเดิมของชีต</p></div><div class="form-section mon"><h3>${icon("monitor")}จอแยก</h3><div class="form-grid">${field("เลขครุภัณฑ์จอ", "monitorCode", a.monitorCode)}${field("ปีซื้อจอ (พ.ศ.)", "monitorYear", a.monitorYear, "number")}${selectField("สถานะจอ", "monitorCondition", withCurrent(state.monitorConditions, a.monitorCondition), a.monitorCondition)}${selectField("ผลทดแทนเฉพาะจอ", "monitorOutcome", OUTCOMES, a.monitorOutcome, "ยังไม่บันทึกผล")}</div><p class="form-hint">อายุจอ ${age(a.monitorYear, state.year) ?? "—"} ปี · คำนวณจากปีซื้อจอ แม้ยังไม่มีรหัส · จอที่ยังใช้งานได้ไม่จำเป็นต้องซื้อใหม่เพียงเพราะอายุเกิน 5 ปี</p></div><div class="form-grid"><label class="wide">หมายเหตุ<textarea name="notes" maxlength="3000" placeholder="บันทึกเพิ่มเติมได้ตามต้องการ">${esc(a.notes)}</textarea></label><label class="wide">เหตุผลความจำเป็นในการขอซื้อ<textarea name="reason" maxlength="3000" placeholder="ระบุอุปกรณ์ที่ขอทดแทน สภาพปัญหา และผลต่อการปฏิบัติงาน">${esc(a.reason)}</textarea></label></div><p class="form-error" id="save-error" role="alert"></p></div></fieldset><div class="form-actions"><small>${canEdit() ? "บันทึกลงชีตหลักและอัปเดตชีตแยกฝ่าย" : live ? "สิทธิ์นี้ดูข้อมูลได้อย่างเดียว" : "ดูอย่างเดียว · แก้ไขข้อมูลที่ Google Sheet"}</small><div class="right"><button type="button" class="btn" data-close="asset-dialog">ปิด</button>${canEdit() ? '<button type="submit" class="btn primary">บันทึกข้อมูล</button>' : ""}</div></div></form>`;
  $("asset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector("[type=submit]");
    const values = Object.fromEntries(new FormData(form));
    const draft = {
      ...values,
      computerYear:
        values.computerYear === "" ? "" : Number(values.computerYear),
      monitorYear: values.monitorYear === "" ? "" : Number(values.monitorYear),
    };
    if (!draft.type || !draft.department) {
      $("save-error").textContent = "กรุณาเลือกประเภทและกลุ่ม / ฝ่าย";
      return;
    }
    button.disabled = true;
    $("save-error").textContent = "";
    try {
      if (live) {
        const result = await rpc("saveAsset", state.token, {
          row: existing?.row || null,
          token: existing?.token || null,
          values: draft,
        });
        $("asset-dialog").close();
        toast(
          result.unchanged
            ? "ไม่มีข้อมูลเปลี่ยนแปลง"
            : result.warning || "บันทึกลงชีตแล้ว",
        );
        if (result.unchanged) return;
        await refreshData().catch(() => {});
        return;
      } else {
        const duplicate = state.assets.some(
          (x) =>
            x.row !== existing?.row &&
            ["computerCode", "monitorCode"].some(
              (k) => draft[k] && x[k] === draft[k],
            ),
        );
        if (duplicate) throw new Error("เลขครุภัณฑ์ซ้ำกับรายการอื่น");
        if (existing) Object.assign(existing, draft);
        else {
          const id = Math.max(0, ...state.assets.map((x) => x.id)) + 1;
          state.assets.push({ ...draft, id, row: id + 1, token: "demo-" + id });
        }
        render();
      }
      $("asset-dialog").close();
      toast(
        live ? "บันทึกข้อมูลแล้ว" : "บันทึกตัวอย่างแล้ว · ชีตจริงไม่ได้เปลี่ยน",
      );
    } catch (error) {
      $("save-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $("asset-dialog").showModal();
}
function exportData() {
  const rows = filtered();
  const headings = [
    "ลำดับ",
    "ประเภท",
    "ผู้รับผิดชอบ",
    "กลุ่ม/ฝ่าย",
    "เลขครุภัณฑ์คอม",
    "ปีซื้อคอม",
    "อายุคอม",
    "สถานะ pc/nb",
    "ผลทดแทนคอม",
    "เลขครุภัณฑ์จอ",
    "ปีซื้อจอ",
    "อายุจอ",
    "สถานะจอ",
    "ผลทดแทนจอ",
    "หมายเหตุ",
    "เหตุผลขอซื้อ",
  ];
  const body = rows.map((a) => [
    a.id,
    a.type,
    a.owner,
    a.department,
    a.computerCode,
    a.computerYear,
    age(a.computerYear, state.year),
    a.computerCondition,
    a.computerOutcome,
    a.monitorCode,
    a.monitorYear,
    age(a.monitorYear, state.year),
    a.monitorCondition,
    a.monitorOutcome,
    a.notes,
    a.reason,
  ]);
  const blob = new Blob(
    [
      "\uFEFF" +
        [headings, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `DPTC-inventory-${state.year}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function showSource() {
  $("source-content").innerHTML = live
    ? `<p><strong>แหล่งข้อมูล:</strong> ชีต 2569+จอ</p><p>ข้อมูลรายการมาจากชีตหลัก การแก้ไขบันทึกกลับเฉพาะช่องที่กรอก และแยกผลทดแทนคอมกับจอ</p><p>สถานะจอเป็นสภาพจริง อายุเกิน 5 ปีแสดงเป็นคำเตือนเท่านั้น</p><button class="btn primary" id="open-live-sheet">เปิด Google Sheet</button>`
    : `<p><strong>แหล่งข้อมูล:</strong> ชีต 2569+จอ ในไฟล์ “ครุภัณฑ์กองแผน” ณ ${SNAPSHOT_LABEL}</p><p>เลขครุภัณฑ์ ปีซื้อ ฝ่าย และสถานะเป็นค่าจริง ชื่อบุคคลไม่แสดงบนเว็บสาธารณะ ดูได้ในชีต</p><p>ต้องการแก้ไขข้อมูลหรือดูแบบสด ใช้แอปผ่าน Google Apps Script ที่ต้องใส่รหัสเข้าใช้งาน</p><button class="btn primary" id="open-live-sheet">เปิด Google Sheet</button>`;
  $("source-dialog").showModal();
}
async function refreshData() {
  if (!live) {
    render();
    toast("ข้อมูลชุดนี้เป็นของวันที่ " + SNAPSHOT_LABEL);
    return;
  }
  state.loading = true;
  render();
  try {
    const data = await rpc("getInventory", state.token);
    state.error = "";
    state.assets = data.assets;
    state.user = data.user;
    state.year = data.year;
    state.sheetUrl = data.sheetUrl;
    if (data.computerConditions) state.computerConditions = data.computerConditions;
    if (data.monitorConditions) state.monitorConditions = data.monitorConditions;
    $("sync-label").textContent =
      "อัปเดต " +
      new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
  } catch (error) {
    if (/เข้าใช้งาน|หมดอายุ/.test(error.message) && !state.user.open) {
      toast(error.message);
      state.token = "";
      state.assets = [];
      if (!$("login-dialog").open) $("login-dialog").showModal();
    } else if (!state.assets.length) state.error = error.message;
    else toast("โหลดข้อมูลใหม่ไม่สำเร็จ: " + error.message);
    throw error;
  } finally {
    state.loading = false;
    render();
  }
}
let searchTimer;
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.query = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const pos = event.target.selectionStart;
      render();
      $("search")?.focus();
      try {
        $("search")?.setSelectionRange(pos, pos);
      } catch {}
    }, 160);
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "department-filter") {
    state.department = event.target.value;
    render();
  }
  if (event.target.id === "status-filter") {
    state.attention = event.target.value;
    if (state.attention) state.scope = STATUS_FILTERS[state.attention].scope;
    render();
  }
  if (event.target.id === "type-filter") {
    state.type = event.target.value;
    render();
  }
});
document.addEventListener("click", (event) => {
  const b = event.target.closest("button,a");
  if (!b) return;
  if (b.dataset.view) {
    go(b.dataset.view);
    return;
  }
  if (b.dataset.close) {
    $(b.dataset.close).close();
    return;
  }
  if (b.dataset.edit) {
    openAsset(b.dataset.edit);
    return;
  }
  if (b.dataset.department) {
    go("inventory");
    state.department = b.dataset.department;
    render();
    return;
  }
  if (b.dataset.attention) {
    go("inventory");
    state.attention = b.dataset.attention;
    state.scope = STATUS_FILTERS[b.dataset.attention].scope;
    render();
    return;
  }
  if (b.dataset.scope) {
    state.scope = b.dataset.scope;
    render();
    return;
  }
  const action = b.dataset.action;
  if (action === "add") openAsset();
  if (action === "export") exportData();
  if (action === "print") window.print();
  if (action === "departments" || action === "quality") go(action);
  if (action === "clear-attention") {
    state.attention = "";
    render();
  }
  if (b.id === "source-button") showSource();
  if (b.id === "sheet-link" || b.id === "open-live-sheet") {
    if (state.sheetUrl) window.open(state.sheetUrl, "_blank", "noopener");
    else toast("ยังไม่ได้ลิงก์ชีต กรุณารอโหลดข้อมูลหรือกดรีเฟรช");
  }
  if (b.id === "refresh" || b.id === "retry-load") refreshData().catch(() => {});
  if (b.id === "menu-toggle") {
    const open = $("sidebar").classList.toggle("open");
    b.setAttribute("aria-expanded", String(open));
  }
  if (b.id === "logout") {
    const token = state.token;
    state.token = "";
    state.assets = [];
    rpc("logout", token).catch(() => {});
    render();
    $("login-dialog").showModal();
  }
});
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.currentTarget.querySelector("button"),
    input = e.currentTarget.elements.accessCode;
  b.disabled = true;
  $("login-error").textContent = "";
  try {
    const result = await rpc("login", input.value);
    input.value = "";
    state.token = result.token;
    state.user = result.user;
    $("login-dialog").close();
    await refreshData();
  } catch (error) {
    $("login-error").textContent = error.message;
    if (!$("login-dialog").open) $("login-dialog").showModal();
  } finally {
    b.disabled = false;
  }
});
$("login-dialog").addEventListener("cancel", (event) => event.preventDefault());
render();
if (live)
  rpc("openSession")
    .then((result) => {
      if (!result) {
        state.loading = false;
        render();
        $("login-dialog").showModal();
        return;
      }
      state.token = result.token;
      state.user = result.user;
      return refreshData().catch(() => {});
    })
    .catch((error) => {
      // e.g. an older รหัส.gs without openSession: fall back to the access-code form
      state.loading = false;
      render();
      $("login-error").textContent = /is not a function/.test(error.message)
        ? "รหัส.gs ใน Apps Script ยังเป็นเวอร์ชันเก่า กรุณาอัปเดตแล้ว deploy ใหม่"
        : error.message;
      $("login-dialog").showModal();
    });
