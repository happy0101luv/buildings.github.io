const STORAGE_KEY = "hangar07-collection-v1";
const SCOPED_STORAGE_KEY = `${STORAGE_KEY}:本地镜像`;
const BACKUP_KEY = "hangar07-backups-v1:本地镜像";
const PENDING_SYNC_KEY = "hangar07-pending-sync-v1:本地镜像";
const LIFE_STORAGE_KEY = "wanwu-life-expenses-v1";
const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
const COMPRESSED_IMAGE_MAX_BYTES = 180 * 1024;
const COMPRESSED_IMAGE_MAX_SIDE = 1280;
const ROUTES = ["life", "dashboard", "collection", "catalog", "discover", "profile", "add", "life-add"];
const TITLES = {
  life: "生活记账",
  dashboard: "总览",
  collection: "收藏库",
  catalog: "模型图鉴",
  discover: "发现",
  profile: "我的",
  add: "新增收藏",
  "life-add": "新增支出",
};
const CATEGORIES = ["全部分类", "高达模型", "机娘", "兵人/人偶", "变形金刚", "其他"];
const LIFE_CATEGORIES = ["全部", "衣", "食", "住", "行", "收藏"];

const shell = document.querySelector("#phoneShell");
const content = document.querySelector("#pageContent");
const pageTitle = document.querySelector("#pageTitle");
const headerBack = document.querySelector("#headerBack");
const tabbar = document.querySelector("#tabbar");
const floatingAdd = document.querySelector("#floatingAdd");
const formSaveBar = document.querySelector("#formSaveBar");
const formSaveButton = document.querySelector("#formSaveButton");
const toast = document.querySelector("#toast");
let scrollIndicatorTimer = 0;

const state = {
  route: "dashboard",
  records: [],
  lifeRecords: [],
  lifeCategory: "全部",
  lifeSearch: "",
  lifeYear: new Date().getFullYear(),
  lifePeriod: "year",
  selectedYear: new Date().getFullYear(),
  collectionSearch: "",
  collectionStatus: "全部",
  collectionCategory: "全部分类",
  collectionView: "list",
  catalog: [],
  catalogSearch: "",
  news: [],
  newsSearch: "",
  editingId: "",
  editingExpenseId: "",
  addReturnRoute: "collection",
  prefill: null,
  uploadImage: "",
  lifeUploadImage: "",
  profile: { username: "本地镜像", authenticated: true },
};

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function loadRecords() {
  const scoped = safeParse(localStorage.getItem(SCOPED_STORAGE_KEY), null);
  const plain = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (Array.isArray(scoped) && (scoped.length || !Array.isArray(plain))) return scoped;
  return Array.isArray(plain) ? plain : Array.isArray(scoped) ? scoped : [];
}

function loadLifeRecords() {
  const value = safeParse(localStorage.getItem(LIFE_STORAGE_KEY), []);
  return Array.isArray(value) ? value : [];
}

function saveLifeRecords() {
  try {
    localStorage.setItem(LIFE_STORAGE_KEY, JSON.stringify(state.lifeRecords));
    return true;
  } catch {
    showToast("本机存储空间不足，请删除部分图片后重试");
    return false;
  }
}

function saveRecords(reason = "资料更新") {
  const payload = JSON.stringify(state.records);
  try {
    localStorage.setItem(SCOPED_STORAGE_KEY, payload);
    const backups = safeParse(localStorage.getItem(BACKUP_KEY), []);
    const imageLightRecords = state.records.map((record) => ({
      ...record,
      imageUrl: String(record.imageUrl || "").startsWith("data:") ? "" : record.imageUrl || "",
    }));
    backups.unshift({ createdAt: new Date().toISOString(), reason, payload: JSON.stringify(imageLightRecords) });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 10)));
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ records: state.records, reason, savedAt: new Date().toISOString() }));
    return true;
  } catch (error) {
    showToast("本机存储空间不足，请删除部分图片后重试");
    return false;
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "未填写日期";
  return String(value).replaceAll("-", ".");
}

function quantity(record) {
  const value = Math.floor(Number(record.quantity || 1));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function recordPrice(record) {
  const value = Number(record.price ?? record.totalPrice ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function paidAmount(record) {
  const paid = Number(record.paid);
  if (Number.isFinite(paid)) return paid;
  return record.status === "已入库" ? recordPrice(record) : 0;
}

function dueAmount(record) {
  return record.status === "预定中" ? Math.max(0, recordPrice(record) - paidAmount(record)) : 0;
}

function yearOf(record) {
  return Number(String(record.date || record.createdAt || "").slice(0, 4)) || state.selectedYear;
}

function normalizeAssetUrl(url = "") {
  const value = String(url);
  if (value.startsWith("./assets/")) return `../${value.slice(2)}`;
  if (value.startsWith("/assets/")) return `../${value.slice(1)}`;
  return value;
}

function getRecordImage(record) {
  return normalizeAssetUrl(record.imageUrl || record.catalogCoverImage || "");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function currentRoute() {
  const route = location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROUTES.includes(route) ? route : "dashboard";
}

function navigate(route, options = {}) {
  if (!ROUTES.includes(route)) return;
  if (route === "add") {
    state.addReturnRoute = state.route === "add" ? state.addReturnRoute : state.route;
    state.editingId = options.editingId || "";
    state.prefill = options.prefill || null;
    state.uploadImage = options.imageUrl || "";
  }
  if (route === "life-add") {
    state.addReturnRoute = state.route === "life-add" ? state.addReturnRoute : state.route;
    state.editingExpenseId = options.editingExpenseId || "";
    state.lifeUploadImage = options.imageUrl || "";
  }
  const nextHash = `#/${route}`;
  if (location.hash === nextHash) render();
  else location.hash = nextHash;
}

function recordCard(record) {
  const image = getRecordImage(record);
  const price = recordPrice(record);
  return `
    <article class="record-card" data-record-id="${escapeHtml(record.id)}" tabindex="0" role="button" aria-label="编辑 ${escapeHtml(record.name)}">
      <div class="record-image">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(record.name)}" loading="lazy" />` : `<i data-lucide="package-open"></i>`}
      </div>
      <div class="record-main">
        <h3>${escapeHtml(record.name || "未命名收藏")}</h3>
        <p>${escapeHtml([record.category, record.series].filter(Boolean).join(" · ") || "未填写分类")}</p>
        <time>${record.status === "预定中" ? "预定于" : "入库于"} ${escapeHtml(formatDate(record.date))}</time>
      </div>
      <div class="record-side">
        <span class="status-badge${record.status === "预定中" ? " preorder" : ""}">${escapeHtml(record.status || "已入库")}</span>
        <strong>¥${formatMoney(price)}</strong>
      </div>
    </article>`;
}

function allLifeExpenses() {
  const manual = state.lifeRecords.map((item) => ({ ...item, sourceType: "life" }));
  const collections = state.records
    .filter((record) => paidAmount(record) > 0)
    .map((record) => ({
      id: `collection-${record.id}`,
      sourceId: record.id,
      sourceType: "collection",
      name: record.name || "收藏支出",
      category: "收藏",
      amount: paidAmount(record),
      date: record.date || record.createdAt || todayValue(),
      note: [record.category, record.series].filter(Boolean).join(" · "),
      imageUrl: record.imageUrl || record.catalogCoverImage || "",
    }));
  return [...manual, ...collections].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function expenseCard(expense) {
  const image = normalizeAssetUrl(expense.imageUrl || "");
  const icon = { "衣": "shirt", "食": "utensils", "住": "house", "行": "car-front", "收藏": "package" }[expense.category] || "receipt-text";
  return `<article class="expense-card" data-expense-id="${escapeHtml(expense.id)}" data-expense-source="${escapeHtml(expense.sourceType || "life")}" tabindex="0" role="button" aria-label="查看 ${escapeHtml(expense.name)}">
    <div class="expense-icon ${expense.category === "收藏" ? "collection" : ""}">${image ? `<img src="${escapeHtml(image)}" alt="" />` : `<i data-lucide="${icon}"></i>`}</div>
    <div class="expense-main"><h3>${escapeHtml(expense.name || "生活支出")}</h3><p>${escapeHtml(expense.category || "其他")} · ${escapeHtml(expense.note || (expense.sourceType === "collection" ? "由收藏记录自动同步" : "生活记账"))}</p><time>${escapeHtml(formatDate(expense.date))}</time></div>
    <div class="expense-amount"><strong>-¥${formatMoney(expense.amount)}</strong>${expense.sourceType === "collection" ? `<span>收藏同步</span>` : `<span>${escapeHtml(expense.category)}</span>`}</div>
  </article>`;
}

function lifeView() {
  const expenses = allLifeExpenses();
  const years = [...new Set([new Date().getFullYear(), ...expenses.map((item) => Number(String(item.date || "").slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a);
  const yearExpenses = expenses.filter((item) => Number(String(item.date || "").slice(0, 4)) === state.lifeYear);
  const selectedMonth = new Date().getMonth() + 1;
  const monthExpenses = yearExpenses.filter((item) => Number(String(item.date || "").slice(5, 7)) === selectedMonth);
  const periodExpenses = state.lifePeriod === "month" ? monthExpenses : yearExpenses;
  const search = state.lifeSearch.trim().toLowerCase();
  const filtered = periodExpenses.filter((item) => {
    const matchesCategory = state.lifeCategory === "全部" || item.category === state.lifeCategory;
    const matchesSearch = !search || `${item.name || ""} ${item.note || ""} ${item.category || ""}`.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });
  const total = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const yearTotal = yearExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const collectionItems = periodExpenses.filter((item) => item.category === "收藏");
  return `<section class="page">
    <div class="life-topbar"><div class="archive-intro life-intro"><p class="eyebrow">DAILY LEDGER</p><h2>生活记账 <small>${periodExpenses.length} 笔</small></h2></div><select class="year-select" id="lifeYearSelect" aria-label="选择生活账本年份">${years.map((year) => `<option value="${year}" ${year === state.lifeYear ? "selected" : ""}>${year} 年</option>`).join("")}</select></div>
    <div class="investment-card life-investment">
      <p class="eyebrow">LIFE EXPENDITURE</p><div class="annual-toggle life-period"><button type="button" data-life-period="year" class="${state.lifePeriod === "year" ? "active" : ""}">全年</button><button type="button" data-life-period="month" class="${state.lifePeriod === "month" ? "active" : ""}">本月</button></div>
      <h3 class="life-card-title">${state.lifeYear} 年${state.lifePeriod === "month" ? `${String(selectedMonth).padStart(2, "0")}月` : ""}生活支出</h3>
      <div class="big-money"><b>¥</b>${formatMoney(total)}</div>
      <p>${periodExpenses.length} 笔支出&nbsp; · &nbsp;收藏同步 ${collectionItems.length} 笔</p>
      <div class="investment-split"><div>本月支出<strong>¥${formatMoney(monthTotal)}</strong></div><div>全年支出<strong>¥${formatMoney(yearTotal)}</strong></div></div>
    </div>
    <label class="search-box"><i data-lucide="search"></i><input id="lifeSearch" value="${escapeHtml(state.lifeSearch)}" placeholder="搜索支出名称 / 分类 / 备注" /></label>
    <div class="segment life-segment" id="lifeSegment">${LIFE_CATEGORIES.map((category) => `<button type="button" data-life-category="${category}" class="${state.lifeCategory === category ? "active" : ""}">${category}</button>`).join("")}</div>
    <div class="list-meta"><span>当前显示 ${filtered.length} 笔</span><span>${state.lifeCategory === "全部" ? "全部生活支出" : `${state.lifeCategory}类支出`}</span></div>
    ${filtered.length ? `<div class="expense-list">${filtered.map(expenseCard).join("")}</div>` : `<div class="empty-state"><p>还没有${state.lifeCategory === "全部" ? "生活支出" : `${state.lifeCategory}类支出`}<br /><small>点击右下角＋记录第一笔</small></p></div>`}
  </section>`;
}

function brandRow() {
  const years = [...new Set([new Date().getFullYear(), ...state.records.map(yearOf)])].sort((a, b) => b - a);
  return `
    <div class="brand-row">
      <img class="brand-logo" src="../assets/brand/wanwu_full_logo_light.png" alt="玩物不丧志" />
      <div class="brand-actions">
        <select class="year-select" id="yearSelect" aria-label="选择年份">
          ${years.map((year) => `<option value="${year}" ${year === state.selectedYear ? "selected" : ""}>${year} 年</option>`).join("")}
        </select>
        <button class="notice-btn" type="button" aria-label="通知"><i data-lucide="bell"></i><span class="notice-dot"></span></button>
      </div>
    </div>`;
}

function dashboardView() {
  const allRecords = state.records;
  if (!allRecords.length) {
    return `<section class="page">
      ${brandRow()}
      <div class="onboarding">
        <p class="eyebrow">FIRST COLLECTION</p>
        <span class="onboarding-count">0 / 1</span>
        <h2>建立第一份收藏</h2>
        <div class="onboarding-progress"></div>
        <div class="onboarding-actions">
          <button class="primary" type="button" data-go="catalog">从图鉴添加</button>
          <button type="button" data-go="add">直接录入</button>
        </div>
        <div class="ready-row"><b>账号已就绪</b><span>下一步 · 添加收藏</span></div>
      </div>
    </section>`;
  }

  const records = allRecords.filter((record) => yearOf(record) === state.selectedYear);
  const totalPaid = records.reduce((sum, record) => sum + paidAmount(record), 0);
  const count = records.reduce((sum, record) => sum + quantity(record), 0);
  const preorders = records.filter((record) => record.status === "预定中");
  const paymentPending = preorders.filter((record) => record.preorderStage !== "arrival" && dueAmount(record) > 0);
  const arrivalPending = preorders.filter((record) => record.preorderStage === "arrival" || dueAmount(record) <= 0);
  const due = preorders.reduce((sum, record) => sum + dueAmount(record), 0);
  const months = Array.from({ length: 12 }, (_, index) => {
    const items = records.filter((record) => Number(String(record.date || "").slice(5, 7)) === index + 1);
    return items.reduce((sum, record) => sum + paidAmount(record), 0);
  });
  const maxMonth = Math.max(...months, 1);
  const currentMonth = new Date().getFullYear() === state.selectedYear ? new Date().getMonth() + 1 : 12;
  const recent = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 3);
  const recentImage = recent.map(getRecordImage).find(Boolean);
  return `<section class="page">
    ${brandRow()}
    <div class="annual-card">
      <p class="eyebrow">ANNUAL ACQUISITION REPORT</p>
      <div class="annual-toggle"><button class="active" type="button">全年</button><button type="button">本月</button></div>
      <h3>${state.selectedYear} 年收藏投入</h3>
      <p class="annual-amount"><small>¥</small><strong>${formatMoney(totalPaid)}</strong></p>
      <p class="annual-meta">新增 ${count} 件&nbsp; · &nbsp;当前 ${preorders.length} 项待办</p>
      ${recentImage ? `<div class="annual-thumb"><img src="${escapeHtml(recentImage)}" alt="最近收藏" /><span>最近收藏</span></div>` : ""}
    </div>
    <div class="stat-grid">
      <div class="stat-card"><p>本年新增</p><strong>${count}</strong> 件<small>${count - preorders.length} 已入库 · ${preorders.length} 预定</small></div>
      <div class="stat-card"><p>当前待补款</p><strong>${paymentPending.length}</strong> 件<small>¥${formatMoney(due)} 待支付</small></div>
      <div class="stat-card"><p>当前待到货</p><strong>${arrivalPending.length}</strong> 件<small>查看到货进度</small></div>
    </div>
    <div class="trend-card">
      <div class="trend-title"><h2>月度投入趋势</h2><strong>${String(currentMonth).padStart(2, "0")} 月</strong></div>
      <p class="trend-sub">点击月份查看明细</p>
      <div class="trend-totals"><div class="trend-total">已支付<strong>¥${formatMoney(months[currentMonth - 1] || 0)}</strong></div><div class="trend-total">预计补款<strong>¥${formatMoney(due)}</strong></div></div>
      <div class="bars">${months.map((value, index) => `<div class="bar-month ${index + 1 === currentMonth ? "current" : ""}"><span class="bar-fill" style="height:${Math.max(2, Math.round(value / maxMonth * 69))}px"></span><span class="bar-due"></span><b>${String(index + 1).padStart(2, "0")}</b></div>`).join("")}</div>
      <div class="chart-legend"><span>已支付</span><span>预计补款</span></div>
    </div>
    <div class="section-heading"><h2>最近收藏</h2><button class="text-action" type="button" data-go="collection">查看收藏库 ›</button></div>
    <div class="recent-list">${recent.map(recordCard).join("")}</div>
  </section>`;
}

function collectionView() {
  const totalCount = state.records.reduce((sum, record) => sum + quantity(record), 0);
  const totalPaid = state.records.reduce((sum, record) => sum + paidAmount(record), 0);
  const totalDue = state.records.reduce((sum, record) => sum + dueAmount(record), 0);
  const preorders = state.records.filter((record) => record.status === "预定中");
  const paymentPending = preorders.filter((record) => record.preorderStage !== "arrival" && dueAmount(record) > 0);
  const arrivalPending = preorders.filter((record) => record.preorderStage === "arrival" || dueAmount(record) <= 0);
  const search = state.collectionSearch.trim().toLowerCase();
  const filtered = state.records.filter((record) => {
    const matchesSearch = !search || `${record.name || ""} ${record.series || ""} ${record.category || ""} ${record.note || ""}`.toLowerCase().includes(search);
    const matchesStatus = state.collectionStatus === "全部"
      || (state.collectionStatus === "已入库" && record.status === "已入库")
      || (state.collectionStatus === "待补款" && record.status === "预定中" && record.preorderStage !== "arrival" && dueAmount(record) > 0)
      || (state.collectionStatus === "待到货" && record.status === "预定中" && (record.preorderStage === "arrival" || dueAmount(record) <= 0));
    const matchesCategory = state.collectionCategory === "全部分类" || record.category === state.collectionCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return `<section class="page">
    <div class="archive-intro"><p class="eyebrow">COLLECTION ARCHIVE</p><h2>我的收藏 <small>${totalCount} 件</small></h2></div>
    <div class="investment-card">
      <p class="eyebrow">COLLECTION INVESTMENT</p><span class="investment-pill">全部收藏投入</span>
      <div class="big-money"><b>¥</b>${formatMoney(totalPaid)}</div>
      <p>${totalCount} 件藏品&nbsp; · &nbsp;${paymentPending.length} 待补款&nbsp; · &nbsp;${arrivalPending.length} 待到货</p>
      <div class="investment-split"><div>已付金额<strong>¥${formatMoney(totalPaid)}</strong></div><div>待补款<strong>¥${formatMoney(totalDue)}</strong></div></div>
    </div>
    <label class="search-box collection-search"><i data-lucide="search"></i><input id="collectionSearch" value="${escapeHtml(state.collectionSearch)}" placeholder="搜索藏品 / 厂牌 / 分类 / 备注" /></label>
    <div class="segment" id="statusSegment">
      ${["全部", "已入库", "待补款", "待到货"].map((item) => `<button type="button" data-status="${item}" class="${state.collectionStatus === item || (item === "已入库" && state.collectionStatus === "已入库") ? "active" : ""}">${item}</button>`).join("")}
    </div>
    <div class="filter-row"><span class="filter-label">分类</span>${CATEGORIES.map((category) => `<button class="chip ${state.collectionCategory === category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}<button class="chip" id="manageCategories" type="button">管理</button></div>
    <div class="list-meta"><span>当前显示 ${filtered.length} 件</span><div class="view-switch"><button type="button" data-list-view="list" class="${state.collectionView === "list" ? "active" : ""}">清单</button><button type="button" data-list-view="grid" class="${state.collectionView === "grid" ? "active" : ""}">展柜</button></div></div>
    ${filtered.length ? `<div class="record-list ${state.collectionView}">${filtered.map(recordCard).join("")}</div>` : `<div class="empty-state"><p>没有匹配的藏品</p></div>`}
  </section>`;
}

function catalogView() {
  const search = state.catalogSearch.trim().toLowerCase();
  const items = state.catalog.filter((item) => !search || `${item.name || ""} ${item.brand || ""} ${item.series || ""} ${item.ip || ""} ${item.modelNumber || ""}`.toLowerCase().includes(search)).slice(0, 30);
  return `<section class="page">
    <div class="catalog-hero"><p class="eyebrow">MODEL CATALOG</p><h2>模型图鉴</h2><p>按名称、编号、厂牌和玩家常用叫法查找模型资料。</p></div>
    <div class="catalog-stats"><div><strong>${state.catalog.length ? "3.5万+" : "—"}</strong>图鉴条目</div><div><strong>${state.records.length}</strong>我的收藏</div><div><strong>${new Set(state.records.map((item) => item.category)).size}</strong>收藏分类</div></div>
    <label class="search-box"><i data-lucide="search"></i><input id="catalogSearch" value="${escapeHtml(state.catalogSearch)}" placeholder="搜索名称 / 编号 / 厂牌 / IP" /></label>
    ${state.catalog.length ? `<div class="catalog-grid">${items.map((item) => `
      <article class="catalog-card">
        <div class="catalog-cover">${item.coverImage ? `<img src="${escapeHtml(normalizeAssetUrl(item.coverImage))}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ""}</div>
        <div class="catalog-info"><span class="catalog-tag">${escapeHtml(item.ip || item.displayCategory || "模型")}</span><h3>${escapeHtml(item.name || "未命名图鉴")}</h3><p>${escapeHtml([item.brand, item.series, item.modelNumber].filter(Boolean).join(" · "))}</p><button type="button" data-catalog-add="${escapeHtml(item.id)}">加入收藏</button></div>
      </article>`).join("")}</div>` : `<div class="empty-state"><p>正在读取图鉴资料…</p></div>`}
  </section>`;
}

function discoverView() {
  const search = state.newsSearch.trim().toLowerCase();
  const items = state.news.filter((item) => !search || `${item.title || ""} ${item.sourceName || ""} ${item.summary || ""}`.toLowerCase().includes(search)).slice(0, 20);
  return `<section class="page">
    <div class="discover-hero"><p class="eyebrow">TOY INTELLIGENCE</p><h2>玩具情报中心</h2><p>整理模型新品、预定和补款动态，帮你把零散消息变成可查的收藏资料。</p></div>
    <label class="search-box"><i data-lucide="search"></i><input id="newsSearch" value="${escapeHtml(state.newsSearch)}" placeholder="搜索资讯标题 / 来源" /></label>
    ${items.length ? `<div class="news-list">${items.map((item) => {
      const image = normalizeAssetUrl((item.imageUrls || [])[0] || item.imageUrl || "");
      return `<article class="news-card"><div class="news-cover">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}<span class="news-badge">${item.category === "payment" ? "补款" : item.category === "new" ? "新品" : "预定"}</span></div><div class="news-body"><h3>${escapeHtml(item.title || "玩具情报")}</h3><p>${escapeHtml(item.summary || item.body || "")}</p><div class="news-meta"><span>${escapeHtml(item.sourceName || "玩物不丧志")}</span><time>${escapeHtml(String(item.publishedAt || item.createdAt || "").slice(0, 10))}</time></div></div></article>`;
    }).join("")}</div>` : `<div class="empty-state"><p>${state.news.length ? "没有匹配的资讯" : "正在读取玩具情报…"}</p></div>`}
  </section>`;
}

function profileView() {
  const count = state.records.reduce((sum, record) => sum + quantity(record), 0);
  const yearCount = state.records.filter((record) => yearOf(record) === new Date().getFullYear()).reduce((sum, record) => sum + quantity(record), 0);
  const preorders = state.records.filter((record) => record.status === "预定中").length;
  const categoryCounts = state.records.reduce((map, record) => map.set(record.category || "其他", (map.get(record.category || "其他") || 0) + quantity(record)), new Map());
  const favorite = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "等待第一件收藏";
  const username = state.profile.username || "本地镜像";
  return `<section class="page">
    <div class="profile-head"><div class="avatar">${escapeHtml(username.slice(0, 1))}</div><div class="profile-name"><h2>${escapeHtml(username)} <span class="login-badge">已登录</span></h2><p>收藏数据已保存在当前设备</p></div><button class="avatar-action" type="button">更换头像 ›</button></div>
    <p class="profile-section-title">收藏画像</p>
    <div class="collection-portrait"><p class="eyebrow">MY COLLECTION</p><h3>${escapeHtml(count ? `${favorite}收藏者` : "等待第一件收藏")}</h3><p>${count ? `最常收藏 ${favorite}` : "从第一件藏品开始生成收藏画像"}</p><div class="portrait-stats"><div><strong>${count}</strong><span>件收藏</span></div><div><strong>${yearCount}</strong><span>今年新增</span></div><div><strong>${preorders}</strong><span>仍在预定</span></div></div><div class="portrait-link" data-go="collection" role="button" tabindex="0">打开收藏库 <b>›</b></div></div>
    <p class="profile-section-title">购买计划</p>
    <div class="wish-card"><div class="wish-card-top"><p class="eyebrow">WISH BOARD</p><h3>愿望清单</h3><p>收好每一个想入手的玩具</p></div><div class="wish-card-foot"><span>0 件愿望</span><b>查看愿望画板 ›</b></div></div>
    <p class="profile-section-title">参与共建</p>
    <div class="project-card"><p class="eyebrow">PROJECT COMPLETION</p><h3>补完计划</h3><p>提建议、看共识、跟进采纳进度</p><b>进入 ›</b></div>
    <p class="profile-section-title">账户与安全</p>
    <div class="account-card"><div><h3>本地资料库</h3><p>支持 JSON 备份与恢复</p></div><a href="../">退出到首页 ›</a></div>
  </section>`;
}

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addView() {
  const existing = state.records.find((record) => String(record.id) === String(state.editingId));
  const source = existing || state.prefill || {};
  if (!state.uploadImage) state.uploadImage = source.imageUrl || source.catalogCoverImage || "";
  const category = source.category || "高达模型";
  const status = source.status || "已入库";
  const image = normalizeAssetUrl(state.uploadImage);
  return `<form class="page form-page" id="collectionForm">
    <section class="form-section">
      <p class="eyebrow">CATALOG LINK</p><h2 class="form-title">关联图鉴 <small>可选</small></h2>
      <div class="catalog-link-row"><input id="catalogLinkQuery" type="search" placeholder="搜索图鉴名称、型号或系列" value="${escapeHtml(source.catalogName || "")}" /><button id="catalogLinkSearch" type="button">搜索</button></div>
      <div class="catalog-suggestions" id="catalogSuggestions"></div>
    </section>
    <section class="form-section">
      <p class="eyebrow">COLLECTION DETAILS</p><h2 class="form-title">藏品资料</h2>
      <label class="field"><span>藏品名称<b>*</b></span><input name="name" required maxlength="80" value="${escapeHtml(source.name || "")}" placeholder="例如：MGEX 强袭自由高达" /></label>
      <label class="field"><span>收藏分类 <small>可自定义</small></span><input name="category" value="${escapeHtml(category)}" maxlength="30" placeholder="填写分类名称" /></label>
      <div class="quick-categories">${CATEGORIES.slice(1).map((item) => `<button type="button" data-quick-category="${escapeHtml(item)}" class="${item === category ? "active" : ""}">${escapeHtml(item)}</button>`).join("")}</div>
      <label class="field"><span>厂牌 / 系列<b>*</b></span><input name="series" required maxlength="80" value="${escapeHtml(source.series || "")}" placeholder="例如：BANDAI / MGEX" /></label>
    </section>
    <section class="form-section">
      <p class="eyebrow">PURCHASE STATUS</p><h2 class="form-title">购买状态</h2>
      <label class="field"><span>收藏状态</span><input type="hidden" name="status" value="${escapeHtml(status)}" /><div class="status-segment"><button type="button" data-form-status="已入库" class="${status === "已入库" ? "active" : ""}">已入库</button><button type="button" data-form-status="预定中" class="${status === "预定中" ? "active" : ""}">预定中</button></div></label>
      <div class="form-two"><label class="field"><span>数量</span><input name="quantity" type="number" min="1" step="1" value="${quantity(source)}" /></label><label class="field"><span>总价（人民币）</span><input name="price" type="number" min="0" step="0.01" value="${recordPrice(source) || ""}" placeholder="0" /></label></div>
      <label class="field"><span>购买 / 预定日期</span><input name="date" type="date" value="${escapeHtml(source.date || todayValue())}" /></label>
    </section>
    <section class="form-section"><p class="eyebrow">PRIVATE NOTE</p><h2 class="form-title">收藏备注 <small>可选</small></h2><label class="field"><textarea name="note" maxlength="800" placeholder="缺件、存放位置、版本状态…">${escapeHtml(source.note || "")}</textarea></label></section>
    <section class="form-section"><p class="eyebrow">PRODUCT IMAGE</p><h2 class="form-title">产品图片 <small>可选</small></h2>
      <div class="image-uploader"><div class="image-preview" id="imagePreview">${image ? `<img src="${escapeHtml(image)}" alt="产品图预览" />` : `<b>＋</b><span>产品图</span>`}</div><div class="image-actions"><button id="chooseImage" type="button">上传图片</button><button id="autoImage" class="alt" type="button">自动找图</button></div></div>
      <input id="imageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden /><p class="upload-note" id="uploadNote">原图不超过 1MB，上传时自动压缩为 WebP。</p>
    </section>
    ${existing ? `<button class="delete-record" id="deleteRecord" type="button">删除这条收藏</button>` : ""}
  </form>`;
}

function lifeAddView() {
  const existing = state.lifeRecords.find((record) => String(record.id) === String(state.editingExpenseId));
  const source = existing || {};
  if (!state.lifeUploadImage) state.lifeUploadImage = source.imageUrl || "";
  const category = source.category || "食";
  const image = normalizeAssetUrl(state.lifeUploadImage);
  return `<form class="page form-page" id="lifeExpenseForm">
    <section class="form-section">
      <p class="eyebrow">LIFE EXPENSE</p><h2 class="form-title">生活支出</h2>
      <label class="field"><span>支出名称<b>*</b></span><input name="name" required maxlength="80" value="${escapeHtml(source.name || "")}" placeholder="例如：午餐、房租、地铁" /></label>
      <label class="field"><span>支出分类<b>*</b></span><input type="hidden" name="category" value="${escapeHtml(category)}" /></label>
      <div class="quick-categories life-category-picks">${LIFE_CATEGORIES.slice(1).map((item) => `<button type="button" data-life-pick="${item}" class="${item === category ? "active" : ""}">${item}</button>`).join("")}</div>
      <div class="form-two"><label class="field"><span>金额（人民币）<b>*</b></span><input name="amount" type="number" min="0.01" step="0.01" required value="${Number(source.amount || 0) || ""}" placeholder="0" /></label><label class="field"><span>支出日期</span><input name="date" type="date" value="${escapeHtml(source.date || todayValue())}" /></label></div>
    </section>
    <section class="form-section"><p class="eyebrow">EXPENSE NOTE</p><h2 class="form-title">支出备注 <small>可选</small></h2><label class="field"><textarea name="note" maxlength="800" placeholder="用途、付款方式、同行人…">${escapeHtml(source.note || "")}</textarea></label></section>
    <section class="form-section"><p class="eyebrow">RECEIPT IMAGE</p><h2 class="form-title">支出图片 <small>可选</small></h2>
      <div class="image-uploader"><div class="image-preview" id="lifeImagePreview">${image ? `<img src="${escapeHtml(image)}" alt="支出图片预览" />` : `<b>＋</b><span>支出图</span>`}</div><div class="image-actions"><button id="chooseLifeImage" type="button">上传图片</button><button id="clearLifeImage" class="alt" type="button">移除图片</button></div></div>
      <input id="lifeImageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden /><p class="upload-note" id="lifeUploadNote">原图不超过 1MB，上传时自动压缩为 WebP。</p>
    </section>
    ${existing ? `<button class="delete-record" id="deleteExpense" type="button">删除这笔支出</button>` : ""}
  </form>`;
}

function render() {
  state.route = currentRoute();
  pageTitle.textContent = TITLES[state.route];
  const formMode = state.route === "add" || state.route === "life-add";
  shell.classList.toggle("form-mode", formMode);
  headerBack.hidden = !formMode;
  formSaveBar.hidden = !formMode;
  if (formMode) {
    const lifeMode = state.route === "life-add";
    formSaveButton.textContent = lifeMode ? (state.editingExpenseId ? "保存修改" : "保存支出") : (state.editingId ? "保存修改" : "保存收藏");
    formSaveButton.setAttribute("form", lifeMode ? "lifeExpenseForm" : "collectionForm");
  }
  floatingAdd.hidden = !["life", "dashboard", "collection"].includes(state.route);
  tabbar.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.route === state.route));
  const views = { life: lifeView, dashboard: dashboardView, collection: collectionView, catalog: catalogView, discover: discoverView, profile: profileView, add: addView, "life-add": lifeAddView };
  content.innerHTML = views[state.route]();
  content.scrollTop = 0;
  bindViewEvents();
  window.lucide?.createIcons?.();
}

function bindRecordCards() {
  content.querySelectorAll("[data-record-id]").forEach((card) => {
    const open = () => navigate("add", { editingId: card.dataset.recordId });
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
  });
}

function bindCommonButtons() {
  content.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  content.querySelector("#yearSelect")?.addEventListener("change", (event) => { state.selectedYear = Number(event.target.value); render(); });
  bindRecordCards();
}

function bindCollectionEvents() {
  const search = content.querySelector("#collectionSearch");
  search?.addEventListener("input", (event) => {
    state.collectionSearch = event.target.value;
    clearTimeout(bindCollectionEvents.searchTimer);
    bindCollectionEvents.searchTimer = setTimeout(render, 160);
  });
  content.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    state.collectionStatus = button.dataset.status;
    render();
  }));
  content.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { state.collectionCategory = button.dataset.category; render(); }));
  content.querySelectorAll("[data-list-view]").forEach((button) => button.addEventListener("click", () => { state.collectionView = button.dataset.listView; render(); }));
  content.querySelector("#manageCategories")?.addEventListener("click", () => showToast("分类会根据收藏记录自动整理"));
}

function bindLifeEvents() {
  content.querySelector("#lifeYearSelect")?.addEventListener("change", (event) => {
    state.lifeYear = Number(event.target.value);
    render();
  });
  content.querySelectorAll("[data-life-period]").forEach((button) => button.addEventListener("click", () => {
    state.lifePeriod = button.dataset.lifePeriod;
    render();
  }));
  const search = content.querySelector("#lifeSearch");
  search?.addEventListener("input", (event) => {
    state.lifeSearch = event.target.value;
    clearTimeout(bindLifeEvents.searchTimer);
    bindLifeEvents.searchTimer = setTimeout(render, 160);
  });
  content.querySelectorAll("[data-life-category]").forEach((button) => button.addEventListener("click", () => {
    state.lifeCategory = button.dataset.lifeCategory;
    render();
  }));
  content.querySelectorAll("[data-expense-id]").forEach((card) => {
    const open = () => {
      if (card.dataset.expenseSource === "collection") {
        navigate("add", { editingId: card.dataset.expenseId.replace(/^collection-/, "") });
      } else {
        navigate("life-add", { editingExpenseId: card.dataset.expenseId });
      }
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
  });
}

function bindCatalogEvents() {
  const search = content.querySelector("#catalogSearch");
  search?.addEventListener("input", (event) => {
    state.catalogSearch = event.target.value;
    clearTimeout(bindCatalogEvents.searchTimer);
    bindCatalogEvents.searchTimer = setTimeout(render, 160);
  });
  content.querySelectorAll("[data-catalog-add]").forEach((button) => button.addEventListener("click", () => {
    const item = state.catalog.find((entry) => String(entry.id) === button.dataset.catalogAdd);
    if (!item) return;
    navigate("add", { prefill: {
      name: item.name,
      category: /兵人|人偶/.test(item.displayCategory || item.category || "") ? "兵人/人偶" : "高达模型",
      series: [item.brand, item.series, item.modelNumber].filter(Boolean).join(" / "),
      price: Number(item.priceRmb || item.price || 0),
      catalogId: item.id,
      catalogName: item.name,
      catalogCoverImage: item.coverImage,
      imageUrl: item.coverImage,
    }, imageUrl: item.coverImage });
  }));
}

function bindDiscoverEvents() {
  const search = content.querySelector("#newsSearch");
  search?.addEventListener("input", (event) => {
    state.newsSearch = event.target.value;
    clearTimeout(bindDiscoverEvents.searchTimer);
    bindDiscoverEvents.searchTimer = setTimeout(render, 160);
  });
}

function formatFileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function dataUrlByteSize(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

function resizeImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片格式无效"));
      image.onload = () => {
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        if (Math.max(width, height) > maxSide) {
          const ratio = maxSide / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d", { alpha: true }).drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const attempts = [[COMPRESSED_IMAGE_MAX_SIDE, .82], [1100, .74], [900, .66], [720, .58], [600, .5]];
  let output = "";
  for (const [side, quality] of attempts) {
    output = await resizeImage(file, side, quality);
    if (dataUrlByteSize(output) <= COMPRESSED_IMAGE_MAX_BYTES) return output;
  }
  throw new Error("图片压缩后仍然过大，请换一张图片");
}

function updateFormImage(url, message = "") {
  state.uploadImage = url;
  const preview = content.querySelector("#imagePreview");
  if (preview) preview.innerHTML = url ? `<img src="${escapeHtml(normalizeAssetUrl(url))}" alt="产品图预览" />` : `<b>＋</b><span>产品图</span>`;
  const note = content.querySelector("#uploadNote");
  if (note && message) note.textContent = message;
}

function updateLifeFormImage(url, message = "") {
  state.lifeUploadImage = url;
  const preview = content.querySelector("#lifeImagePreview");
  if (preview) preview.innerHTML = url ? `<img src="${escapeHtml(normalizeAssetUrl(url))}" alt="支出图片预览" />` : `<b>＋</b><span>支出图</span>`;
  const note = content.querySelector("#lifeUploadNote");
  if (note && message) note.textContent = message;
}

function catalogMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return state.catalog.filter((item) => `${item.name || ""} ${item.modelNumber || ""} ${item.brand || ""} ${item.series || ""}`.toLowerCase().includes(normalized)).slice(0, 4);
}

function renderCatalogSuggestions(query) {
  const target = content.querySelector("#catalogSuggestions");
  if (!target) return;
  const matches = catalogMatches(query);
  target.innerHTML = matches.map((item) => `<button class="catalog-suggestion" type="button" data-link-catalog="${escapeHtml(item.id)}">${item.coverImage ? `<img src="${escapeHtml(normalizeAssetUrl(item.coverImage))}" alt="" />` : ""}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml([item.brand, item.series, item.modelNumber].filter(Boolean).join(" · "))}</small></span></button>`).join("") || `<small class="muted">没有找到匹配图鉴，可继续手动填写。</small>`;
  target.querySelectorAll("[data-link-catalog]").forEach((button) => button.addEventListener("click", () => {
    const item = state.catalog.find((entry) => String(entry.id) === button.dataset.linkCatalog);
    if (!item) return;
    const form = content.querySelector("#collectionForm");
    form.elements.name.value = item.name || "";
    form.elements.series.value = [item.brand, item.series, item.modelNumber].filter(Boolean).join(" / ");
    if (Number(item.priceRmb || item.price)) form.elements.price.value = Number(item.priceRmb || item.price);
    form.dataset.catalogId = item.id || "";
    updateFormImage(item.coverImage || "", "已关联图鉴产品图，可继续上传替换。");
    target.innerHTML = "";
    showToast("已带入图鉴资料");
  }));
}

function bindAddEvents() {
  const form = content.querySelector("#collectionForm");
  if (!form) return;
  content.querySelectorAll("[data-quick-category]").forEach((button) => button.addEventListener("click", () => {
    form.elements.category.value = button.dataset.quickCategory;
    content.querySelectorAll("[data-quick-category]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  content.querySelectorAll("[data-form-status]").forEach((button) => button.addEventListener("click", () => {
    form.elements.status.value = button.dataset.formStatus;
    content.querySelectorAll("[data-form-status]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  content.querySelector("#catalogLinkSearch")?.addEventListener("click", () => renderCatalogSuggestions(content.querySelector("#catalogLinkQuery").value));
  content.querySelector("#catalogLinkQuery")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); renderCatalogSuggestions(event.target.value); }
  });
  content.querySelector("#chooseImage")?.addEventListener("click", () => content.querySelector("#imageFile")?.click());
  content.querySelector("#imageFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return showToast("请选择 JPG、PNG 或 WebP 图片");
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return showToast(`原图不能超过 1MB（当前 ${formatFileSize(file.size)}）`);
    const note = content.querySelector("#uploadNote");
    if (note) note.textContent = "正在压缩图片…";
    try {
      const dataUrl = await compressImage(file);
      updateFormImage(dataUrl, `已从 ${formatFileSize(file.size)} 压缩至 ${formatFileSize(dataUrlByteSize(dataUrl))}，保存后写入当前设备。`);
      showToast("图片压缩完成");
    } catch (error) { showToast(error.message || "图片处理失败"); }
  });
  content.querySelector("#autoImage")?.addEventListener("click", () => {
    const query = `${form.elements.name.value} ${form.elements.series.value}`.trim();
    const match = catalogMatches(query)[0] || catalogMatches(form.elements.name.value)[0];
    if (!match?.coverImage) return showToast("暂未找到匹配图片，可从图鉴搜索关联");
    updateFormImage(match.coverImage, "已自动匹配图鉴产品图。");
    showToast("已找到产品图");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const series = String(data.get("series") || "").trim();
    if (!name || !series) return showToast("请填写藏品名称和厂牌 / 系列");
    const existing = state.records.find((record) => String(record.id) === String(state.editingId));
    const status = String(data.get("status") || "已入库");
    const price = Math.max(0, Number(data.get("price") || 0));
    const next = {
      ...(existing || {}),
      id: existing?.id || (crypto.randomUUID?.() || `local-${Date.now()}`),
      name,
      category: String(data.get("category") || "高达模型").trim() || "高达模型",
      series,
      status,
      quantity: Math.max(1, Math.floor(Number(data.get("quantity") || 1))),
      price,
      paid: status === "已入库" ? price : Number(existing?.paid || 0),
      date: String(data.get("date") || todayValue()),
      note: String(data.get("note") || "").trim(),
      imageUrl: state.uploadImage || "",
      catalogId: form.dataset.catalogId || existing?.catalogId || "",
      updatedAt: new Date().toISOString(),
    };
    if (existing) state.records = state.records.map((record) => String(record.id) === String(existing.id) ? next : record);
    else state.records.unshift(next);
    if (!saveRecords(existing ? "修改收藏" : "新增收藏")) return;
    state.editingId = "";
    state.prefill = null;
    state.uploadImage = "";
    showToast(existing ? "收藏已更新" : "收藏已保存");
    navigate(state.addReturnRoute === "life" ? "life" : "collection");
  });
  content.querySelector("#deleteRecord")?.addEventListener("click", () => {
    const existing = state.records.find((record) => String(record.id) === String(state.editingId));
    if (!existing || !confirm(`确定删除「${existing.name}」吗？`)) return;
    state.records = state.records.filter((record) => String(record.id) !== String(existing.id));
    saveRecords("删除收藏");
    state.editingId = "";
    state.uploadImage = "";
    showToast("收藏已删除");
    navigate(state.addReturnRoute === "life" ? "life" : "collection");
  });
}

function bindLifeAddEvents() {
  const form = content.querySelector("#lifeExpenseForm");
  if (!form) return;
  content.querySelectorAll("[data-life-pick]").forEach((button) => button.addEventListener("click", () => {
    form.elements.category.value = button.dataset.lifePick;
    content.querySelectorAll("[data-life-pick]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  content.querySelector("#chooseLifeImage")?.addEventListener("click", () => content.querySelector("#lifeImageFile")?.click());
  content.querySelector("#clearLifeImage")?.addEventListener("click", () => {
    updateLifeFormImage("", "图片已移除。原图限制 1MB，上传时自动压缩。");
  });
  content.querySelector("#lifeImageFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return showToast("请选择 JPG、PNG 或 WebP 图片");
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return showToast(`原图不能超过 1MB（当前 ${formatFileSize(file.size)}）`);
    const note = content.querySelector("#lifeUploadNote");
    if (note) note.textContent = "正在压缩图片…";
    try {
      const dataUrl = await compressImage(file);
      updateLifeFormImage(dataUrl, `已从 ${formatFileSize(file.size)} 压缩至 ${formatFileSize(dataUrlByteSize(dataUrl))}，保存后写入当前设备。`);
      showToast("图片压缩完成");
    } catch (error) { showToast(error.message || "图片处理失败"); }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const category = String(data.get("category") || "").trim();
    const amount = Number(data.get("amount") || 0);
    if (!name) return showToast("请填写支出名称");
    if (!LIFE_CATEGORIES.slice(1).includes(category)) return showToast("请选择支出分类");
    if (!Number.isFinite(amount) || amount <= 0) return showToast("请填写正确的支出金额");
    const existing = state.lifeRecords.find((record) => String(record.id) === String(state.editingExpenseId));
    const next = {
      ...(existing || {}),
      id: existing?.id || (crypto.randomUUID?.() || `expense-${Date.now()}`),
      name,
      category,
      amount,
      date: String(data.get("date") || todayValue()),
      note: String(data.get("note") || "").trim(),
      imageUrl: state.lifeUploadImage || "",
      updatedAt: new Date().toISOString(),
    };
    if (existing) state.lifeRecords = state.lifeRecords.map((record) => String(record.id) === String(existing.id) ? next : record);
    else state.lifeRecords.unshift(next);
    if (!saveLifeRecords()) return;
    state.lifeYear = Number(next.date.slice(0, 4)) || state.lifeYear;
    state.editingExpenseId = "";
    state.lifeUploadImage = "";
    showToast(existing ? "支出已更新" : "支出已保存");
    navigate("life");
  });
  content.querySelector("#deleteExpense")?.addEventListener("click", () => {
    const existing = state.lifeRecords.find((record) => String(record.id) === String(state.editingExpenseId));
    if (!existing || !confirm(`确定删除「${existing.name}」吗？`)) return;
    state.lifeRecords = state.lifeRecords.filter((record) => String(record.id) !== String(existing.id));
    if (!saveLifeRecords()) return;
    state.editingExpenseId = "";
    state.lifeUploadImage = "";
    showToast("支出已删除");
    navigate("life");
  });
}

function bindViewEvents() {
  bindCommonButtons();
  if (state.route === "life") bindLifeEvents();
  if (state.route === "collection") bindCollectionEvents();
  if (state.route === "catalog") bindCatalogEvents();
  if (state.route === "discover") bindDiscoverEvents();
  if (state.route === "add") bindAddEvents();
  if (state.route === "life-add") bindLifeAddEvents();
}

async function hydrateSnapshots() {
  const [catalogResult, newsResult, sessionResult] = await Promise.allSettled([
    fetch("../api-snapshots/app-catalog.json").then((response) => response.json()),
    fetch("../api-snapshots/news.json").then((response) => response.json()),
    fetch("../api-snapshots/app-session.json").then((response) => response.json()),
  ]);
  if (catalogResult.status === "fulfilled") state.catalog = catalogResult.value.items || [];
  if (newsResult.status === "fulfilled") state.news = newsResult.value.items || newsResult.value.articles || [];
  if (sessionResult.status === "fulfilled" && sessionResult.value.user) state.profile = { ...sessionResult.value.user, authenticated: sessionResult.value.authenticated };
  if (["catalog", "discover", "profile"].includes(state.route)) render();
}

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");
  if (button) navigate(button.dataset.route);
});
floatingAdd.addEventListener("click", () => navigate(state.route === "life" ? "life-add" : "add"));
headerBack.addEventListener("click", () => {
  state.editingId = "";
  state.editingExpenseId = "";
  state.prefill = null;
  state.uploadImage = "";
  state.lifeUploadImage = "";
  navigate(state.addReturnRoute || "collection");
});
window.addEventListener("hashchange", render);
content.addEventListener("scroll", () => {
  content.classList.add("is-scrolling");
  window.clearTimeout(scrollIndicatorTimer);
  scrollIndicatorTimer = window.setTimeout(() => content.classList.remove("is-scrolling"), 550);
}, { passive: true });

state.records = loadRecords();
state.lifeRecords = loadLifeRecords();
state.selectedYear = [...new Set([new Date().getFullYear(), ...state.records.map(yearOf)])].sort((a, b) => b - a)[0];
if (!location.hash) history.replaceState(null, "", "#/dashboard");
render();
hydrateSnapshots();
