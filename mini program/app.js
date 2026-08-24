const STORAGE_KEY = "hangar07-collection-v1";
const SCOPED_STORAGE_KEY = `${STORAGE_KEY}:本地镜像`;
const BACKUP_KEY = "hangar07-backups-v1:本地镜像";
const PENDING_SYNC_KEY = "hangar07-pending-sync-v1:本地镜像";
const LIFE_STORAGE_KEY = "wanwu-life-expenses-v1";
const FULL_BACKUP_KEY = "wanwu-full-data-backups-v1";
const STORAGE_COMPACTED_KEY = "wanwu-storage-compacted-v2";
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const COMPRESSED_IMAGE_MAX_BYTES = 180 * 1024;
const COMPRESSED_IMAGE_MAX_SIDE = 1280;
const ROUTES = ["life", "dashboard", "collection", "profile", "collection-wall", "add", "life-add"];
const TITLES = {
  life: "生活记账",
  dashboard: "总览",
  collection: "收藏库",
  profile: "我的",
  "collection-wall": "我的收藏墙",
  add: "新增收藏",
  "life-add": "新增支出",
};
const CATEGORIES = ["全部分类", "高达模型", "机娘", "兵人/人偶", "变形金刚", "其他"];
const LIFE_CATEGORIES = ["全部", "衣", "食", "住", "行", "玩", "收藏"];
const LIFE_EXPENSE_CATEGORIES = LIFE_CATEGORIES.slice(1);

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
  dashboardPeriod: "year",
  collectionSearch: "",
  collectionSearchDraft: "",
  collectionStatus: "全部",
  collectionCategory: "全部分类",
  collectionView: "list",
  editingId: "",
  editingExpenseId: "",
  addReturnRoute: "collection",
  uploadImage: "",
  lifeUploadImage: "",
  wallYear: "all",
  wallCategory: "全部分类",
  wallLoading: false,
  wallGenerated: false,
  wallImageUrl: "",
  wallImageBlob: null,
  loadedImageIds: new Set(),
  failedImageIds: new Set(),
  retryFailedImages: false,
  profile: { username: "本地镜像", authenticated: true },
};

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function loadRecords() {
  const scopedPayload = localStorage.getItem(SCOPED_STORAGE_KEY);
  if (scopedPayload !== null) {
    const scoped = safeParse(scopedPayload, []);
    return Array.isArray(scoped) ? scoped : [];
  }
  const legacy = safeParse(localStorage.getItem(STORAGE_KEY), []);
  return Array.isArray(legacy) ? legacy : [];
}

function loadLifeRecords() {
  const value = safeParse(localStorage.getItem(LIFE_STORAGE_KEY), []);
  return Array.isArray(value) ? value : [];
}

function saveLifeRecords() {
  try {
    localStorage.setItem(LIFE_STORAGE_KEY, JSON.stringify(state.lifeRecords));
    backupAllData("生活支出更新");
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
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ records: imageLightRecords(state.records), reason, savedAt: new Date().toISOString() }));
    backupAllData(reason);
    return true;
  } catch (error) {
    showToast("本机存储空间不足，请删除部分图片后重试");
    return false;
  }
}

function getCollectionBackups() {
  const backups = safeParse(localStorage.getItem(BACKUP_KEY), []);
  return Array.isArray(backups) ? backups : [];
}

function imageLightRecords(records) {
  return records.map((record) => ({
    ...record,
    imageUrl: String(record.imageUrl || "").startsWith("data:") ? "" : record.imageUrl || "",
  }));
}

function buildLightSnapshot() {
  return {
    records: imageLightRecords(state.records),
    lifeRecords: imageLightRecords(state.lifeRecords),
  };
}

function getFullBackups() {
  const backups = safeParse(localStorage.getItem(FULL_BACKUP_KEY), []);
  return Array.isArray(backups) ? backups : [];
}

function addCollectionBackup(reason) {
  try {
    const payload = JSON.stringify(imageLightRecords(state.records));
    const backups = getCollectionBackups();
    if (!backups.some((backup) => backup.payload === payload)) {
      backups.unshift({ createdAt: new Date().toISOString(), reason, payload });
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 10)));
    }
    return true;
  } catch {
    return false;
  }
}

function buildDataArchive() {
  return {
    exportedAt: new Date().toISOString(),
    app: "玩物不丧志",
    version: 1,
    records: structuredClone(state.records),
    backups: structuredClone(getCollectionBackups()),
    lifeRecords: structuredClone(state.lifeRecords),
    lifeCategories: [...LIFE_EXPENSE_CATEGORIES],
  };
}

function downloadArchive(archive, filename) {
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function backupAllData(reason) {
  try {
    const snapshot = buildLightSnapshot();
    const payload = JSON.stringify(snapshot);
    const list = getFullBackups();
    const existingIndex = list.findIndex((backup) => backup.payload === payload);
    if (existingIndex >= 0) list.splice(existingIndex, 1);
    list.unshift({ createdAt: new Date().toISOString(), reason, payload });
    localStorage.setItem(FULL_BACKUP_KEY, JSON.stringify(list.slice(0, 5)));
    addCollectionBackup(reason);
    return true;
  } catch {
    return false;
  }
}

function fullBackupCount() {
  return getFullBackups().length;
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

function compactLegacyStorageOnce() {
  if (localStorage.getItem(STORAGE_COMPACTED_KEY) === "1") return;
  try {
    const lightRecords = imageLightRecords(state.records);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightRecords));
    const pending = safeParse(localStorage.getItem(PENDING_SYNC_KEY), null);
    if (pending?.records) {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ ...pending, records: lightRecords }));
    }
    localStorage.setItem(STORAGE_COMPACTED_KEY, "1");
  } catch {}
}

function soldPrice(record) {
  const value = Number(record.soldPrice ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function saleProfit(record) {
  return soldPrice(record) - recordPrice(record);
}

function signedMoney(value) {
  const amount = Number(value || 0);
  return `${amount > 0 ? "+" : amount < 0 ? "-" : ""}¥${formatMoney(Math.abs(amount))}`;
}

function profitClass(value) {
  return value > 0 ? "profit" : value < 0 ? "loss" : "even";
}

function paidAmount(record) {
  const paid = Number(record.paid);
  if (Number.isFinite(paid)) return paid;
  return ["已入库", "已卖出"].includes(record.status) ? recordPrice(record) : 0;
}

function dueAmount(record) {
  return record.status === "预定中" ? Math.max(0, recordPrice(record) - paidAmount(record)) : 0;
}

function yearOf(record) {
  return Number(String(record.date || record.createdAt || "").slice(0, 4)) || new Date().getFullYear();
}

function selectedYearValue(value) {
  return value === "all" ? "all" : Number(value);
}

function yearOptions(records, selectedYear) {
  const currentYear = new Date().getFullYear();
  const dataYears = records
    .map((record) => Number(String(record.date || record.createdAt || "").slice(0, 4)))
    .filter((year) => Number.isFinite(year) && year > 1900 && year <= currentYear);
  const earliestYear = dataYears.length ? Math.min(...dataYears) : currentYear;
  const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);
  return [
    `<option value="all" ${selectedYear === "all" ? "selected" : ""}>全年</option>`,
    ...years.map((year) => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year} 年</option>`),
  ].join("");
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
  if (route === "collection-wall") {
    state.addReturnRoute = "profile";
    state.wallLoading = false;
    state.wallGenerated = false;
    state.wallImageUrl = "";
  }
  if (route === "add") {
    state.addReturnRoute = state.route === "add" ? state.addReturnRoute : state.route;
    state.editingId = options.editingId || "";
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
  const isSold = record.status === "已卖出";
  const profit = isSold ? saleProfit(record) : 0;
  const sideValue = isSold
    ? `<strong class="sale-result ${profitClass(profit)}" aria-label="售出盈亏">${signedMoney(profit)}</strong>`
    : `<strong>¥${formatMoney(price)}</strong>`;
  return `
    <article class="record-card" data-record-id="${escapeHtml(record.id)}" tabindex="0" role="button" aria-label="编辑 ${escapeHtml(record.name)}">
      <div class="record-image">
        ${collectionImageMarkup(record, image, record.name)}
      </div>
      <div class="record-main">
        <h3>${escapeHtml(record.name || "未命名收藏")}</h3>
        <p>${escapeHtml([record.category, record.series].filter(Boolean).join(" · ") || "未填写分类")}</p>
        <time>${record.status === "预定中" ? "预定于" : "入库于"} ${escapeHtml(formatDate(record.date))}</time>
      </div>
      <div class="record-side">
        <span class="status-badge${record.status === "预定中" ? " preorder" : isSold ? " sold" : ""}">${escapeHtml(record.status || "已入库")}</span>
        ${sideValue}
      </div>
    </article>`;
}

function showcaseItem(record) {
  const image = getRecordImage(record);
  return `
    <article class="showcase-item" data-record-id="${escapeHtml(record.id)}" tabindex="0" role="button" aria-label="查看 ${escapeHtml(record.name || "未命名收藏")}" title="${escapeHtml(record.name || "未命名收藏")}">
      ${image ? collectionImageMarkup(record, image, record.name || "藏品图片") : `<span class="showcase-placeholder"><i data-lucide="package-open"></i></span>`}
    </article>`;
}

function collectionImageMarkup(record, image, alt) {
  if (!image) return `<i data-lucide="package-open"></i>`;
  const imageId = String(record.id);
  if (state.loadedImageIds.has(imageId)) return `<img class="loaded" src="${escapeHtml(image)}" alt="${escapeHtml(alt || "藏品图片")}" loading="lazy" decoding="async" />`;
  if (state.failedImageIds.has(imageId) && !state.retryFailedImages) return `<i data-lucide="image-off"></i>`;
  return `<img data-record-image data-image-id="${escapeHtml(imageId)}" data-src="${escapeHtml(image)}" alt="${escapeHtml(alt || "藏品图片")}" decoding="async" />`;
}

function wallRecords() {
  return state.records.filter((record) => (
    record.status !== "已卖出"
    &&
    (state.wallYear === "all" || yearOf(record) === Number(state.wallYear))
    && (state.wallCategory === "全部分类" || record.category === state.wallCategory)
  ));
}

function collectionWallView() {
  const records = wallRecords();
  const availableRecords = state.records.filter((record) => record.status !== "已卖出");
  const years = [...new Set(availableRecords.map(yearOf))].sort((a, b) => b - a);
  const categories = [...new Set(availableRecords.map((record) => record.category || "其他"))];
  const totalValue = records.reduce((sum, record) => sum + recordPrice(record), 0);
  const totalPieces = records.reduce((sum, record) => sum + quantity(record), 0);
  const preorderCount = records.filter((record) => record.status === "预定中").length;
  const loading = state.wallLoading;
  return `<section class="page wall-page">
    <div class="wall-intro"><p class="eyebrow">THE COLLECTION WALL</p><h2>把喜欢的东西，<b>一件件留下来</b></h2><p>${escapeHtml(state.profile.username || "收藏家")} 的收藏记录 · ${records.length} 件</p></div>
    <div class="wall-filters">
      <label><select id="wallYear"><option value="all">全部年份</option>${years.map((year) => `<option value="${year}" ${Number(state.wallYear) === year ? "selected" : ""}>${year} 年</option>`).join("")}</select></label>
      <label><select id="wallCategory"><option value="全部分类">全部分类</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${state.wallCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>
    </div>
    ${!state.wallGenerated ? `<div class="wall-loader${loading ? " is-loading" : " is-idle"}">
      <div class="loader-shelf"><b class="loader-hook"></b><span></span><span></span><span></span><span></span><i></i><span></span><span></span><span></span><i></i></div>
      <h3>搬运藏品图片</h3><p id="wallLoadingText">已检查 0/${records.length} 件，0 张封面可以上墙</p>
      <div class="loader-track"><b id="wallProgressBar"></b><em id="wallProgressCart">玩</em></div><div class="loader-meta"><strong id="wallProgressPercent">0%</strong><span id="wallProgressCount">0 / ${records.length} 张封面就位</span></div>
    </div>
    <button class="generate-wall" id="generateWall" type="button" ${loading || !records.length ? "disabled" : ""}><i data-lucide="sparkles"></i>${loading ? "正在生成…" : "生成收藏墙"}</button>` : `<button class="wall-image-preview" id="openWallImage" type="button" aria-label="打开收藏墙图片"><img src="${state.wallImageUrl}" alt="生成的收藏墙长图" /></button>
    <button class="save-wall" id="saveWall" type="button" ${records.length ? "" : "disabled"}><i data-lucide="image-down"></i>保存到相册</button>`}
  </section>`;
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
      displayCategory: record.category || "其他",
      collectionStatus: record.status || "已入库",
      saleResult: record.status === "已卖出" ? saleProfit(record) : null,
      amount: paidAmount(record),
      date: record.date || record.createdAt || todayValue(),
      note: [record.category, record.series].filter(Boolean).join(" · "),
      imageUrl: record.imageUrl || record.catalogCoverImage || "",
    }));
  return [...manual, ...collections].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function expenseCard(expense) {
  const image = normalizeAssetUrl(expense.imageUrl || "");
  const icon = { "衣": "shirt", "食": "utensils", "住": "house", "行": "car-front", "玩": "gamepad-2", "收藏": "package" }[expense.category] || "receipt-text";
  const isCollection = expense.sourceType === "collection";
  const isSold = isCollection && expense.collectionStatus === "已卖出";
  const collectionValue = isSold ? Number(expense.saleResult || 0) : Number(expense.amount || 0);
  const amountMarkup = isCollection
    ? `<div class="expense-amount collection-value"><span>${escapeHtml(expense.displayCategory || "其他")}</span><strong class="${isSold ? profitClass(collectionValue) : "owned"}">${isSold ? signedMoney(collectionValue) : `¥${formatMoney(collectionValue)}`}</strong></div>`
    : `<div class="expense-amount"><strong>-¥${formatMoney(expense.amount)}</strong><span>${escapeHtml(expense.category)}</span></div>`;
  return `<article class="expense-card" data-expense-id="${escapeHtml(expense.id)}" data-expense-source="${escapeHtml(expense.sourceType || "life")}" tabindex="0" role="button" aria-label="查看 ${escapeHtml(expense.name)}">
    <div class="expense-icon ${expense.category === "收藏" ? "collection" : ""}">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" />` : `<i data-lucide="${icon}"></i>`}</div>
    <div class="expense-main"><h3>${escapeHtml(expense.name || "生活支出")}</h3><p>${isCollection ? escapeHtml(expense.note || expense.displayCategory || "收藏") : `${escapeHtml(expense.category || "其他")} · ${escapeHtml(expense.note || "生活记账")}`}</p><time>${escapeHtml(formatDate(expense.date))}</time></div>
    ${amountMarkup}
  </article>`;
}

function lifeView() {
  const expenses = allLifeExpenses();
  const currentYear = new Date().getFullYear();
  const displayYear = state.lifeYear === "all" ? "全部年份" : `${state.lifeYear} 年`;
  const yearExpenses = state.lifeYear === "all"
    ? expenses
    : expenses.filter((item) => Number(String(item.date || "").slice(0, 4)) === state.lifeYear);
  const selectedMonth = new Date().getMonth() + 1;
  const monthYear = state.lifeYear === "all" ? currentYear : state.lifeYear;
  const monthExpenses = expenses.filter((item) => (
    Number(String(item.date || "").slice(0, 4)) === monthYear
    && Number(String(item.date || "").slice(5, 7)) === selectedMonth
  ));
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
    <div class="life-topbar"><div class="archive-intro life-intro"><p class="eyebrow">DAILY LEDGER</p><h2>生活记账 <small>${periodExpenses.length} 笔</small></h2></div><select class="year-select" id="lifeYearSelect" aria-label="选择生活账本年份">${yearOptions(expenses, state.lifeYear)}</select></div>
    <div class="investment-card life-investment">
      <p class="eyebrow">LIFE EXPENDITURE</p><div class="annual-toggle life-period"><button type="button" data-life-period="year" class="${state.lifePeriod === "year" ? "active" : ""}">全年</button><button type="button" data-life-period="month" class="${state.lifePeriod === "month" ? "active" : ""}">本月</button></div>
      <h3 class="life-card-title">${state.lifePeriod === "month" ? `${monthYear} 年 ${String(selectedMonth).padStart(2, "0")} 月` : displayYear}生活支出</h3>
      <div class="big-money"><b>¥</b>${formatMoney(total)}</div>
      <p>${periodExpenses.length} 笔支出&nbsp; · &nbsp;收藏同步 ${collectionItems.length} 笔</p>
      <div class="investment-split"><div>本月支出<strong>¥${formatMoney(monthTotal)}</strong></div><div>全年支出<strong>¥${formatMoney(yearTotal)}</strong></div></div>
    </div>
    <label class="search-box life-search"><i data-lucide="search"></i><input id="lifeSearch" value="${escapeHtml(state.lifeSearch)}" placeholder="搜索支出名称 / 分类 / 备注" /></label>
    <div class="segment life-segment" id="lifeSegment">${LIFE_CATEGORIES.map((category) => `<button type="button" data-life-category="${category}" class="${state.lifeCategory === category ? "active" : ""}">${category}</button>`).join("")}</div>
    <div class="list-meta"><span>当前显示 ${filtered.length} 笔</span><span>${state.lifeCategory === "全部" ? "全部生活支出" : `${state.lifeCategory}类支出`}</span></div>
    ${filtered.length ? `<div class="expense-list">${filtered.map(expenseCard).join("")}</div>` : `<div class="empty-state"><p>还没有${state.lifeCategory === "全部" ? "生活支出" : `${state.lifeCategory}类支出`}<br /><small>点击右下角＋记录第一笔</small></p></div>`}
  </section>`;
}

function brandRow() {
  return `
    <div class="brand-row">
      <img class="brand-logo" src="../assets/brand/wanwu_full_logo_light.png" alt="玩物不丧志" />
      <div class="brand-actions">
        <select class="year-select" id="yearSelect" aria-label="选择年份">
          ${yearOptions(state.records, state.selectedYear)}
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
          <button class="primary" type="button" data-go="add">添加第一件收藏</button>
        </div>
        <div class="ready-row"><b>账号已就绪</b><span>下一步 · 添加收藏</span></div>
      </div>
    </section>`;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const yearRecords = state.selectedYear === "all"
    ? allRecords
    : allRecords.filter((record) => yearOf(record) === state.selectedYear);
  const monthYear = state.selectedYear === "all" ? currentYear : state.selectedYear;
  const monthRecords = allRecords.filter((record) => (
    yearOf(record) === monthYear
    && Number(String(record.date || "").slice(5, 7)) === currentMonth
  ));
  const records = state.dashboardPeriod === "month" ? monthRecords : yearRecords;
  const totalPaid = records.reduce((sum, record) => sum + paidAmount(record), 0);
  const count = records.reduce((sum, record) => sum + quantity(record), 0);
  const preorders = records.filter((record) => record.status === "预定中");
  const paymentPending = preorders.filter((record) => record.preorderStage !== "arrival" && dueAmount(record) > 0);
  const arrivalPending = preorders.filter((record) => record.preorderStage === "arrival" || dueAmount(record) <= 0);
  const due = preorders.reduce((sum, record) => sum + dueAmount(record), 0);
  const months = Array.from({ length: 12 }, (_, index) => {
    const items = yearRecords.filter((record) => Number(String(record.date || "").slice(5, 7)) === index + 1);
    return items.reduce((sum, record) => sum + paidAmount(record), 0);
  });
  const maxMonth = Math.max(...months, 1);
  const recent = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 3);
  const recentImage = recent.map(getRecordImage).find(Boolean);
  const reportTitle = state.dashboardPeriod === "month"
    ? `${monthYear} 年 ${String(currentMonth).padStart(2, "0")} 月收藏投入`
    : state.selectedYear === "all" ? "全部年份收藏投入" : `${state.selectedYear} 年收藏投入`;
  const countLabel = state.dashboardPeriod === "month" ? "本月新增" : state.selectedYear === "all" ? "全部新增" : "本年新增";
  return `<section class="page">
    ${brandRow()}
    <div class="annual-card">
      <p class="eyebrow">ANNUAL ACQUISITION REPORT</p>
      <div class="annual-toggle"><button data-dashboard-period="year" class="${state.dashboardPeriod === "year" ? "active" : ""}" type="button">全年</button><button data-dashboard-period="month" class="${state.dashboardPeriod === "month" ? "active" : ""}" type="button">本月</button></div>
      <h3>${reportTitle}</h3>
      <p class="annual-amount"><small>¥</small><strong>${formatMoney(totalPaid)}</strong></p>
      <p class="annual-meta">新增 ${count} 件&nbsp; · &nbsp;当前 ${preorders.length} 项待办</p>
      ${recentImage ? `<div class="annual-thumb"><img src="${escapeHtml(recentImage)}" alt="最近收藏" /><span>最近收藏</span></div>` : ""}
    </div>
    <div class="stat-grid">
      <div class="stat-card"><p>${countLabel}</p><strong>${count}</strong> 件<small>${count - preorders.length} 已入库 · ${preorders.length} 预定</small></div>
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
  const realizedProfit = state.records
    .filter((record) => record.status === "已卖出")
    .reduce((sum, record) => sum + saleProfit(record), 0);
  const netInvestment = totalPaid - realizedProfit;
  const preorders = state.records.filter((record) => record.status === "预定中");
  const paymentPending = preorders.filter((record) => record.preorderStage !== "arrival" && dueAmount(record) > 0);
  const arrivalPending = preorders.filter((record) => record.preorderStage === "arrival" || dueAmount(record) <= 0);
  const search = state.collectionSearch.trim().toLowerCase();
  const filtered = state.records.filter((record) => {
    const matchesSearch = !search || `${record.name || ""} ${record.series || ""} ${record.category || ""} ${record.note || ""}`.toLowerCase().includes(search);
    const matchesStatus = state.collectionStatus === "全部"
      || (state.collectionStatus === "已入库" && record.status === "已入库")
      || (state.collectionStatus === "已卖出" && record.status === "已卖出")
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
      <div class="investment-split collection-investment-split"><div>已付金额<strong>¥${formatMoney(totalPaid)}</strong></div><div>售出盈亏<strong class="${profitClass(realizedProfit)}">${signedMoney(realizedProfit)}</strong></div><div>净投入<strong>¥${formatMoney(netInvestment)}</strong></div></div>
    </div>
    <form class="search-box collection-search" id="collectionSearchForm"><i data-lucide="search"></i><input id="collectionSearch" value="${escapeHtml(state.collectionSearchDraft)}" placeholder="搜索藏品 / 厂牌 / 分类 / 备注" enterkeyhint="search" autocapitalize="none" spellcheck="false" /><button id="collectionSearchButton" type="submit" aria-label="执行搜索"><i data-lucide="search"></i></button></form>
    <div class="segment" id="statusSegment">
      ${["全部", "已入库", "已卖出", "待补款", "待到货"].map((item) => `<button type="button" data-status="${item}" class="${state.collectionStatus === item ? "active" : ""}">${item}</button>`).join("")}
    </div>
    <div class="filter-row"><span class="filter-label">分类</span>${CATEGORIES.map((category) => `<button class="chip ${state.collectionCategory === category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}<button class="chip" id="manageCategories" type="button">管理</button></div>
    <div class="list-meta"><span>当前显示 ${filtered.length} 件</span><div class="view-switch"><button type="button" data-list-view="list" class="${state.collectionView === "list" ? "active" : ""}">清单</button><button type="button" data-list-view="grid" class="${state.collectionView === "grid" ? "active" : ""}">展柜</button></div></div>
    <div class="collection-image-progress" id="collectionImageProgress" hidden><div><span id="collectionImageProgressText">正在加载图片 0/0</span><b id="collectionImageProgressPercent">0%</b></div><i><em id="collectionImageProgressBar"></em></i></div>
    ${filtered.length ? `<div class="record-list ${state.collectionView}">${filtered.map(state.collectionView === "grid" ? showcaseItem : recordCard).join("")}</div>` : `<div class="empty-state"><p>没有匹配的藏品</p></div>`}
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
    <div class="collection-portrait"><p class="eyebrow">MY COLLECTION</p><h3>${escapeHtml(count ? `${favorite}收藏者` : "等待第一件收藏")}</h3><p>${count ? `最常收藏 ${favorite}` : "从第一件藏品开始生成收藏画像"}</p><div class="portrait-stats"><div><strong>${count}</strong><span>件收藏</span></div><div><strong>${yearCount}</strong><span>今年新增</span></div><div><strong>${preorders}</strong><span>仍在预定</span></div></div><div class="portrait-actions"><div class="portrait-link" data-go="collection" role="button" tabindex="0">打开收藏库 <b>›</b></div><button type="button" data-go="collection-wall">生成收藏墙</button></div></div>
    <p class="profile-section-title">购买计划</p>
    <div class="wish-card"><div class="wish-card-top"><p class="eyebrow">WISH BOARD</p><h3>愿望清单</h3><p>收好每一个想入手的玩具</p></div><div class="wish-card-foot"><span>0 件愿望</span><b>查看愿望画板 ›</b></div></div>
    <p class="profile-section-title">参与共建</p>
    <div class="project-card"><p class="eyebrow">PROJECT COMPLETION</p><h3>补完计划</h3><p>提建议、看共识、跟进采纳进度</p><b>进入 ›</b></div>
    <p class="profile-section-title">数据与备份</p>
    <div class="data-vault">
      <div class="data-vault-head"><div><h3>资料保险箱</h3><p>收藏与生活记账完整 JSON 备份</p></div><i data-lucide="shield-check"></i></div>
      <div class="data-actions">
        <button id="exportBackup" type="button"><i data-lucide="download"></i><span>导出数据<small>按标准模板保存</small></span></button>
        <button id="copyBackup" type="button"><i data-lucide="copy"></i><span>复制备份<small>复制完整 JSON</small></span></button>
        <button id="importBackup" type="button"><i data-lucide="upload"></i><span>导入数据<small>导入前自动备份</small></span></button>
        <button id="restorePrevious" type="button"><i data-lucide="history"></i><span>恢复上版<small>恢复最近历史版本</small></span></button>
        <button id="reloadCollectionImages" type="button"><i data-lucide="refresh-cw"></i><span>重新加载图片<small>重试收藏封面</small></span></button>
      </div>
      <p class="data-backup-status">已自动保存 ${fullBackupCount()} 个版本 · 当前 ${state.records.length} 条收藏、${state.lifeRecords.length} 笔支出</p>
      <input id="backupImportFile" type="file" accept="application/json,.json" hidden />
    </div>
    <p class="profile-section-title">测试工具</p>
    <button class="clear-test-data" id="clearTestData" type="button"><span><b>一键清空测试数据</b><small>清空当前设备的收藏与生活记账</small></span><i data-lucide="trash-2"></i></button>
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
  const source = existing || {};
  if (!state.uploadImage) state.uploadImage = source.imageUrl || source.catalogCoverImage || "";
  const category = source.category || "高达模型";
  const status = source.status || "已入库";
  const image = normalizeAssetUrl(state.uploadImage);
  return `<form class="page form-page" id="collectionForm">
    <section class="form-section">
      <p class="eyebrow">COLLECTION DETAILS</p><h2 class="form-title">藏品资料</h2>
      <label class="field"><span>藏品名称<b>*</b></span><input name="name" required maxlength="80" value="${escapeHtml(source.name || "")}" placeholder="例如：MGEX 强袭自由高达" /></label>
      <label class="field"><span>收藏分类 <small>可自定义</small></span><input name="category" value="${escapeHtml(category)}" maxlength="30" placeholder="填写分类名称" /></label>
      <div class="quick-categories">${CATEGORIES.slice(1).map((item) => `<button type="button" data-quick-category="${escapeHtml(item)}" class="${item === category ? "active" : ""}">${escapeHtml(item)}</button>`).join("")}</div>
      <label class="field"><span>厂牌 / 系列<b>*</b></span><input name="series" required maxlength="80" value="${escapeHtml(source.series || "")}" placeholder="例如：BANDAI / MGEX" /></label>
    </section>
    <section class="form-section">
      <p class="eyebrow">PURCHASE STATUS</p><h2 class="form-title">购买状态</h2>
      <label class="field"><span>收藏状态</span><input type="hidden" name="status" value="${escapeHtml(status)}" /><div class="status-segment"><button type="button" data-form-status="已入库" class="${status === "已入库" || status === "已卖出" ? "active" : ""}">已入库</button><button type="button" data-form-status="预定中" class="${status === "预定中" ? "active" : ""}">预定中</button></div></label>
      <div class="form-two"><label class="field"><span>数量</span><input name="quantity" type="number" min="1" step="1" value="${quantity(source)}" /></label><label class="field"><span>总价（人民币）</span><input name="price" type="number" min="0" step="0.01" value="${recordPrice(source) || ""}" placeholder="0" /></label></div>
      <label class="field"><span>购买 / 预定日期</span><input name="date" type="date" value="${escapeHtml(source.date || todayValue())}" /></label>
    </section>
    <section class="form-section"><p class="eyebrow">PRIVATE NOTE</p><h2 class="form-title">收藏备注 <small>可选</small></h2><label class="field"><textarea name="note" maxlength="800" placeholder="缺件、存放位置、版本状态…">${escapeHtml(source.note || "")}</textarea></label></section>
    <section class="form-section"><p class="eyebrow">PRODUCT IMAGE</p><h2 class="form-title">产品图片 <small>可选</small></h2>
      <div class="image-uploader"><div class="image-preview" id="imagePreview">${image ? `<img src="${escapeHtml(image)}" alt="产品图预览" />` : `<b>＋</b><span>产品图</span>`}</div><div class="image-actions"><button id="chooseImage" type="button">上传图片</button><button id="clearImage" class="alt" type="button">移除图片</button></div></div>
      <input id="imageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden /><p class="upload-note" id="uploadNote">原图不超过 5MB，上传时自动压缩为 WebP。</p>
    </section>
    ${existing ? `<section class="sale-editor" id="saleEditor" ${status === "预定中" ? "hidden" : ""}>
      <div class="sale-editor-head"><div><p class="eyebrow">SALE STATUS</p><h2 class="form-title">出售藏品</h2></div><span>仅已有收藏可标记</span></div>
      <div class="sale-status-segment"><button type="button" data-sale-status="已入库" class="${status !== "已卖出" ? "active" : ""}">仍在收藏</button><button type="button" data-sale-status="已卖出" class="${status === "已卖出" ? "active" : ""}">已卖出</button></div>
      <div id="saleFields" ${status === "已卖出" ? "" : "hidden"}><label class="field"><span>售出价格（人民币）<b>*</b></span><input name="soldPrice" type="number" min="0" step="0.01" value="${source.soldPrice ?? ""}" placeholder="请输入实际售出总价" ${status === "已卖出" ? "required" : ""} /></label><p class="sale-hint">保存后自动按“售出价格 − 收藏总价”计算盈亏</p></div>
    </section>` : ""}
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
      <label class="field"><span>支出名称<b>*</b></span><input name="name" required maxlength="80" value="${escapeHtml(source.name || "")}" placeholder="例如：午餐、房租、电影票" /></label>
      <label class="field"><span>支出分类<b>*</b></span><input type="hidden" name="category" value="${escapeHtml(category)}" /></label>
      <div class="quick-categories life-category-picks">${LIFE_EXPENSE_CATEGORIES.map((item) => `<button type="button" data-life-pick="${item}" class="${item === category ? "active" : ""}">${item}</button>`).join("")}</div>
      <div class="form-two"><label class="field"><span>金额（人民币）<b>*</b></span><input name="amount" type="number" min="0.01" step="0.01" required value="${Number(source.amount || 0) || ""}" placeholder="0" /></label><label class="field"><span>支出日期</span><input name="date" type="date" value="${escapeHtml(source.date || todayValue())}" /></label></div>
    </section>
    <section class="form-section"><p class="eyebrow">EXPENSE NOTE</p><h2 class="form-title">支出备注 <small>可选</small></h2><label class="field"><textarea name="note" maxlength="800" placeholder="用途、付款方式、同行人…">${escapeHtml(source.note || "")}</textarea></label></section>
    <section class="form-section"><p class="eyebrow">RECEIPT IMAGE</p><h2 class="form-title">支出图片 <small>可选</small></h2>
      <div class="image-uploader"><div class="image-preview" id="lifeImagePreview">${image ? `<img src="${escapeHtml(image)}" alt="支出图片预览" />` : `<b>＋</b><span>支出图</span>`}</div><div class="image-actions"><button id="chooseLifeImage" type="button">上传图片</button><button id="clearLifeImage" class="alt" type="button">移除图片</button></div></div>
      <input id="lifeImageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden /><p class="upload-note" id="lifeUploadNote">原图不超过 5MB，上传时自动压缩为 WebP。</p>
    </section>
    ${existing ? `<button class="delete-record" id="deleteExpense" type="button">删除这笔支出</button>` : ""}
  </form>`;
}

function render() {
  state.route = currentRoute();
  if (state.route !== "collection") startCollectionImageQueue.runToken += 1;
  pageTitle.textContent = state.route === "add" && state.editingId ? "修改收藏" : TITLES[state.route];
  const formMode = state.route === "add" || state.route === "life-add";
  const wallMode = state.route === "collection-wall";
  shell.classList.toggle("form-mode", formMode);
  shell.classList.toggle("wall-mode", wallMode);
  headerBack.hidden = !formMode && !wallMode;
  formSaveBar.hidden = !formMode;
  if (formMode) {
    const lifeMode = state.route === "life-add";
    formSaveButton.textContent = lifeMode ? (state.editingExpenseId ? "保存修改" : "保存支出") : (state.editingId ? "保存修改" : "保存收藏");
    formSaveButton.setAttribute("form", lifeMode ? "lifeExpenseForm" : "collectionForm");
  }
  floatingAdd.hidden = !["life", "dashboard", "collection"].includes(state.route);
  tabbar.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.route === state.route));
  const views = { life: lifeView, dashboard: dashboardView, collection: collectionView, profile: profileView, "collection-wall": collectionWallView, add: addView, "life-add": lifeAddView };
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
  content.querySelector("#yearSelect")?.addEventListener("change", (event) => { state.selectedYear = selectedYearValue(event.target.value); render(); });
  content.querySelectorAll("[data-dashboard-period]").forEach((button) => button.addEventListener("click", () => {
    state.dashboardPeriod = button.dataset.dashboardPeriod;
    render();
  }));
  bindRecordCards();
}

function bindCollectionEvents() {
  const search = content.querySelector("#collectionSearch");
  search?.addEventListener("input", (event) => {
    state.collectionSearchDraft = event.target.value;
  });
  content.querySelector("#collectionSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.collectionSearch = String(state.collectionSearchDraft || "").trim();
    search?.blur();
    render();
  });
  content.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    state.collectionStatus = button.dataset.status;
    render();
  }));
  content.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { state.collectionCategory = button.dataset.category; render(); }));
  content.querySelectorAll("[data-list-view]").forEach((button) => button.addEventListener("click", () => { state.collectionView = button.dataset.listView; render(); }));
  content.querySelector("#manageCategories")?.addEventListener("click", () => showToast("分类会根据收藏记录自动整理"));
  startCollectionImageQueue();
}

function startCollectionImageQueue() {
  const images = [...content.querySelectorAll("img[data-record-image]")];
  const progress = content.querySelector("#collectionImageProgress");
  if (!progress || !images.length) return;
  const runToken = ++startCollectionImageQueue.runToken;
  const textElement = content.querySelector("#collectionImageProgressText");
  const percentElement = content.querySelector("#collectionImageProgressPercent");
  const barElement = content.querySelector("#collectionImageProgressBar");
  let completed = 0;
  let failed = 0;
  const forceReload = Boolean(startCollectionImageQueue.forceReload);
  startCollectionImageQueue.forceReload = false;
  state.retryFailedImages = false;
  progress.hidden = false;

  const updateProgress = () => {
    if (runToken !== startCollectionImageQueue.runToken) return;
    const percent = Math.round(completed / images.length * 100);
    if (textElement) textElement.textContent = completed >= images.length
      ? (failed ? `图片处理完成，${failed} 张加载失败` : `图片已加载 ${completed}/${images.length}`)
      : `正在加载图片 ${completed}/${images.length}`;
    if (percentElement) percentElement.textContent = `${percent}%`;
    if (barElement) barElement.style.width = `${percent}%`;
    if (completed >= images.length) window.setTimeout(() => {
      if (runToken === startCollectionImageQueue.runToken) {
        progress.classList.add("complete");
        window.lucide?.createIcons?.();
      }
    }, 500);
  };

  const loadOne = (image, retry = true) => new Promise((resolve) => {
    let source = image.dataset.src;
    if (!source) return resolve();
    if (forceReload && !source.startsWith("data:") && !source.startsWith("blob:")) {
      try {
        const refreshedUrl = new URL(source, location.href);
        refreshedUrl.searchParams.set("reload", String(Date.now()));
        source = refreshedUrl.href;
      } catch {}
    }
    let finished = false;
    const finish = async (loaded) => {
      if (finished) return;
      finished = true;
      image.onload = null;
      image.onerror = null;
      if (!loaded && retry) {
        image.removeAttribute("src");
        await new Promise((next) => setTimeout(next, 180));
        return loadOne(image, false).then(resolve);
      }
      if (loaded) {
        try { await image.decode?.(); } catch {}
        state.loadedImageIds.add(String(image.dataset.imageId || ""));
        state.failedImageIds.delete(String(image.dataset.imageId || ""));
        image.classList.add("loaded");
      } else {
        failed += 1;
        state.failedImageIds.add(String(image.dataset.imageId || ""));
        state.loadedImageIds.delete(String(image.dataset.imageId || ""));
        const holder = image.parentElement;
        image.remove();
        holder?.classList.add("image-load-failed");
        if (holder) holder.innerHTML = '<i data-lucide="image-off"></i>';
      }
      resolve();
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = source;
    if (image.complete) finish(image.naturalWidth > 0);
  });

  let nextIndex = 0;
  const worker = async () => {
    while (runToken === startCollectionImageQueue.runToken && nextIndex < images.length) {
      const image = images[nextIndex++];
      await loadOne(image);
      completed += 1;
      updateProgress();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  };
  updateProgress();
  Promise.all(Array.from({ length: Math.min(3, images.length) }, worker));
}
startCollectionImageQueue.runToken = 0;
startCollectionImageQueue.forceReload = false;

function bindLifeEvents() {
  content.querySelector("#lifeYearSelect")?.addEventListener("change", (event) => {
    state.lifeYear = selectedYearValue(event.target.value);
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
    const saleFields = content.querySelector("#saleFields");
    const soldPriceInput = form.elements.soldPrice;
    if (saleFields) saleFields.hidden = true;
    if (soldPriceInput) soldPriceInput.required = false;
    const saleEditor = content.querySelector("#saleEditor");
    if (saleEditor) saleEditor.hidden = button.dataset.formStatus === "预定中";
    content.querySelectorAll("[data-sale-status]").forEach((item) => item.classList.toggle("active", item.dataset.saleStatus === "已入库"));
  }));
  content.querySelectorAll("[data-sale-status]").forEach((button) => button.addEventListener("click", () => {
    const isSold = button.dataset.saleStatus === "已卖出";
    form.elements.status.value = button.dataset.saleStatus;
    content.querySelectorAll("[data-sale-status]").forEach((item) => item.classList.toggle("active", item === button));
    content.querySelectorAll("[data-form-status]").forEach((item) => item.classList.toggle("active", item.dataset.formStatus === "已入库"));
    const saleFields = content.querySelector("#saleFields");
    const soldPriceInput = form.elements.soldPrice;
    if (saleFields) saleFields.hidden = !isSold;
    if (soldPriceInput) {
      soldPriceInput.required = isSold;
      if (isSold) soldPriceInput.focus();
    }
  }));
  content.querySelector("#chooseImage")?.addEventListener("click", () => content.querySelector("#imageFile")?.click());
  content.querySelector("#imageFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return showToast("请选择 JPG、PNG 或 WebP 图片");
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return showToast(`原图不能超过 5MB（当前 ${formatFileSize(file.size)}）`);
    const note = content.querySelector("#uploadNote");
    if (note) note.textContent = "正在压缩图片…";
    try {
      const dataUrl = await compressImage(file);
      updateFormImage(dataUrl, `已从 ${formatFileSize(file.size)} 压缩至 ${formatFileSize(dataUrlByteSize(dataUrl))}，保存后写入当前设备。`);
      showToast("图片压缩完成");
    } catch (error) { showToast(error.message || "图片处理失败"); }
  });
  content.querySelector("#clearImage")?.addEventListener("click", () => {
    updateFormImage("", "产品图片已移除，可重新上传。");
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
    const saleAmount = Math.max(0, Number(data.get("soldPrice") || 0));
    if (status === "已卖出" && !String(data.get("soldPrice") || "").trim()) return showToast("请填写卖出价格");
    const next = {
      ...(existing || {}),
      id: existing?.id || (crypto.randomUUID?.() || `local-${Date.now()}`),
      name,
      category: String(data.get("category") || "高达模型").trim() || "高达模型",
      series,
      status,
      quantity: Math.max(1, Math.floor(Number(data.get("quantity") || 1))),
      price,
      paid: ["已入库", "已卖出"].includes(status) ? price : Number(existing?.paid || 0),
      soldPrice: status === "已卖出" ? saleAmount : null,
      date: String(data.get("date") || todayValue()),
      note: String(data.get("note") || "").trim(),
      imageUrl: state.uploadImage || "",
      catalogId: existing?.catalogId || "",
      updatedAt: new Date().toISOString(),
    };
    if (existing) state.records = state.records.map((record) => String(record.id) === String(existing.id) ? next : record);
    else state.records.unshift(next);
    if (!saveRecords(existing ? "修改收藏" : "新增收藏")) return;
    state.editingId = "";
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
    updateLifeFormImage("", "图片已移除。原图限制 5MB，上传时自动压缩。");
  });
  content.querySelector("#lifeImageFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return showToast("请选择 JPG、PNG 或 WebP 图片");
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return showToast(`原图不能超过 5MB（当前 ${formatFileSize(file.size)}）`);
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
    if (!LIFE_EXPENSE_CATEGORIES.includes(category)) return showToast("请选择支出分类");
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

function isValidImportedRecord(record) {
  return Boolean(record && record.id && record.name && record.category && record.status && record.date);
}

function isValidImportedExpense(record) {
  return Boolean(
    record
    && record.id
    && record.name
    && LIFE_EXPENSE_CATEGORIES.includes(record.category)
    && record.date
    && Number.isFinite(Number(record.amount))
  );
}

function persistAllData(records, lifeRecords, reason) {
  const recordsPayload = JSON.stringify(records);
  const lightRecords = imageLightRecords(records);
  localStorage.setItem(SCOPED_STORAGE_KEY, recordsPayload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lightRecords));
  localStorage.setItem(LIFE_STORAGE_KEY, JSON.stringify(lifeRecords));
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ records: lightRecords, reason, savedAt: new Date().toISOString() }));
}

async function importBackupFile(file) {
  if (file.size > 25 * 1024 * 1024) return showToast("备份文件不能超过 25MB");
  try {
    const archive = JSON.parse(await file.text());
    const importedRecords = Array.isArray(archive) ? archive : archive?.records;
    const hasLifeRecords = !Array.isArray(archive) && Object.prototype.hasOwnProperty.call(archive || {}, "lifeRecords");
    const importedLifeRecords = hasLifeRecords ? archive.lifeRecords : state.lifeRecords;
    if (!Array.isArray(importedRecords) || !importedRecords.every(isValidImportedRecord)) throw new Error("invalid records");
    if (!Array.isArray(importedLifeRecords) || !importedLifeRecords.every(isValidImportedExpense)) throw new Error("invalid expenses");
    const message = hasLifeRecords
      ? `将导入 ${importedRecords.length} 条收藏和 ${importedLifeRecords.length} 笔生活支出。当前数据会先自动备份，确认继续吗？`
      : `将导入 ${importedRecords.length} 条收藏。该旧版备份不含生活记账，现有生活数据会保留。当前数据会先自动备份，确认继续吗？`;
    if (!window.confirm(message)) return;

    const beforeArchive = buildDataArchive();
    const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
    downloadArchive(beforeArchive, `hangar07-auto-backup-before-import-${stamp}.json`);
    if (!backupAllData("导入前自动备份")) {
      showToast("本机备份空间不足，已取消导入");
      return;
    }

    const previousRecords = structuredClone(state.records);
    const previousLifeRecords = structuredClone(state.lifeRecords);
    try {
      state.records = structuredClone(importedRecords);
      state.lifeRecords = structuredClone(importedLifeRecords);
      state.loadedImageIds.clear();
      state.failedImageIds.clear();
      persistAllData(state.records, state.lifeRecords, "导入恢复");
      addCollectionBackup("导入恢复");
    } catch (error) {
      state.records = previousRecords;
      state.lifeRecords = previousLifeRecords;
      persistAllData(previousRecords, previousLifeRecords, "导入失败自动还原");
      throw error;
    }

    const collectionYears = state.records.map(yearOf).filter(Number.isFinite);
    state.selectedYear = collectionYears.length ? "all" : new Date().getFullYear();
    const lifeYears = state.lifeRecords.map((record) => Number(String(record.date || "").slice(0, 4))).filter(Number.isFinite);
    state.lifeYear = lifeYears.length ? "all" : new Date().getFullYear();
    showToast(`导入完成：${state.records.length} 条收藏、${state.lifeRecords.length} 笔支出`);
    render();
  } catch (error) {
    showToast("导入失败：请选择“玩物不丧志”导出的 JSON 备份文件");
  }
}

async function copyBackupToClipboard() {
  backupAllData("复制备份");
  const contentText = JSON.stringify(buildDataArchive(), null, 2);
  try {
    await navigator.clipboard.writeText(contentText);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = contentText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }
  showToast(`已复制 ${state.records.length} 条收藏、${state.lifeRecords.length} 笔支出`);
}

function findPreviousDataSnapshot() {
  const currentPayload = JSON.stringify(buildLightSnapshot());
  for (const backup of getFullBackups()) {
    if (!backup?.payload || backup.payload === currentPayload) continue;
    const snapshot = safeParse(backup.payload, null);
    if (snapshot && Array.isArray(snapshot.records) && Array.isArray(snapshot.lifeRecords)) return snapshot;
  }
  const currentRecordsPayload = JSON.stringify(imageLightRecords(state.records));
  for (const backup of getCollectionBackups()) {
    if (!backup?.payload || backup.payload === currentRecordsPayload) continue;
    const records = safeParse(backup.payload, null);
    if (Array.isArray(records)) return { records, lifeRecords: structuredClone(state.lifeRecords) };
  }
  return null;
}

function restorePreviousData() {
  const snapshot = findPreviousDataSnapshot();
  if (!snapshot) return showToast("暂时没有可以恢复的历史版本");
  if (!snapshot.records.every(isValidImportedRecord) || !snapshot.lifeRecords.every(isValidImportedExpense)) {
    return showToast("历史版本校验失败，无法恢复");
  }
  if (!window.confirm(`恢复上一个版本吗？将恢复为 ${snapshot.records.length} 条收藏和 ${snapshot.lifeRecords.length} 笔生活支出，当前版本会继续保留。`)) return;
  if (!backupAllData("恢复上版前自动备份")) return showToast("本机备份空间不足，已取消恢复");
  const previousRecords = structuredClone(state.records);
  const previousLifeRecords = structuredClone(state.lifeRecords);
  try {
    state.records = structuredClone(snapshot.records);
    state.lifeRecords = structuredClone(snapshot.lifeRecords);
    persistAllData(state.records, state.lifeRecords, "恢复上版");
    addCollectionBackup("恢复上版");
    backupAllData("恢复上版");
    const collectionYears = state.records.map(yearOf).filter(Number.isFinite);
    state.selectedYear = collectionYears.length ? "all" : new Date().getFullYear();
    const lifeYears = state.lifeRecords.map((record) => Number(String(record.date || "").slice(0, 4))).filter(Number.isFinite);
    state.lifeYear = lifeYears.length ? "all" : new Date().getFullYear();
    showToast(`已恢复上版：${state.records.length} 条收藏、${state.lifeRecords.length} 笔支出`);
    render();
  } catch {
    state.records = previousRecords;
    state.lifeRecords = previousLifeRecords;
    try { persistAllData(previousRecords, previousLifeRecords, "恢复失败自动还原"); } catch {}
    showToast("恢复失败，当前数据未改变");
  }
}

function bindProfileEvents() {
  content.querySelector("#exportBackup")?.addEventListener("click", () => {
    backupAllData("手动导出");
    downloadArchive(buildDataArchive(), `hangar07-backup-${todayValue()}.json`);
    showToast(`已导出 ${state.records.length} 条收藏、${state.lifeRecords.length} 笔支出`);
  });
  content.querySelector("#copyBackup")?.addEventListener("click", async () => {
    try { await copyBackupToClipboard(); } catch { showToast("复制失败，请改用导出数据"); }
  });
  const importInput = content.querySelector("#backupImportFile");
  content.querySelector("#importBackup")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (file) await importBackupFile(file);
  });
  content.querySelector("#restorePrevious")?.addEventListener("click", restorePreviousData);
  content.querySelector("#reloadCollectionImages")?.addEventListener("click", () => {
    if (!state.failedImageIds.size) return showToast("当前没有加载失败的收藏图片");
    startCollectionImageQueue.runToken += 1;
    startCollectionImageQueue.forceReload = true;
    state.retryFailedImages = true;
    showToast(`正在重试 ${state.failedImageIds.size} 张失败图片`);
    navigate("collection");
  });
  content.querySelector("#clearTestData")?.addEventListener("click", () => {
    if (!state.records.length && !state.lifeRecords.length) return showToast("当前没有可清空的测试数据");
    if (!window.confirm("确定一键清空当前设备中的全部收藏与生活记账吗？清空前会自动保存本机备份。")) return;
    if (!backupAllData("清空测试数据前自动备份")) return showToast("本机备份空间不足，已取消清空");
    const previousRecords = structuredClone(state.records);
    const previousLifeRecords = structuredClone(state.lifeRecords);
    try {
      localStorage.setItem(SCOPED_STORAGE_KEY, "[]");
      localStorage.setItem(STORAGE_KEY, "[]");
      localStorage.setItem(LIFE_STORAGE_KEY, "[]");
      localStorage.removeItem(PENDING_SYNC_KEY);
      state.records = [];
      state.lifeRecords = [];
      state.loadedImageIds.clear();
      state.failedImageIds.clear();
      state.selectedYear = new Date().getFullYear();
      state.lifeYear = new Date().getFullYear();
      showToast("测试数据已清空");
      render();
    } catch {
      state.records = previousRecords;
      state.lifeRecords = previousLifeRecords;
      try { persistAllData(previousRecords, previousLifeRecords, "清空失败自动还原"); } catch {}
      showToast("清空失败：本机存储不可用");
    }
  });
}

function startWallLoading() {
  releaseWallImage();
  state.wallLoading = true;
  state.wallGenerated = false;
  render();
}

function loadWallImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = new URL(url, location.href).href;
  });
}

function releaseWallImage() {
  if (String(state.wallImageUrl || "").startsWith("blob:")) URL.revokeObjectURL(state.wallImageUrl);
  state.wallImageUrl = "";
  state.wallImageBlob = null;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function createCollectionWallImage() {
  const records = wallRecords();
  if (!records.length) return "";
  const columns = 8;
  const gap = 10;
  const padding = 36;
  const tile = 116;
  const imageSize = 110;
  const cardHeight = 166;
  const rows = Math.ceil(records.length / columns);
  const width = 1080;
  const height = 310 + rows * (cardHeight + gap);
  const totalValue = records.reduce((sum, record) => sum + recordPrice(record), 0);
  const totalPieces = records.reduce((sum, record) => sum + quantity(record), 0);
  const preorderCount = records.filter((record) => record.status === "预定中").length;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f3f0e9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#c9272d";
  context.fillRect(22, 20, width - 44, 14);
  context.font = "700 18px sans-serif";
  context.fillText("WANWU COLLECTION ARCHIVE", padding, 72);
  context.fillStyle = "#11100f";
  context.font = "900 34px sans-serif";
  context.fillText("这面墙，花了", padding, 122);
  context.fillStyle = "#c9272d";
  context.font = "900 52px sans-serif";
  context.fillText(`¥${formatMoney(totalValue)}`, padding, 180);
  context.fillStyle = "#746e65";
  context.font = "17px sans-serif";
  context.fillText(`藏品总价值 ¥${formatMoney(totalValue)}`, padding, 211);
  context.textAlign = "right";
  context.fillText(`${state.profile.username || "收藏家"} · ${records.length} 件收藏`, width - padding, 71);
  context.textAlign = "left";
  const statValues = [totalPieces, records.length, preorderCount];
  const statLabels = ["件玩具", "条收藏记录", "件还在路上"];
  statValues.forEach((value, index) => {
    const x = 660 + index * 125;
    context.fillStyle = "#11100f";
    context.font = "900 42px sans-serif";
    context.textAlign = "center";
    context.fillText(String(value), x, 135);
    context.fillStyle = "#746e65";
    context.font = "15px sans-serif";
    context.fillText(statLabels[index], x, 165);
    if (index < 2) {
      context.fillStyle = "#d4cfc7";
      context.fillRect(x + 61, 96, 1, 82);
    }
  });
  context.textAlign = "left";
  context.fillStyle = "#11100f";
  context.fillRect(padding, 236, width - padding * 2, 2);
  context.font = "15px sans-serif";
  context.fillText("我的玩具阵列 · COLLECTION INDEX", padding, 263);
  const ellipsis = (textValue, maxWidth) => {
    let value = String(textValue || "未命名收藏");
    while (value.length > 1 && context.measureText(value).width > maxWidth) value = `${value.slice(0, -2)}…`;
    return value;
  };
  const batchSize = 4;
  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const images = await Promise.all(batch.map((record) => loadWallImage(getRecordImage(record))));
    images.forEach((image, batchIndex) => {
      const index = start + batchIndex;
      const x = padding + (index % columns) * (tile + gap);
      const y = 278 + Math.floor(index / columns) * (cardHeight + gap);
      context.fillStyle = "#fff";
      context.fillRect(x, y, tile, cardHeight);
      context.fillStyle = "#e4e0d8";
      context.fillRect(x + 3, y + 3, imageSize, imageSize);
      if (image?.naturalWidth && image?.naturalHeight) drawCover(context, image, x + 3, y + 3, imageSize, imageSize);
      else {
        context.fillStyle = "#aaa198";
        context.font = "42px sans-serif";
        context.textAlign = "center";
        context.fillText("◇", x + tile / 2, y + 66);
        context.textAlign = "left";
      }
      context.fillStyle = "#11100f";
      context.font = "700 13px sans-serif";
      context.fillText(`▪ ${ellipsis(records[index].name, tile - 12)}`, x + 5, y + 132);
      context.fillStyle = "#746e65";
      context.font = "12px sans-serif";
      context.fillText(`¥${formatMoney(recordPrice(records[index]))}`, x + 5, y + 153);
      if (image) image.src = "";
    });
    await nextPaint();
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("image encode failed")), "image/png");
  });
  state.wallImageBlob = blob;
  return URL.createObjectURL(blob);
}

async function saveCollectionWall() {
  const imageUrl = state.wallImageUrl || await createCollectionWallImage();
  if (!imageUrl) return showToast("当前没有可保存的收藏");
  const blob = state.wallImageBlob || await fetch(imageUrl).then((response) => response.blob());
  const filename = `我的收藏墙-${new Date().toISOString().slice(0, 10)}.png`;
  const imageFile = new File([blob], filename, { type: "image/png" });
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (navigator.share && navigator.canShare?.({ files: [imageFile] })) {
    try {
      await navigator.share({ files: [imageFile], title: "我的收藏墙" });
      showToast("请在系统菜单中选择“存储图像”");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (!isIOS) throw error;
    }
  }
  if (isIOS) {
    openIOSImageSaver(imageUrl);
    return;
  }
  const link = document.createElement("a");
  link.download = filename;
  link.href = imageUrl;
  link.click();
  showToast("收藏墙长图已下载");
}

function openIOSImageSaver(imageUrl) {
  document.querySelector("#iosImageSaver")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "ios-image-saver";
  overlay.id = "iosImageSaver";
  overlay.innerHTML = `<div class="ios-image-saver-bar"><button type="button" aria-label="关闭图片预览">关闭</button><div><b>保存到 iPhone 相册</b><span>长按下方图片，选择“存储到照片”</span></div></div><img src="${imageUrl}" alt="收藏墙长图，请长按保存到照片" />`;
  document.body.append(overlay);
  overlay.querySelector("button")?.addEventListener("click", () => overlay.remove());
  showToast("请长按收藏墙图片并选择“存储到照片”");
}

function bindCollectionWallEvents() {
  content.querySelector("#wallYear")?.addEventListener("change", (event) => {
    state.wallYear = event.target.value;
    state.wallGenerated = false;
    releaseWallImage();
    render();
  });
  content.querySelector("#wallCategory")?.addEventListener("change", (event) => {
    state.wallCategory = event.target.value;
    state.wallGenerated = false;
    releaseWallImage();
    render();
  });
  content.querySelector("#generateWall")?.addEventListener("click", startWallLoading);
  content.querySelector("#openWallImage")?.addEventListener("click", () => {
    if (state.wallImageUrl) window.open(state.wallImageUrl, "_blank", "noopener,noreferrer");
  });
  content.querySelector("#saveWall")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "正在准备图片…";
    try { await saveCollectionWall(); }
    catch (error) { if (error?.name !== "AbortError") showToast("图片保存失败，请稍后重试"); }
    finally {
      event.currentTarget.disabled = false;
      event.currentTarget.innerHTML = '<i data-lucide="image-down"></i>保存到相册';
      window.lucide?.createIcons?.();
    }
  });
  if (state.wallLoading) {
    const records = wallRecords();
    let checked = 0;
    window.clearInterval(bindCollectionWallEvents.progressTimer);
    bindCollectionWallEvents.progressTimer = window.setInterval(() => {
      if (state.route !== "collection-wall") return window.clearInterval(bindCollectionWallEvents.progressTimer);
      checked = Math.min(records.length, checked + Math.max(1, Math.ceil(records.length / 22)));
      const covers = records.slice(0, checked).filter(getRecordImage).length;
      const percent = records.length ? Math.round(checked / records.length * 100) : 100;
      const loadingText = content.querySelector("#wallLoadingText");
      const progressBar = content.querySelector("#wallProgressBar");
      const progressCart = content.querySelector("#wallProgressCart");
      const progressPercent = content.querySelector("#wallProgressPercent");
      const progressCount = content.querySelector("#wallProgressCount");
      if (loadingText) loadingText.textContent = `已检查 ${checked}/${records.length} 件，${covers} 张封面可以上墙`;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressCart) progressCart.style.left = `${Math.max(1, percent - 4)}%`;
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (progressCount) progressCount.textContent = `${covers} / ${records.length} 张封面就位`;
      if (checked >= records.length) {
        window.clearInterval(bindCollectionWallEvents.progressTimer);
        const loadingText = content.querySelector("#wallLoadingText");
        const progressCount = content.querySelector("#wallProgressCount");
        if (loadingText) loadingText.textContent = `封面检查完成，正在合成收藏墙图片…`;
        if (progressCount) progressCount.textContent = `已就位 ${covers} 张封面`;
        window.setTimeout(async () => {
          if (state.route !== "collection-wall") return;
          try {
            state.wallImageUrl = await createCollectionWallImage();
            state.wallGenerated = Boolean(state.wallImageUrl);
          } catch {
            state.wallImageUrl = "";
            state.wallGenerated = false;
            showToast("收藏墙图片生成失败，请重试");
          } finally {
            state.wallLoading = false;
            render();
          }
        }, 180);
      }
    }, records.length ? 125 : 500);
  }
}

function bindViewEvents() {
  bindCommonButtons();
  if (state.route === "life") bindLifeEvents();
  if (state.route === "collection") bindCollectionEvents();
  if (state.route === "profile") bindProfileEvents();
  if (state.route === "collection-wall") bindCollectionWallEvents();
  if (state.route === "add") bindAddEvents();
  if (state.route === "life-add") bindLifeAddEvents();
}

async function hydrateProfileSnapshot() {
  try {
    const session = await fetch("../api-snapshots/app-session.json").then((response) => response.json());
    if (session.user) state.profile = { ...session.user, authenticated: session.authenticated };
    if (state.route === "profile") render();
  } catch {}
}

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");
  if (button) navigate(button.dataset.route);
});
floatingAdd.addEventListener("click", () => navigate(state.route === "life" ? "life-add" : "add"));
headerBack.addEventListener("click", () => {
  state.editingId = "";
  state.editingExpenseId = "";
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
hydrateProfileSnapshot();
if ("requestIdleCallback" in window) window.requestIdleCallback(compactLegacyStorageOnce, { timeout: 3000 });
else window.setTimeout(compactLegacyStorageOnce, 1200);
