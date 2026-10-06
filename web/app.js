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
  monitorStatus,
  monitorNeedsAction,
  issues,
  summarize,
  replacementPlan,
  escapeHtml,
  csvCell,
} from "./domain.js";
import { makeDemoAssets } from "./demo.js";
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
const state = {
  view: "overview",
  assets: live ? [] : makeDemoAssets(),
  department: "",
  type: "",
  query: "",
  scope: "computers",
  attention: "",
  year: live ? currentYear() : 2569,
  token: "",
  user: { role: live ? "viewer" : "admin", department: "*" },
  sheetUrl: "",
  loading: false,
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
  live ? "Google Sheet · 2569+จอ" : "ข้อมูลตัวอย่าง · ฐานปี 2569";
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
function badge(text, tone) {
  tone =
    tone ||
    (text === "ปกติ" || text === "ทดแทนแล้ว"
      ? "good"
      : text === "ชำรุด"
        ? "bad"
        : /เข้าเกณฑ์|รอ|ตรวจ/.test(text)
          ? "warn"
          : "");
  return `<span class="badge ${tone}">${esc(text)}</span>`;
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
      (!state.attention ||
        (state.attention === "old-computers"
          ? computerStatus(a, state.year) === "เข้าเกณฑ์อายุ"
          : state.attention === "broken-monitors"
            ? monitorNeedsAction(a)
            : issues(a, state.year).length > 0)),
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
    ? `<span>ข้อมูลจากชีต 2569+จอ · ${esc(state.user.department === "*" ? "ทุกกลุ่ม / ฝ่าย" : state.user.department)}</span><button id="logout">ออกจากระบบ</button>`
    : '<span>โหมดตัวอย่าง · รายชื่อและรหัสเป็นข้อมูลสมมติ การทดลองแก้ไขไม่กระทบชีตจริง</span><button id="reset-demo">เริ่มใหม่</button>';
  $("page").innerHTML = state.loading
    ? '<div class="loading"><span class="spinner"></span><p>กำลังอ่านทะเบียนครุภัณฑ์…</p></div>'
    : {
        overview: renderOverview,
        inventory: renderInventory,
        departments: renderDepartments,
        plan: renderPlan,
        quality: renderQuality,
      }[state.view]();
  hydrateIcons();
  $("account-label").textContent = live
    ? state.user.role === "admin"
      ? "ผู้ดูแลระบบ"
      : state.user.role === "viewer"
        ? "ดูข้อมูล"
        : "เจ้าหน้าที่กลุ่ม/ฝ่าย"
    : "โหมดตัวอย่าง";
}
function stat(label, value, unit, foot, cls, ico) {
  return `<div class="stat-card ${cls}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot"><span class="tone-dot"></span>${foot}</div></div>`;
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
      "ติดตามเครื่องที่ใช้งาน และวางแผนทดแทนจากข้อมูลเดียวกัน",
      `<button class="btn" data-action="export">${icon("download")}ส่งออกข้อมูล</button>${canEdit() ? `<button class="btn primary" data-action="add">${icon("plus")}เพิ่มครุภัณฑ์</button>` : ""}`,
    ) +
    `<div class="stats">${stat("คอมพิวเตอร์ทั้งหมด", s.computers, "เครื่อง", "PC และ NB ในทะเบียน", "featured", "layers")}${stat("คอมพิวเตอร์ PC", s.pc, "เครื่อง", "รวมเครื่องห้องสมุดแล้ว", "", "monitor")}${stat("โน้ตบุ๊ก NB", s.nb, "เครื่อง", "จอแยกนับต่างหาก", "purple", "laptop")}${stat("จอแยกในทะเบียน", s.monitors, "จอ", "นับเฉพาะรหัสจอที่เข้ารูปแบบ", "teal", "monitor")}</div>
 <div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>ครุภัณฑ์ในแต่ละกลุ่ม / ฝ่าย</h2><p class="panel-subtitle">เปรียบเทียบจำนวนคอมพิวเตอร์ PC และ NB</p></div><button class="link-btn" data-action="departments">ดูรายละเอียด</button></div><div class="legend"><span><i class="swatch"></i>PC</span><span><i class="swatch nb"></i>NB</span></div><div class="department-chart">${groups.map((g) => `<div class="dept-bar"><span class="dept-bar-label">${esc(g.name)}</span><div class="bar-track" role="img" aria-label="PC ${g.s.pc}, NB ${g.s.nb}"><span style="width:${(g.s.pc / max) * 100}%">${g.s.pc}</span><span class="nb" style="width:${(g.s.nb / max) * 100}%">${g.s.nb}</span></div><strong>${g.s.computers}</strong></div>`).join("")}</div><div class="chart-foot">จอแยกของโน้ตบุ๊กนับรวมในยอดจอ ไม่รวมจอที่ติดมากับตัวเครื่อง</div></section>
 <section class="panel"><div class="panel-head"><h2>สิ่งที่ต้องติดตาม</h2><span>${icon("clock")}</span></div><div class="action-list"><div class="action-row"><span class="action-symbol">${icon("calendar")}</span><div><h3>คอมเข้าเกณฑ์อายุทดแทน</h3><p>อายุเกิน 5 ปี · ตรวจสภาพก่อนขอซื้อ</p><button class="link-btn" data-attention="old-computers">ดูรายการ</button></div><strong>${s.pendingComputers}</strong></div><div class="action-row"><span class="action-symbol teal">${icon("monitor")}</span><div><h3>จอชำรุดที่ต้องพิจารณา</h3><p>แยกจากจอที่เพียงแค่อายุเกินเกณฑ์</p><button class="link-btn" data-attention="broken-monitors">ดูรายการ</button></div><strong>${s.brokenMonitors}</strong></div><div class="action-row"><span class="action-symbol blue">${icon("shield")}</span><div><h3>รายการที่ข้อมูลยังไม่ครบ</h3><p>รหัสจอ ปีซื้อ หรือข้อมูลที่ควรยืนยัน</p><button class="link-btn" data-action="quality">ตรวจข้อมูล</button></div><strong>${s.issues}</strong></div></div><div class="policy-note"><strong>จอเกิน 5 ปี ${s.oldMonitors} จอ</strong> เข้าเกณฑ์อายุพิจารณาทดแทน แต่หากยังใช้งานได้ ไม่จำเป็นต้องซื้อใหม่</div></section></div>
 <section class="panel recent-panel"><div class="panel-head"><div><h2>รายการที่เข้าเกณฑ์อายุคอมพิวเตอร์</h2><p class="panel-subtitle">พิจารณาสภาพและความจำเป็นเป็นรายเครื่อง</p></div><button class="link-btn" data-attention="old-computers">ดูทั้งหมด</button></div>${assetTable(state.assets.filter((a) => computerStatus(a, state.year) === "เข้าเกณฑ์อายุ").slice(0, 4), false)}</section>`
  );
}
function assetTable(rows, mon = false) {
  if (!rows.length)
    return '<div class="empty"><h3>ไม่มีรายการในเงื่อนไขนี้</h3><p>ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยชื่อผู้รับผิดชอบ</p></div>';
  return `<div class="table-wrap"><table><thead><tr><th>ครุภัณฑ์ / ผู้รับผิดชอบ</th><th>กลุ่ม / ฝ่าย</th><th>ปีซื้อ / อายุ</th><th>${mon ? "สถานะการใช้งาน" : "สถานะคอม"}</th><th>${mon ? "เกณฑ์อายุ" : "จอแยก"}</th><th></th></tr></thead><tbody>${rows.map((a) => `<tr><td>${typeBadge(a, mon)} <span class="asset-name">${esc(mon ? a.monitorCode || "ยังไม่ระบุรหัสจอ" : a.computerCode || "ยังไม่ระบุรหัส")}</span><small>${esc(a.owner || "ยังไม่ระบุผู้รับผิดชอบ")}</small></td><td>${esc(a.department)}</td><td>${esc((mon ? a.monitorYear : a.computerYear) || "—")}<small>${ageText(mon ? a.monitorYear : a.computerYear)}</small></td><td>${badge(mon ? monitorStatus(a) : computerStatus(a, state.year))}</td><td>${mon ? (age(a.monitorYear, state.year) === null ? badge("ตรวจปีซื้อ", "warn") : age(a.monitorYear, state.year) > 5 ? badge("พิจารณาทดแทนได้", "warn") : badge("ไม่เกิน 5 ปี", "good")) : validMonitor(a) ? badge("มีจอแยก", "info") : a.monitorCode ? badge("ตรวจรหัสจอ", "warn") : '<span class="badge">ยังไม่ระบุ</span>'}</td><td><button class="icon-btn" data-edit="${a.row}" aria-label="ดูรายละเอียด ${esc(a.computerCode)}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>`;
}
function filters() {
  return `<div class="filter-bar"><div class="search">${icon("search")}<input id="search" type="search" placeholder="ค้นหารหัสครุภัณฑ์ หรือผู้รับผิดชอบ…" aria-label="ค้นหาครุภัณฑ์" value="${esc(state.query)}"></div><select id="department-filter" aria-label="กลุ่มฝ่าย">${options(DEPARTMENTS, state.department, "ทุกกลุ่ม / ฝ่าย")}</select><select id="type-filter" aria-label="ประเภทคอม">${options(["PC", "NB"], state.type, "ทุกประเภท")}</select></div>`;
}
function renderInventory() {
  let rows = filtered();
  if (state.scope === "monitors") rows = rows.filter(hasMonitorInfo);
  return (
    pageHead(
      "ทะเบียนครุภัณฑ์",
      "ข้อมูลคอมพิวเตอร์และจออยู่ในรายการเดียวกัน แต่บันทึกผลทดแทนแยกกัน",
      `<button class="btn" data-action="export">${icon("download")}ส่งออก</button>${canEdit() ? `<button class="btn primary" data-action="add">${icon("plus")}เพิ่มรายการ</button>` : ""}`,
    ) +
    filters() +
    `<section class="panel"><div class="panel-head"><div class="segmented"><button data-scope="computers" class="${state.scope === "computers" ? "active" : ""}">คอมพิวเตอร์</button><button data-scope="monitors" class="${state.scope === "monitors" ? "active" : ""}">จอแยก</button></div><span class="panel-subtitle">${rows.length} รายการ</span></div>${state.attention ? `<div class="filter-note"><span>กรอง: ${state.attention === "old-computers" ? "คอมเข้าเกณฑ์อายุ" : state.attention === "broken-monitors" ? "จอชำรุด" : "ข้อมูลต้องตรวจสอบ"}</span><button class="link-btn" data-action="clear-attention">ล้างเงื่อนไข</button></div>` : ""}${assetTable(rows, state.scope === "monitors")}</section>`
  );
}
function renderDepartments() {
  return (
    pageHead(
      "ครุภัณฑ์รายกลุ่ม / ฝ่าย",
      "ดูจำนวนเครื่อง ผู้รับผิดชอบ และรายการที่ควรติดตามของแต่ละฝ่าย",
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
        return `<section class="panel department-card"><div class="card-title"><span class="stat-icon">${icon("building")}</span><h2>${esc(name)}</h2></div><div class="numbers"><div><strong>${s.pc}</strong><span>PC · เครื่อง</span></div><div><strong>${s.nb}</strong><span>NB · เครื่อง</span></div><div><strong>${s.monitors}</strong><span>จอแยก · จอ</span></div></div><div class="card-bottom"><span>คอมเข้าเกณฑ์ ${s.oldComputers} เครื่อง · จอชำรุด ${s.brokenMonitors} จอ</span><button class="link-btn" data-department="${esc(name)}">เปิดทะเบียน</button></div></section>`;
      })
      .join("")}</div>`
  );
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
    peak = Math.max(...rows.map((r) => r.total));
  return (
    pageHead(
      "แผนตามอายุ 2570–2575",
      "ครบ 6 ปี · แต่ละรายการนับครั้งเดียวในปีที่เริ่มเกิน 5 ปี",
      `<button class="btn" data-action="print">${icon("download")}พิมพ์ / PDF</button>`,
    ) +
    `<div class="callout">${icon("shield")}<div><strong>เข้าเกณฑ์อายุ ≠ ต้องซื้อใหม่</strong>จอยังใช้งานได้ให้คงสถานะปกติ พิจารณาทดแทนเมื่อชำรุดและมีความจำเป็น ตัวเลขนี้ยังไม่หักผลทดแทนที่เจ้าหน้าที่บันทึก</div></div><div class="filter-bar"><select id="department-filter" aria-label="เลือกกลุ่มฝ่ายของแผน">${options(DEPARTMENTS, state.department, "ทุกกลุ่ม / ฝ่าย")}</select><span class="panel-subtitle">ก่อนปี 2570: คอม ${s.oldComputers} เครื่อง / จอ ${s.oldMonitors} จอ เข้าเกณฑ์อายุแล้ว</span></div><section class="panel"><div class="table-wrap"><table class="plan-table"><thead><tr><th>ปีเริ่มเกิน 5 ปี</th><th>ปีครบ 5 ปี</th><th>PC</th><th>NB</th><th>รวมคอม</th><th>จอเข้าเกณฑ์อายุ</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.total === peak && peak ? "peak" : ""}"><td>${r.year}</td><td>${r.completeYear}</td><td>${r.pc}</td><td>${r.nb}</td><td><strong>${r.total}</strong></td><td>${r.monitors}</td></tr>`).join("")}<tr class="plan-totals"><td>รวม 6 ปี</td><td>—</td><td>${sum.pc}</td><td>${sum.nb}</td><td>${sum.total}</td><td>${sum.monitors}</td></tr></tbody></table></div><div class="chart-foot">ปีเริ่มเกิน 5 ปี = ปีซื้อ + 6 · ไม่รวมยอดเข้าเกณฑ์แล้วก่อนปี 2570 · จอนับเฉพาะรหัสที่เข้ารูปแบบ</div></section>`
  );
}
function renderQuality() {
  const rows = filtered().filter((a) => issues(a, state.year).length);
  return (
    pageHead(
      "ตรวจสอบข้อมูล",
      "ตรวจข้อมูลที่ยังไม่ครบก่อนนำไปจัดทำคำขอซื้อ ตัวเลขที่ไม่ทราบจะไม่ถูกเดาแทน",
    ) +
    filters() +
    `<section class="panel"><div class="panel-head"><h2>รายการที่ควรตรวจ ${rows.length} รายการ</h2></div>${
      rows.length
        ? `<div class="table-wrap"><table><thead><tr><th>รายการ / ผู้รับผิดชอบ</th><th>กลุ่ม / ฝ่าย</th><th>จุดที่ควรตรวจ</th><th></th></tr></thead><tbody>${rows
            .map(
              (a) =>
                `<tr><td>${typeBadge(a)} ${esc(a.computerCode)}<small>${esc(a.owner)}</small></td><td>${esc(a.department)}</td><td><div class="issue-list">${issues(
                  a,
                  state.year,
                )
                  .map((t) => badge(t, "warn"))
                  .join(
                    "",
                  )}</div></td><td><button class="btn compact" data-edit="${a.row}">ตรวจรายการ</button></td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty"><h3>ข้อมูลครบตามเงื่อนไขที่ตรวจ</h3></div>'
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
      monitorOutcome: "",
      notes: "",
      reason: "",
    };
  $("asset-title").textContent = existing
    ? `${a.type} · ${a.owner}`
    : "เพิ่มครุภัณฑ์";
  $("asset-kicker").textContent = existing
    ? `ลำดับ ${a.id} / ${sourceLabel()}`
    : "รายการใหม่";
  const departments =
    state.user.department === "*" || !live
      ? DEPARTMENTS
      : [state.user.department];
  $("asset-content").innerHTML =
    `<form id="asset-form"><fieldset ${!canEdit() ? "disabled" : ""} style="border:0;margin:0;padding:0"><div class="form-body"><div class="form-grid" style="margin-bottom:20px">${field("ผู้รับผิดชอบ", "owner", a.owner)}${selectField("กลุ่ม / ฝ่าย", "department", departments, a.department, "เลือกกลุ่ม / ฝ่าย")}</div><div class="form-section"><h3>${icon("laptop")}คอมพิวเตอร์ PC / NB</h3><div class="form-grid">${selectField("ประเภท", "type", ["PC", "NB", "PC (ห้องสมุด)"], a.type, "เลือกประเภท")}${field("เลขครุภัณฑ์คอมพิวเตอร์", "computerCode", a.computerCode)}${field("ปีซื้อคอม (พ.ศ.)", "computerYear", a.computerYear, "number")}${selectField("ผลทดแทนเฉพาะคอม", "computerOutcome", OUTCOMES, a.computerOutcome, "ยังไม่บันทึกผล")}</div><p class="form-hint">อายุคอม ${age(a.computerYear, state.year) ?? "—"} ปี · ไม่เกิน 5 ปี = ปกติ / เกิน 5 ปี = เข้าเกณฑ์อายุพิจารณาทดแทน</p></div><div class="form-section mon"><h3>${icon("monitor")}จอแยก</h3><div class="form-grid">${field("เลขครุภัณฑ์จอ", "monitorCode", a.monitorCode)}${field("ปีซื้อจอ (พ.ศ.)", "monitorYear", a.monitorYear, "number")}${selectField("สถานะการใช้งานจอ", "monitorCondition", CONDITIONS, a.monitorCondition)}${selectField("ผลทดแทนเฉพาะจอ", "monitorOutcome", OUTCOMES, a.monitorOutcome, "ยังไม่บันทึกผล")}</div><p class="form-hint">อายุจอ ${age(a.monitorYear, state.year) ?? "—"} ปี · คำนวณจากปีซื้อจอ แม้ยังไม่มีรหัส · จอที่ยังใช้งานได้ไม่จำเป็นต้องซื้อใหม่เพียงเพราะอายุเกิน 5 ปี</p></div><div class="form-grid"><label class="wide">หมายเหตุ<textarea name="notes" maxlength="3000" placeholder="บันทึกเพิ่มเติมได้ตามต้องการ">${esc(a.notes)}</textarea></label><label class="wide">เหตุผลความจำเป็นในการขอซื้อ<textarea name="reason" maxlength="3000" placeholder="ระบุอุปกรณ์ที่ขอทดแทน สภาพปัญหา และผลต่อการปฏิบัติงาน">${esc(a.reason)}</textarea></label></div><p class="form-error" id="save-error" role="alert"></p></div><div class="form-actions"><small>${live ? "บันทึกลงชีตหลักและอัปเดตชีตแยกฝ่าย" : "ทดลองแก้ไขเฉพาะหน้านี้ · ไม่บันทึกลงชีตจริง"}</small><div class="right"><button type="button" class="btn" data-close="asset-dialog">ปิด</button>${canEdit() ? '<button type="submit" class="btn primary">บันทึกข้อมูล</button>' : ""}</div></div></fieldset></form>`;
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
        await refreshData();
        if (result.warning) {
          $("asset-dialog").close();
          toast(result.warning);
          return;
        }
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
  link.download = `DPTC-${live ? "inventory" : "demo"}-${state.year}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function showSource() {
  $("source-content").innerHTML = live
    ? `<p><strong>แหล่งข้อมูล:</strong> ชีต 2569+จอ</p><p>ข้อมูลรายการมาจากชีตหลัก การแก้ไขบันทึกกลับเฉพาะช่องที่กรอก และแยกผลทดแทนคอมกับจอ</p><p>สถานะจอเป็นสภาพจริง อายุเกิน 5 ปีแสดงเป็นคำเตือนเท่านั้น</p><button class="btn primary" id="open-live-sheet">เปิด Google Sheet</button>`
    : `<p><strong>หน้านี้เป็นเวอร์ชันทดลอง</strong> ใช้ข้อมูลสมมติที่จัดสัดส่วนเหมือนทะเบียน เพื่อทดลองหน้าจอและการคำนวณ</p><p>เมื่อเปิดผ่าน Google Apps Script ที่ติดตั้งแล้ว แอปจะให้เข้าใช้งานและอ่านข้อมูลจากชีตจริงโดยอัตโนมัติ</p><p>ผู้ดูแลติดตั้งไฟล์ในโฟลเดอร์ <code>apps-script</code> ตามคู่มือในโปรเจกต์ DIO</p><a class="btn primary" href="https://github.com/poundpop35-creator/DIO" target="_blank" rel="noopener">เปิดโปรเจกต์ DIO</a>`;
  $("source-dialog").showModal();
}
async function refreshData() {
  if (!live) {
    render();
    toast("รีเฟรชหน้าทดลองแล้ว");
    return;
  }
  state.loading = true;
  render();
  try {
    const data = await rpc("getInventory", state.token);
    state.assets = data.assets;
    state.user = data.user;
    state.year = data.year;
    state.sheetUrl = data.sheetUrl;
    $("sync-label").textContent =
      "อัปเดต " +
      new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
  } catch (error) {
    toast(error.message);
    if (/เข้าใช้งาน|หมดอายุ/.test(error.message)) {
      state.token = "";
      state.assets = [];
      if (!$("login-dialog").open) $("login-dialog").showModal();
    }
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
    state.scope =
      b.dataset.attention === "broken-monitors" ? "monitors" : "computers";
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
  if (b.id === "source-button" || (b.id === "sheet-link" && !live))
    showSource();
  if (
    (b.id === "sheet-link" || b.id === "open-live-sheet") &&
    live &&
    state.sheetUrl
  )
    window.open(state.sheetUrl, "_blank", "noopener");
  if (b.id === "refresh") refreshData().catch(() => {});
  if (b.id === "menu-toggle") {
    const open = $("sidebar").classList.toggle("open");
    b.setAttribute("aria-expanded", String(open));
  }
  if (b.id === "reset-demo") {
    state.assets = makeDemoAssets();
    render();
    toast("เริ่มข้อมูลตัวอย่างใหม่แล้ว");
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
if (live) $("login-dialog").showModal();
