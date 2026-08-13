const STORAGE_KEY = "hangar07-collection-v1";
const BACKUP_KEY = "hangar07-backups-v1";
const PENDING_SYNC_KEY = "hangar07-pending-sync-v1";
const THEME_KEY = "hangar07-theme-v1";
const IMAGE_MATCH_ENDPOINT = "./api/image-match";
const IMAGE_MATCH_OPTIONS_ENDPOINT = "./api/image-match/options";
const IMAGE_MATCH_SELECT_ENDPOINT = "./api/image-match/select";
const UPLOAD_IMAGE_ENDPOINT = "./api/upload-image";
const RECORDS_ENDPOINT = "./api/records";
const CATALOG_FROM_RECORD_ENDPOINT = "./api/catalog/from-record";
const CATALOG_GUNDAM_NORMALIZE_ENDPOINT = "./api/catalog/normalize/gundam";
const ADMIN_OVERVIEW_ENDPOINT = "./api/admin/overview";
const ADMIN_UPDATES_ENDPOINT = "./api/admin/updates";
const ADMIN_PICKUP_FEEDBACK_ENDPOINT = "./api/admin/pickup-feedback";
const ADMIN_PICKUP_SUBMISSION_ENDPOINT = "./api/admin/pickup-submissions";
const ADMIN_CATALOG_FEEDBACK_ENDPOINT = "./api/admin/catalog-feedback";
const ADMIN_CONTRIBUTIONS_ENDPOINT = "./api/admin/contributions";
const ADMIN_CATALOG_SUBMISSIONS_ENDPOINT = "./api/admin/catalog-submissions";
const CONTRIBUTIONS_MINE_ENDPOINT = "./api/contributions/mine";
const ADMIN_WEIBO_LOGIN_ENDPOINT = "./api/admin/weibo-login";
const ACCESS_SUMMARY_ENDPOINT = "./api/access/summary";
const ADMIN_ACCOUNT_PAGE_SIZE = 20;
const CATALOG_ENDPOINT = "./api/catalog";
const NEWS_ENDPOINT = "./api/news";
const INFO_REVIEW_ENDPOINT = "./api/admin/info-review";
const INFO_ARTICLES_ADMIN_ENDPOINT = "./api/admin/info-articles";
const INFO_SOURCES_ENDPOINT = "./api/admin/info-sources";
const SESSION_ENDPOINT = "./api/auth/session";
const LOGOUT_ENDPOINT = "./api/auth/logout";
const EMAIL_SEND_ENDPOINT = "./api/auth/email/send";
const BIND_EMAIL_ENDPOINT = "./api/account/bind-email";
const SERVER_SYNC_TIMEOUT_MS = 6000;
const PREORDER_STAGE_PAYMENT = "payment";
const PREORDER_STAGE_ARRIVAL = "arrival";
const PICKUP_FEATURE_ENABLED = true;
const ACCOUNT_SECURITY_UI_ENABLED = true;
const JPY_TO_CNY_RATE = 0.05;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const requestUrl = new URL(typeof input === "string" ? input : input.url, document.baseURI);
  const method = String(init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
  const apiPath = requestUrl.pathname.slice(requestUrl.pathname.indexOf("/api/"));
  const snapshots = [
    [/^\/api\/auth\/session$/, "./api-snapshots/app-session.json"],
    [/^\/api\/records$/, "./api-snapshots/records.json"],
    [/^\/api\/news\/channels$/, "./api-snapshots/news-channels.json"],
    [/^\/api\/news$/, "./api-snapshots/news.json"],
    [/^\/api\/catalog\/facets$/, "./api-snapshots/catalog-facets.json"],
    [/^\/api\/catalog(?:\/search)?$/, "./api-snapshots/app-catalog.json"],
    [/^\/api\/contributions\/mine$/, "./api-snapshots/contributions-mine.json"],
    [/^\/api\/pickups\/brands$/, "./api-snapshots/pickup-brands.json"],
    [/^\/api\/pickups$/, "./api-snapshots/pickups.json"],
  ];
  if (method === "GET") {
    const snapshot = snapshots.find(([pattern]) => pattern.test(apiPath));
    if (snapshot) input = snapshot[1];
  } else if (apiPath.startsWith("/api/")) {
    return Promise.resolve(new Response(JSON.stringify({ error: "read_only_copy", message: "公开演示站为只读模式" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" },
    }));
  }
  const headers = new Headers(init?.headers || {});
  if (!headers.has("X-Client-Type")) headers.set("X-Client-Type", "web");
  return nativeFetch(input, { ...init, headers });
};
let catalogSummarySeq = 0;
let accountStatus = null;
let bindEmailCodeTimer = 0;
const currentYear = new Date().getFullYear();
const COLLECTION_CATEGORIES = [
  { name: "高达模型", icon: "bot", thumbClass: "gundam" },
  { name: "机娘", icon: "sparkles", thumbClass: "mecha-girl" },
  { name: "兵人/人偶", icon: "person-standing", thumbClass: "figure" },
  { name: "变形金刚", icon: "repeat-2", thumbClass: "transformers" },
];
const LEGACY_COLLECTION_CATEGORIES = [
  { name: "乐高/积木", icon: "blocks", thumbClass: "lego" },
  { name: "手办/雕像", icon: "gem", thumbClass: "statue" },
  { name: "车模/载具", icon: "car", thumbClass: "vehicle" },
  { name: "盲盒/潮玩", icon: "package", thumbClass: "blindbox" },
];
const CATEGORY_META = Object.fromEntries([...COLLECTION_CATEGORIES, ...LEGACY_COLLECTION_CATEGORIES].map((category) => [category.name, category]));

const productImages = {
  "rg 00 七剑高达": "./assets/products/rg-00-seven-sword.webp",
  "inart 里夫超人 双人套装": "./assets/products/inart-reeve-superman.png",
  "真骨雕凯撒": "./assets/products/shf-kaixa.jpg",
  "inart 金雳": "./assets/products/inart-gimli.jpg",
  "hottoys 极速追杀 john wick 胶发": "./assets/products/hottoys-john-wick-artisan.jpg",
  "threezero dlx 钢铁侠mk85": "./assets/products/threezero-mk85.jpg",
  "hottoys 钢铁侠mk43普通版": "./assets/products/hottoys-mk43.jpg",
  "万达mb 马甲e": "./assets/products/metal-build-gn-arms-e.jpg",
  "共鸣 缄默超人": "./assets/products/gong-hush-superman.jpg",
  "冰感工作室 粉碎者-狂蟒突击队": "./assets/products/sexyice-crusher.jpg?v=2",
  "inart大本蝙蝠侠": "./assets/products/inart-bvs-batman.jpg",
  "闪回 黑超人1/12": "./assets/products/flashback-black-superman.jpg",
  "万代mg 杰斯塔bc班": "./assets/products/mg-jesta-bc.webp",
  "冰感工作室 扎塔德猎犬x3": "./assets/products/sexyice-zatard-hound.png",
  "摩动核 吕布": "./assets/products/motor-nuclear-lubu.png",
};

const sampleRecords = [
  {
    id: "a01",
    name: "MGEX 强袭自由高达",
    category: "高达模型",
    series: "BANDAI / MGEX 1:100",
    status: "已入库",
    price: 1420,
    paid: 1420,
    date: "2026-01-18",
    dueDate: "",
  },
  {
    id: "a02",
    name: "RX-93 v 高达 Ver.Ka",
    category: "高达模型",
    series: "BANDAI / MG 1:100",
    status: "已入库",
    price: 690,
    paid: 690,
    date: "2026-02-08",
    dueDate: "",
  },
  {
    id: "a03",
    name: "沙漠战术小队队长",
    category: "兵人/人偶",
    series: "JOYTOY / 1:18",
    status: "已入库",
    price: 388,
    paid: 388,
    date: "2026-03-12",
    dueDate: "",
  },
  {
    id: "a04",
    name: "METAL BUILD 命运高达",
    category: "高达模型",
    series: "METAL BUILD / 成品",
    status: "预定中",
    price: 2380,
    paid: 300,
    date: "2026-03-26",
    dueDate: "2026-06-18",
  },
  {
    id: "a05",
    name: "城市反恐突击队双人组",
    category: "兵人/人偶",
    series: "DAMTOYS / 1:6",
    status: "预定中",
    price: 2960,
    paid: 600,
    date: "2026-04-11",
    dueDate: "2026-08-15",
  },
  {
    id: "a06",
    name: "机库整备平台场景套件",
    category: "高达模型",
    series: "核诚治造 / 1:100",
    status: "已入库",
    price: 479,
    paid: 479,
    date: "2026-04-21",
    dueDate: "",
  },
  {
    id: "a07",
    name: "解体匠机 RX-93 专用武装包",
    category: "高达模型",
    series: "STRUCTURE / 配件包",
    status: "预定中",
    price: 1680,
    paid: 200,
    date: "2026-05-03",
    dueDate: "2026-07-28",
  },
  {
    id: "a08",
    name: "重装特勤支援兵",
    category: "兵人/人偶",
    series: "JOYTOY / 1:18",
    status: "已入库",
    price: 326,
    paid: 326,
    date: "2026-05-16",
    dueDate: "",
  },
];

let records = [];
let activeStatus = "全部";
let activeCategory = "全部";
let activeView = "dashboard";
let searchTerm = "";
let selectedYear = currentYear;
let editingRecordId = "";
let serverSyncReady = false;
let recordSyncQueue = Promise.resolve();
let collectionVersion = null;
let recordSyncGeneration = 0;
let preorderTaskSaving = null;
let currentUsername = "";
let newsState = { category: "", search: "", items: [], loading: false, wishOnly: false, discover: false, hasSubscriptions: false };
const NEWS_CHANNELS_ENDPOINT = "./api/news/channels";
const NEWS_SUBS_ENDPOINT = "./api/news/subscriptions";
let newsModalImages = [];
let dashboardNewsItems = [];
const newsWish = new Set(JSON.parse(localStorage.getItem("news_wish") || "[]"));
function saveWish() { try { localStorage.setItem("news_wish", JSON.stringify([...newsWish])); } catch {} }
function updateWishCount() {
  const el = document.querySelector("#newsWishCount");
  if (el) el.textContent = String(newsWish.size);
  document.querySelector("#newsWishBtn")?.classList.toggle("has-wish", newsWish.size > 0);
}
function toggleWish(id, btn) {
  if (!id) return;
  const has = newsWish.has(id);
  if (has) newsWish.delete(id); else { newsWish.add(id); showToast?.("已加入想要清单"); }
  document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => b.classList.toggle("on", !has));
  saveWish();
  updateWishCount();
  if (newsState.wishOnly) renderNews();
}
// 资讯详情站内弹层（点卡片打开，不跳转外部）
function openNewsModal(item) {
  const m = document.querySelector("#newsModal");
  if (!m || !item) return;
  const rawImages = normalizeNewsImageUrls(item.imageUrls || []);
  const previewImages = rawImages.map((url) => newsImageUrl(url, "full"));
  newsModalImages = previewImages;
  const image = rawImages[0] ? newsImageUrl(rawImages[0], "hero") : "";
  const imgWrap = document.querySelector("#newsModalImgWrap");
  const img = document.querySelector("#newsModalImg");
  if (image && imgWrap && img) { img.src = image; imgWrap.hidden = false; }
  else if (imgWrap) imgWrap.hidden = true;
  const cat = item.category || "new_release";
  const tag = document.querySelector("#newsModalTag");
  if (tag) { tag.textContent = newsCategoryLabels[cat] || cat; tag.className = `news-tag tag-${cat}`; }
  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
  set("#newsModalSrc", item.sourceName || "");
  set("#newsModalDate", infoDate(item.publishedAt || item.createdAt));
  set("#newsModalTitle", item.title || "");
  set("#newsModalSummary", item.summary || "");
  const gallery = document.querySelector("#newsModalGallery");
  if (gallery) {
    gallery.innerHTML = rawImages.slice(0, 13).map((url, index) => {
      const thumb = newsImageUrl(url, "thumb");
      const hero = newsImageUrl(url, "hero");
      const full = newsImageUrl(url, "full");
      return `
      <button type="button" class="news-gallery-item${index === 0 ? " active" : ""}" data-news-img="${escapeHtml(full)}" data-news-hero="${escapeHtml(hero)}" aria-label="查看图片 ${index + 1}">
        <img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.news-gallery-item').remove()" />
      </button>`;
    }).join("");
    gallery.hidden = rawImages.length <= 1;
  }
  const text = document.querySelector("#newsModalText");
  if (text) text.innerHTML = renderNewsArticleBody(item);
  const src = document.querySelector("#newsModalSource");
  if (src) src.href = item.sourceUrl || "#";
  const wb = document.querySelector("#newsModalWish");
  if (wb) { wb.dataset.wish = item.id; wb.classList.toggle("on", newsWish.has(item.id)); }
  m.hidden = false;
  m.scrollTop = 0;
  window.lucide?.createIcons?.();
}
function closeNewsModal() { const m = document.querySelector("#newsModal"); if (m) m.hidden = true; }
document.querySelector("#newsModalClose")?.addEventListener("click", closeNewsModal);
document.querySelector("#newsModal")?.addEventListener("click", (e) => { if (e.target.id === "newsModal") closeNewsModal(); });
document.querySelector("#newsModalWish")?.addEventListener("click", (e) => toggleWish(e.currentTarget.dataset.wish, e.currentTarget));
document.querySelector("#newsModalGallery")?.addEventListener("click", (e) => {
  const button = e.target.closest("[data-news-img]");
  if (!button) return;
  const img = document.querySelector("#newsModalImg");
  if (img) img.src = button.dataset.newsHero || button.dataset.newsImg;
  document.querySelectorAll("#newsModalGallery [data-news-img]").forEach((item) => item.classList.toggle("active", item === button));
  const items = newsModalImages.length ? newsModalImages : [...document.querySelectorAll("#newsModalGallery [data-news-img]")].map((item) => item.dataset.newsImg).filter(Boolean);
  const index = Math.max(0, items.indexOf(button.dataset.newsImg));
  openImagePreview(button.dataset.newsImg, "左右滑动或方向键切换 · 点空白处关闭", { direct: true, items, index });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.querySelector("#imgPreview")?.hidden !== false) closeNewsModal();
});
document.querySelector("#newsList")?.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest("[data-info-delete]");
  if (deleteBtn) {
    e.preventDefault();
    e.stopPropagation();
    const card = deleteBtn.closest("[data-id]");
    const title = card?.querySelector("h3")?.textContent?.trim() || "这条资讯";
    confirmDialog(`删除「${title}」？删除后前台不再显示。`, { title: "删除资讯", confirmText: "删除" })
      .then((ok) => (ok ? deleteInfoArticleById(deleteBtn.dataset.infoDelete) : false))
      .catch(() => showToast("删除失败，请重试"));
    return;
  }
  const wishBtn = e.target.closest("[data-wish]");
  if (wishBtn) { e.preventDefault(); toggleWish(wishBtn.dataset.wish, wishBtn); return; }
  const card = e.target.closest(".news-card");
  if (card) { const item = newsState.items.find((x) => x.id === card.dataset.id); if (item) openNewsModal(item); }
});
document.querySelector("#newsWishBtn")?.addEventListener("click", () => {
  newsState.wishOnly = !newsState.wishOnly;
  document.querySelector("#newsWishBtn")?.classList.toggle("active", newsState.wishOnly);
  renderNews();
});
document.querySelector("#newsSubBtn")?.addEventListener("click", openNewsSubModal);
document.querySelector("#newsSubBannerBtn")?.addEventListener("click", openNewsSubModal);
document.querySelector("#newsSubClose")?.addEventListener("click", closeNewsSubModal);
document.querySelector("#newsSubModal")?.addEventListener("click", (event) => { if (event.target.id === "newsSubModal") closeNewsSubModal(); });
document.querySelector("#newsSubSave")?.addEventListener("click", saveNewsSubs);
document.querySelector("#newsSubClear")?.addEventListener("click", () => {
  document.querySelectorAll("#newsSubList input[type=checkbox]").forEach((i) => { i.checked = false; });
});
document.querySelector("#newsSubSearch")?.addEventListener("input", (event) => filterNewsSubList(event.target.value));
document.querySelector("#newsScope")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-news-scope]");
  if (!button) return;
  newsState.discover = button.dataset.newsScope === "all";
  renderNews();
});
document.querySelector("#dashboardNewsList")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-dashboard-news]");
  if (!card) return;
  const item = dashboardNewsItems.find((entry) => entry.id === card.dataset.dashboardNews);
  if (item) openNewsModal(item);
});
document.querySelector("#dashboardNewsMore")?.addEventListener("click", () => {
  selectNav("news");
  renderAll();
  renderNews();
  setSidebarOpen(false);
});

function normalizeNewsImageUrls(values = []) {
  const seen = new Set();
  const items = [];
  for (const value of values) {
    const original = String(value || "").trim();
    if (!original || seen.has(original)) continue;
    const promoted = promoteImageUrl(original);
    for (const url of [promoted, original]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push(url);
    }
  }
  return items.sort((a, b) => imageQualityScore(b) - imageQualityScore(a)).slice(0, 20);
}

function normalizeNewsImages(values = [], variant = "thumb") {
  return normalizeNewsImageUrls(values).map((url) => newsImageUrl(url, variant));
}

function newsImageUrl(url, variant = "thumb") {
  return proxyHotlinkImage(sizedNewsImageUrl(url, variant));
}

function sizedNewsImageUrl(url, variant = "thumb") {
  const raw = String(url || "");
  if (!/^https?:\/\/[^/]*(?:sinaimg\.cn|sina\.com\.cn)\//i.test(raw)) return raw;
  const size = variant === "full" ? "" : variant === "hero" ? "mw690" : "orj360";
  if (!size) return raw;
  return raw.replace(/^(https?:\/\/[^/]+\/)(?:large|mw2000|mw1024|mw690|bmiddle|orj360|thumb\d+)\//i, `$1${size}/`);
}

// 新浪/微博图床有防盗链：外站 referer 会被 403（img 的 referrerpolicy 在本场景挡不住），
// 改走自家服务端代理（服务器无 referer 回源 = 200）。
function proxyHotlinkImage(url) {
  const raw = String(url || "");
  if (/^https?:\/\/[^/]*sinaimg\.cn\//i.test(raw) || /^https?:\/\/[^/]*sina\.com\.cn\//i.test(raw)) {
    return `./api/img-proxy?u=${encodeURIComponent(raw)}`;
  }
  return raw;
}

function promoteImageUrl(url) {
  return String(url || "").replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp|gif))(?:$|[?#])/i, "$1");
}

function imageQualityScore(url) {
  const text = String(url || "").toLowerCase();
  let score = 0;
  if (/\.(?:jpe?g|png|webp)(?:$|[?#])/.test(text)) score += 10;
  if (/-\d{2,4}x\d{2,4}\.(?:jpe?g|png|webp)/.test(text)) score -= 12;
  if (/\/thumbnail\//.test(text)) score -= 10;
  if (/\/wonfes\/reserve\/|\/img\/|\/storage\/images\/products\//.test(text)) score += 6;
  if (/400x|200x|150x|thumb|logo|favicon/.test(text)) score -= 6;
  return score;
}

function renderNewsArticleBody(item) {
  const body = String(item.body || item.summary || "").trim();
  const sourceLine = item.sourceName ? `来源：${item.sourceName}` : "";
  const sourceUrlLine = item.sourceUrl ? `原文：${item.sourceUrl}` : "";
  const lines = body
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-•·■]+/, "").trim())
    .filter(Boolean)
    .filter((line) => line !== sourceLine && line !== sourceUrlLine && !/^原文[:：]\s*https?:\/\//i.test(line));
  if (!lines.length) return `<p>${escapeHtml(item.summary || "暂无正文，请查看官方来源。")}</p>`;
  return lines.map((line) => {
    const bracket = line.match(/^【([^】]{1,12})】\s*(.+)$/);
    const colon = line.match(/^([^：:]{2,14})[：:]\s*(.+)$/);
    const numbered = line.match(/^\d+[.、]\s*(.+)$/);
    if (bracket || colon) {
      const label = bracket?.[1] || colon?.[1] || "";
      const value = bracket?.[2] || colon?.[2] || "";
      return `<div class="news-detail-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`;
    }
    return `<p>${escapeHtml(numbered?.[1] || line)}</p>`;
  }).join("");
}
let infoReviewState = { items: [], sources: [], loading: false };

const ui = {
  yearSelect: document.querySelector("#yearSelect"),
  heroYear: document.querySelector("#heroYear"),
  annualTotal: document.querySelector("#annualTotal"),
  heroItems: document.querySelector("#heroItems"),
  heroPreorders: document.querySelector("#heroPreorders"),
  collectionCount: document.querySelector("#collectionCount"),
  preorderCount: document.querySelector("#preorderCount"),
  purchaseCount: document.querySelector("#purchaseCount"),
  purchaseValue: document.querySelector("#purchaseValue"),
  trackingCount: document.querySelector("#trackingCount"),
  depositValue: document.querySelector("#depositValue"),
  balanceValue: document.querySelector("#balanceValue"),
  balanceHint: document.querySelector("#balanceHint"),
  reserveHint: document.querySelector("#reserveHint"),
  chartBars: document.querySelector("#chartBars"),
  calendarGrid: document.querySelector("#calendarGrid"),
  recordList: document.querySelector("#recordList"),
  emptyState: document.querySelector("#emptyState"),
  paymentList: document.querySelector("#paymentList"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  recordForm: document.querySelector("#recordForm"),
  statusField: document.querySelector("#statusField"),
  modalKicker: document.querySelector("#modalKicker"),
  modalTitle: document.querySelector("#modalTitle"),
  submitRecordButton: document.querySelector("#submitRecordButton"),
  submitRecordLabel: document.querySelector("#submitRecordLabel"),
  viewLabel: document.querySelector("#viewLabel"),
  viewKicker: document.querySelector("#viewKicker"),
  viewTitle: document.querySelector("#viewTitle"),
  viewDescription: document.querySelector("#viewDescription"),
  viewCount: document.querySelector("#viewCount"),
  toast: document.querySelector("#toast"),
  backupStatus: document.querySelector("#backupStatus"),
  backupPayload: document.querySelector("#backupPayload"),
  importFile: document.querySelector("#importFile"),
  recognizeBtn: document.querySelector("#recognizeImageBtn"),
  recognizeLabel: document.querySelector("#recognizeImageLabel"),
  recognizeHint: document.querySelector("#recognizeHint"),
  recognizeOptions: document.querySelector("#recognizeOptions"),
  databaseStateTitle: document.querySelector("#databaseStateTitle"),
  databaseStateHint: document.querySelector("#databaseStateHint"),
  accountAvatarChip: document.querySelector("#accountAvatarChip"),
  accountAvatar: document.querySelector("#accountAvatar"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  accountSecurityNotice: document.querySelector("#accountSecurityNotice"),
  accountSecurityTitle: document.querySelector("#accountSecurityTitle"),
  accountSecurityText: document.querySelector("#accountSecurityText"),
  openAccountSecurity: document.querySelector("#openAccountSecurity"),
  accountSecurityModal: document.querySelector("#accountSecurityModal"),
  accountSecurityClose: document.querySelector("#accountSecurityClose"),
  bindEmailForm: document.querySelector("#bindEmailForm"),
  sendBindEmailCode: document.querySelector("#sendBindEmailCode"),
  emailBindStatus: document.querySelector("#emailBindStatus"),
  themeToggle: document.querySelector("#themeToggle"),
  adminNav: document.querySelector("#adminNav"),
  adminPanel: document.querySelector("#adminPanel"),
  adminSummary: document.querySelector("#adminSummary"),
  adminCatalogOps: document.querySelector("#adminCatalogOps"),
  adminNewsOps: document.querySelector("#adminNewsOps"),
  adminFeedbackOps: document.querySelector("#adminFeedbackOps"),
  adminContributionOps: document.querySelector("#adminContributionOps"),
  adminCatalogSubmissionOps: document.querySelector("#adminCatalogSubmissionOps"),
  adminPickupSubmissions: document.querySelector("#adminPickupSubmissions"),
  adminAccessSummary: document.querySelector("#adminAccessSummary"),
  adminTableBody: document.querySelector("#adminTableBody"),
  adminAccountPager: document.querySelector("#adminAccountPager"),
  adminRefresh: document.querySelector("#adminRefresh"),
  adminUpdateForm: document.querySelector("#adminUpdateForm"),
  adminUpdateList: document.querySelector("#adminUpdateList"),
  contributionPanel: document.querySelector("#contributionPanel"),
  contributionRefresh: document.querySelector("#contributionRefresh"),
  contributionRankCard: document.querySelector("#contributionRankCard"),
  contributionNoticeCard: document.querySelector("#contributionNoticeCard"),
  contributionBadgeCard: document.querySelector("#contributionBadgeCard"),
  contributionRecordList: document.querySelector("#contributionRecordList"),
  contributionRecordCount: document.querySelector("#contributionRecordCount"),
  contributionBadgeTooltip: document.querySelector("#contributionBadgeTooltip"),
  infoReviewNav: document.querySelector("#infoReviewNav"),
  newsPanel: document.querySelector("#newsPanel"),
  newsList: document.querySelector("#newsList"),
  newsEmpty: document.querySelector("#newsEmpty"),
  newsSearch: document.querySelector("#newsSearch"),
  newsCats: document.querySelector("#newsCats"),
  dashboardNewsRail: document.querySelector("#dashboardNewsRail"),
  dashboardNewsList: document.querySelector("#dashboardNewsList"),
  dashboardNewsMore: document.querySelector("#dashboardNewsMore"),
  infoReviewPanel: document.querySelector("#infoReviewPanel"),
  infoReviewRefresh: document.querySelector("#infoReviewRefresh"),
  infoReviewList: document.querySelector("#infoReviewList"),
  infoReviewEmpty: document.querySelector("#infoReviewEmpty"),
  infoSourceForm: document.querySelector("#infoSourceForm"),
  infoSourceList: document.querySelector("#infoSourceList"),
};

function applyFeatureFlags() {
  if (PICKUP_FEATURE_ENABLED) {
    document.querySelectorAll('[data-view="pickup"]').forEach((node) => { node.hidden = false; });
    return;
  }
  document.querySelectorAll('[data-view="pickup"], #pickupPanel, #pickupModal, #pickupUploadModal, #pickupEditModal, #pickupZoom').forEach((node) => node.remove());
}
applyFeatureFlags();

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

function applyTheme(theme, { animate = false } = {}) {
  const nextTheme = theme === "night" ? "night" : "day";
  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "night" ? "#0d0d0d" : "#f2eee6");
  if (ui.themeToggle) {
    const isNight = nextTheme === "night";
    ui.themeToggle.setAttribute("aria-pressed", String(isNight));
    ui.themeToggle.setAttribute("aria-label", isNight ? "切换日间模式" : "切换夜间模式");
    ui.themeToggle.setAttribute("title", isNight ? "切换日间模式" : "切换夜间模式");
    ui.themeToggle.innerHTML = `<i data-lucide="${isNight ? "sun" : "moon"}"></i><span>${isNight ? "日间" : "夜间"}</span>`;
  }
  if (animate) {
    document.body.classList.remove("theme-shift");
    window.requestAnimationFrame(() => {
      document.body.classList.add("theme-shift");
      window.setTimeout(() => document.body.classList.remove("theme-shift"), 760);
    });
  }
  window.lucide?.createIcons?.();
}

let isAdmin = false;

function scopedStorageKey(baseKey) {
  return currentUsername ? `${baseKey}:${currentUsername.toLowerCase()}` : baseKey;
}

function normalizeCategory(category = "", record = {}) {
  if (CATEGORY_META[category]) return category;
  const haystack = `${record.name || ""} ${record.series || ""} ${category}`.toLowerCase();
  if (/机娘|美少女拼装|30ms|30\s*minutes\s*sisters|megami\s*device|女神装置|frame\s*arms\s*girl|fag\b|机甲少女|武装神姬|chitocerium|act\s*mode|dark\s*advent|创彩少女|sousai/i.test(haystack)) return "机娘";
  if (/变形金刚|transformers|optimus|megatron|擎天柱|威震天|mp[-\s]?\d|ss[-\s]?\d/i.test(haystack)) return "变形金刚";
  if (/兵人|人偶|hot\s*toys|inart|damtoys|joytoy|threezero|1:6|1\/6|1:12|1\/12|figure/i.test(haystack)) return "兵人/人偶";
  return "高达模型";
}

function ensureCategoryOption(select, value) {
  if (!select || !value) return;
  if ([...select.options].some((option) => option.value === value || option.text === value)) return;
  select.add(new Option(value, value));
}

function recordQuantity(record = {}) {
  const value = Math.floor(Number(record.quantity ?? 1));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function totalQuantity(source = []) {
  return source.reduce((sum, record) => sum + recordQuantity(record), 0);
}

function preorderStageFromAmounts(price, paid) {
  const total = Number(price);
  const settled = Number(paid);
  return Number.isFinite(total) && total > 0 && (!Number.isFinite(settled) || settled < total)
    ? PREORDER_STAGE_PAYMENT
    : PREORDER_STAGE_ARRIVAL;
}

function preorderStage(record = {}) {
  if (record.status !== "预定中") return "";
  const explicit = String(record.preorderStage || "").trim();
  if ([PREORDER_STAGE_PAYMENT, "payment_pending"].includes(explicit)) return PREORDER_STAGE_PAYMENT;
  if ([PREORDER_STAGE_ARRIVAL, "arrival_pending"].includes(explicit)) return PREORDER_STAGE_ARRIVAL;
  return preorderStageFromAmounts(record.price, record.paid);
}

function isPaymentPreorder(record = {}) {
  return preorderStage(record) === PREORDER_STAGE_PAYMENT;
}

function isArrivalPreorder(record = {}) {
  return preorderStage(record) === PREORDER_STAGE_ARRIVAL;
}

function preorderBalance(record = {}) {
  if (!isPaymentPreorder(record)) return 0;
  const price = Number(record.price);
  const paid = Number(record.paid);
  return Math.max(0, (Number.isFinite(price) ? price : 0) - (Number.isFinite(paid) ? paid : 0));
}

function preorderStageLabel(record = {}) {
  if (record.status !== "预定中") return record.status || "";
  return isArrivalPreorder(record) ? "待到货" : "待补款";
}

function localDateText(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function completePreorderTask(record = {}, stage = preorderStage(record), completedAt = new Date()) {
  if (record.status !== "预定中" || preorderStage(record) !== stage) return record;
  const completed = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const timestamp = completed.toISOString();
  const price = Math.max(0, Number(record.price) || 0);
  if (stage === PREORDER_STAGE_PAYMENT) {
    return {
      ...record,
      paid: price,
      preorderStage: PREORDER_STAGE_ARRIVAL,
      paymentCompletedAt: record.paymentCompletedAt || timestamp,
      paymentCompletedDate: record.paymentCompletedDate || localDateText(completed),
    };
  }
  if (stage === PREORDER_STAGE_ARRIVAL) {
    return {
      ...record,
      status: "已入库",
      paid: price,
      date: localDateText(completed),
      preorderStage: "",
      arrivalCompletedAt: record.arrivalCompletedAt || timestamp,
    };
  }
  return record;
}

function applyPreorderLifecycleTimestamps(nextRecord, existingRecord = null, completedAt = new Date()) {
  const next = { ...nextRecord };
  const completed = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const timestamp = completed.toISOString();
  const completedDate = localDateText(completed);
  const previousStage = preorderStage(existingRecord || {});
  const nextStage = preorderStage(next);

  if (next.status === "预定中") {
    // Active preorders always belong to a new or unfinished arrival lifecycle.
    next.arrivalCompletedAt = "";
    if (nextStage === PREORDER_STAGE_PAYMENT) {
      next.paymentCompletedAt = "";
      next.paymentCompletedDate = "";
    } else {
      const continuingArrival = existingRecord?.status === "预定中" && previousStage === PREORDER_STAGE_ARRIVAL;
      next.paymentCompletedAt = continuingArrival && existingRecord.paymentCompletedAt
        ? existingRecord.paymentCompletedAt
        : timestamp;
      next.paymentCompletedDate = continuingArrival
        ? existingRecord.paymentCompletedDate || String(existingRecord.paymentCompletedAt || "").slice(0, 10) || completedDate
        : completedDate;
    }
    return next;
  }

  if (next.status === "已入库" && existingRecord?.status === "预定中") {
    if (previousStage === PREORDER_STAGE_ARRIVAL) {
      next.paymentCompletedAt = existingRecord.paymentCompletedAt || timestamp;
      next.paymentCompletedDate = existingRecord.paymentCompletedDate
        || String(existingRecord.paymentCompletedAt || "").slice(0, 10)
        || completedDate;
    } else {
      next.paymentCompletedAt = timestamp;
      next.paymentCompletedDate = completedDate;
    }
    next.arrivalCompletedAt = timestamp;
  } else if (next.status === "已入库" && existingRecord?.status === "已入库") {
    for (const field of ["paymentCompletedAt", "paymentCompletedDate", "arrivalCompletedAt"]) {
      if (existingRecord[field] !== undefined) next[field] = existingRecord[field];
    }
  }
  return next;
}

function normalizeRecord(record) {
  const normalized = {
    ...record,
    category: normalizeCategory(record.category, record),
    quantity: recordQuantity(record),
  };
  normalized.preorderStage = normalized.status === "预定中" ? preorderStage(normalized) : "";
  return normalized;
}

function normalizeRecords(nextRecords = []) {
  return Array.isArray(nextRecords) ? nextRecords.map(normalizeRecord) : [];
}

function loadRecords() {
  const saved = localStorage.getItem(scopedStorageKey(STORAGE_KEY));
  return normalizeRecords(saved ? JSON.parse(saved) : structuredClone(sampleRecords));
}

function loadLocalRecords() {
  try {
    const saved = localStorage.getItem(scopedStorageKey(STORAGE_KEY));
    return saved ? normalizeRecords(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

function getPendingSync() {
  try {
    return JSON.parse(localStorage.getItem(scopedStorageKey(PENDING_SYNC_KEY)) || "null");
  } catch {
    return null;
  }
}

function normalizedCollectionVersion(value) {
  if (value === null || value === undefined || value === "") return null;
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

function setCollectionVersion(value) {
  const version = normalizedCollectionVersion(value);
  if (version == null) throw new Error("record response missing collection version");
  collectionVersion = version;
  return version;
}

function markPendingSync(snapshot, reason) {
  localStorage.setItem(
    scopedStorageKey(PENDING_SYNC_KEY),
    JSON.stringify({ records: snapshot, reason, savedAt: new Date().toISOString() }),
  );
}

function markPendingSyncConflict(serverVersion) {
  const pending = getPendingSync();
  if (!Array.isArray(pending?.records)) return;
  localStorage.setItem(
    scopedStorageKey(PENDING_SYNC_KEY),
    JSON.stringify({
      ...pending,
      conflict: true,
      conflictAt: new Date().toISOString(),
      serverVersion,
    }),
  );
}

function clearPendingSync(snapshot) {
  const pending = getPendingSync();
  if (pending && JSON.stringify(pending.records) === JSON.stringify(snapshot)) {
    localStorage.removeItem(scopedStorageKey(PENDING_SYNC_KEY));
  }
}

function getBackups() {
  try {
    return JSON.parse(localStorage.getItem(scopedStorageKey(BACKUP_KEY)) || "[]");
  } catch {
    return [];
  }
}

function backupSnapshot(snapshot, reason) {
  const payload = JSON.stringify(snapshot);
  const backups = getBackups();
  if (!backups.some((backup) => backup.payload === payload)) {
    backups.unshift({
      createdAt: new Date().toISOString(),
      reason,
      payload,
    });
    localStorage.setItem(scopedStorageKey(BACKUP_KEY), JSON.stringify(backups.slice(0, 30)));
  }
  updateBackupStatus();
}

function updateBackupStatus() {
  if (!ui.backupStatus) return;
  const backups = getBackups();
  ui.backupStatus.textContent = `已自动保存 ${backups.length} 个版本 · 当前 ${totalQuantity(records)} 件`;
}

function saveRecords(reason = "资料更新") {
  records = normalizeRecords(records);
  const snapshot = structuredClone(records);
  localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(records));
  backupSnapshot(records, reason);
  markPendingSync(snapshot, reason);
  return serverSyncReady
    ? queueServerSync(snapshot, reason).then((synced) => {
        if (synced === true) clearPendingSync(snapshot);
        return synced;
      })
    : Promise.resolve(true);
}

function applyServerRecordSnapshot(nextRecords, reason, { backup = true, version } = {}) {
  if (version !== undefined) setCollectionVersion(version);
  records = normalizeRecords(structuredClone(Array.isArray(nextRecords) ? nextRecords : []));
  localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(records));
  if (backup) backupSnapshot(records, reason);
  updateBackupStatus();
  return records;
}

function applyServerTargetRecord(nextRecords, recordId, reason, { backup = true } = {}) {
  const serverRecords = normalizeRecords(structuredClone(Array.isArray(nextRecords) ? nextRecords : []));
  const serverRecord = serverRecords.find((item) => String(item.id) === String(recordId)) || null;
  const hasLocalRecord = records.some((item) => String(item.id) === String(recordId));
  records = serverRecord
    ? records.map((item) => String(item.id) === String(recordId) ? serverRecord : item)
    : records.filter((item) => String(item.id) !== String(recordId));
  // A local delete made after the task click remains authoritative until its queued PUT runs.
  if (serverRecord && !hasLocalRecord) records = records.filter((item) => String(item.id) !== String(recordId));
  localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(records));
  if (backup) backupSnapshot(records, reason);
  updateBackupStatus();
  return serverRecord;
}

function reconcilePendingTargetRecord(recordId, replacement) {
  const pending = getPendingSync();
  if (!Array.isArray(pending?.records)) return null;
  const hasPendingRecord = pending.records.some((item) => String(item.id) === String(recordId));
  const nextRecords = replacement
    ? pending.records.map((item) => String(item.id) === String(recordId) ? replacement : item)
    : pending.records.filter((item) => String(item.id) !== String(recordId));
  const reconciled = {
    ...pending,
    records: replacement && !hasPendingRecord ? pending.records : nextRecords,
  };
  localStorage.setItem(scopedStorageKey(PENDING_SYNC_KEY), JSON.stringify(reconciled));
  return reconciled;
}

function rollbackPreorderTaskRecord(recordId, previousRecord) {
  const hasTarget = records.some((item) => String(item.id) === String(recordId));
  if (!hasTarget) return false;
  records = records.map((item) => String(item.id) === String(recordId) ? previousRecord : item);
  localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(records));
  reconcilePendingTargetRecord(recordId, previousRecord);
  updateBackupStatus();
  return true;
}

function enqueueRecordMutation(run) {
  const operation = recordSyncQueue.then(run, run);
  recordSyncQueue = operation.catch(() => undefined);
  return operation;
}

function supersededRecordMutationError() {
  const error = new Error("record mutation superseded by a newer server snapshot");
  error.code = "record_sync_superseded";
  return error;
}

function completePreorderTaskOnServer(recordId, expectedStage, completedDate, reason) {
  const queuedGeneration = recordSyncGeneration;
  return enqueueRecordMutation(async () => {
    if (queuedGeneration !== recordSyncGeneration) throw supersededRecordMutationError();
    if (!serverSyncReady || collectionVersion == null) throw new Error("server sync unavailable");
    setSyncState("syncing", "正在更新预定状态");

    let response;
    try {
      response = await fetch(`${RECORDS_ENDPOINT}/${encodeURIComponent(recordId)}/preorder-task`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedStage, completedDate, expectedVersion: collectionVersion }),
        signal: AbortSignal.timeout(SERVER_SYNC_TIMEOUT_MS),
      });
    } catch (error) {
      recordSyncGeneration += 1;
      throw error;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || `preorder task update failed: ${response.status}`);
      error.statusCode = response.status;
      error.data = body;
      if (response.status === 409 && Array.isArray(body.records) && normalizedCollectionVersion(body.version) != null) {
        setCollectionVersion(body.version);
        const serverRecord = applyServerTargetRecord(body.records, recordId, "同步其他设备的预定状态", { backup: false });
        reconcilePendingTargetRecord(recordId, serverRecord);
        error.taskReconciled = true;
      }
      recordSyncGeneration += 1;
      throw error;
    }
    if (!Array.isArray(body.records) || normalizedCollectionVersion(body.version) == null) {
      recordSyncGeneration += 1;
      throw new Error("preorder task response missing records or version");
    }
    setCollectionVersion(body.version);
    const serverRecord = applyServerTargetRecord(body.records, recordId, reason);
    reconcilePendingTargetRecord(recordId, serverRecord);
    // Later PUT snapshots may still contain the optimistic target; requeue their reconciled pending copy.
    recordSyncGeneration += 1;
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    setSyncState("synced", `已同步云端 · ${time}`);
    return body;
  });
}

// 同步状态徽章：connecting / syncing / synced / error / offline，
// 配合 .database-state[data-state] 控制圆点颜色，让多设备改动后能一眼确认是否已存云端。
function setSyncState(state, detail = "") {
  const box = document.querySelector(".database-state");
  if (box) box.dataset.state = state;
  if (!ui.databaseStateTitle || !ui.databaseStateHint) return;
  const titles = {
    connecting: "连接云端…",
    syncing: "正在同步云端",
    synced: "云端资料库",
    error: "云端同步失败",
    offline: "本地资料库",
  };
  const hints = {
    connecting: "正在连接…",
    syncing: "保存中 · 正在上传到云端",
    synced: "已同步 · 多设备数据一致",
    error: "未同步，请检查网络后重试",
    offline: "暂未连接云端",
  };
  ui.databaseStateTitle.textContent = titles[state] || titles.synced;
  ui.databaseStateHint.textContent = detail || hints[state] || "";
}

// 兼容旧调用：isCloud=true 视为已同步；false 时带 detail 视为同步失败、否则离线
function updateDatabaseState(isCloud, detail = "") {
  setSyncState(isCloud ? "synced" : detail ? "error" : "offline", detail);
}

async function pushRecordsToServer(snapshot, reason) {
  if (collectionVersion == null) throw new Error("collection version unavailable");
  const response = await fetch(RECORDS_ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: snapshot, reason, expectedVersion: collectionVersion }),
    signal: AbortSignal.timeout(SERVER_SYNC_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `server sync failed: ${response.status}`);
    error.statusCode = response.status;
    error.data = body;
    throw error;
  }
  if (!Array.isArray(body.records)) throw new Error("record sync response missing records");
  setCollectionVersion(body.version);
  const t = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  setSyncState("synced", `已同步云端 · ${t}`);
  return true;
}

function recoverFromServerRecordConflict(error, savedSnapshot) {
  const body = error?.data || {};
  if (!Array.isArray(body.records) || normalizedCollectionVersion(body.version) == null) return false;
  const pending = getPendingSync();
  backupSnapshot(savedSnapshot, "云端版本冲突 · 保留本机修改");
  if (Array.isArray(pending?.records)) backupSnapshot(pending.records, "云端版本冲突 · 保留待同步修改");
  backupSnapshot(records, "云端版本冲突 · 保留当前页面修改");
  recordSyncGeneration += 1;
  applyServerRecordSnapshot(body.records, "采用云端最新资料", { version: body.version });
  markPendingSyncConflict(collectionVersion);
  renderAll();
  updateDatabaseState(false, "云端已有新版本，本机修改已保留在自动备份");
  showToast("检测到其他设备的修改，已显示云端最新版；本机改动仍保留在自动备份");
  return true;
}

function queueServerSync(snapshot, reason) {
  const savedSnapshot = structuredClone(snapshot);
  const queuedGeneration = recordSyncGeneration;
  const run = async () => {
    if (queuedGeneration !== recordSyncGeneration) return null;
    setSyncState("syncing");
    try {
      return await pushRecordsToServer(savedSnapshot, reason);
    } catch (error) {
      if (error?.statusCode === 409) {
        const recovered = recoverFromServerRecordConflict(error, savedSnapshot);
        if (!recovered) recordSyncGeneration += 1;
        if (recovered) return null;
      }
      updateDatabaseState(false, error?.statusCode === 409
        ? "云端版本已变化，本机修改仍待同步"
        : "同步失败，请检查网络后重试");
      return false;
    }
  };
  return enqueueRecordMutation(run);
}

function reportBackgroundSync(syncPromise) {
  syncPromise.then((synced) => {
    if (synced === false) showToast("已保存在本机，云端同步失败。请检查网络后再次保存");
  });
}

function resumePendingRecordSync(fallbackReason) {
  const pending = getPendingSync();
  if (!Array.isArray(pending?.records) || pending.conflict) return;
  const snapshot = structuredClone(pending.records);
  reportBackgroundSync(
    queueServerSync(snapshot, pending.reason || fallbackReason).then((synced) => {
      if (synced === true) clearPendingSync(snapshot);
      return synced;
    }),
  );
}

async function hydrateRecordsFromServer() {
  try {
    const sessionResponse = await fetch(SESSION_ENDPOINT, { cache: "no-store" });
    if (!sessionResponse.ok) throw new Error(`session hydration failed: ${sessionResponse.status}`);
    const session = await sessionResponse.json();
    if (!session.authenticated || !session.user?.username) {
      window.location.reload();
      return;
    }
    currentUsername = session.user.username;
    isAdmin = Boolean(session.user.isAdmin);
    accountStatus = session.user;
    if (ui.currentUserLabel) ui.currentUserLabel.textContent = currentUsername;
    renderAccountAvatar();
    renderAccountSecurity();
    if (ui.adminNav) ui.adminNav.hidden = !isAdmin;
    if (ui.infoReviewNav) ui.infoReviewNav.hidden = !isAdmin;
    if (isAdmin && window.location.pathname === "/admin/info-review") {
      selectNav("infoReview");
      renderAll();
      renderInfoReview();
    }
    const localRecords = loadLocalRecords();
    const pending = getPendingSync();
    const response = await fetch(RECORDS_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`server hydration failed: ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.records)) throw new Error("server hydration response missing records");
    setCollectionVersion(body.version);
    let restoredLocal = false;
    let heldConflict = false;
    if (Array.isArray(body.records)) {
      const hasPending = Array.isArray(pending?.records);
      heldConflict = hasPending && pending.conflict === true;
      // 多设备数据一致：云端为唯一真相源。本机缓存与云端不同时一律以云端为准，不再弹窗询问。
      // 仅当本机存在“确实未同步成功”的离线改动(pending)时，才优先本机并在后台自动补同步到云端，避免丢失离线改动。
      // 已确认发生版本冲突的 pending 不自动覆盖云端；它会继续留在本机并进入自动备份。
      const restoreLocal = hasPending && !heldConflict;
      restoredLocal = Boolean(restoreLocal);
      records = normalizeRecords(structuredClone(restoreLocal ? pending?.records || localRecords : body.records));
      localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(records));
      backupSnapshot(records, restoreLocal ? "恢复本机待同步资料" : "从云端同步");
      if (heldConflict) backupSnapshot(pending.records, "云端版本冲突 · 保留待同步修改");
      selectedYear = getDefaultYear();
      serverSyncReady = true;
      if (restoreLocal) {
        const restoreSnapshot = structuredClone(records);
        reportBackgroundSync(
          queueServerSync(restoreSnapshot, pending?.reason || "恢复本机未同步资料").then((synced) => {
            if (synced === true) clearPendingSync(restoreSnapshot);
            return synced;
          }),
        );
      }
    }
    serverSyncReady = true;
    if (heldConflict) {
      updateDatabaseState(false, "已显示云端最新版，本机冲突修改保留在自动备份");
    } else {
      updateDatabaseState(
        true,
        restoredLocal ? "已恢复本机资料 · 正在同步云端" : "已连接 · 自动同步",
      );
    }
    renderAll();
    if (heldConflict) showToast("云端资料已更新；上次未合并的本机修改仍保留在自动备份");
  } catch {
    updateDatabaseState(false);
  }
}

function getDefaultYear() {
  const years = records.map((record) => Number(record.date.slice(0, 4)));
  if (!years.length) return currentYear;
  return years.includes(currentYear) ? currentYear : Math.max(...years);
}

function formatMoneyValue(value) {
  const n = Number(value) || 0;
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function money(value) {
  return `¥${formatMoneyValue(value)}`;
}

function rmbMoney(value) {
  return `RMB ${formatMoneyValue(value)}`;
}

function isLikelyJapaneseCatalogPrice(item = {}) {
  const text = [
    item.brand,
    item.brandGroup,
    item.series,
    item.category,
    item.work,
    item.character,
    item.name,
    item.description,
  ].filter(Boolean).join(" ");
  return /bandai|万代|tamashii|魂商店|魂ウェブ|魂web|premium\s*bandai|プレミアムバンダイ|takara|タカラ|diaclone|ダイアクロン|kaiyodo|海洋堂|kotobukiya|寿屋|good\s*smile|gsc|figma|ねんどろいど|megahouse|メガハウス|gundam|ガンダム|gunpla|ガンプラ|s\.h\.figuarts|shfiguarts|figuarts|robot魂|metal\s*build|metal\s*robot/i.test(text);
}

function catalogPriceText(item = {}) {
  return [
    item.name,
    item.brand,
    item.brandGroup,
    item.series,
    item.category,
    item.work,
    item.character,
    item.description,
  ].filter(Boolean).join(" ");
}

function catalogPriceCurrency(item = {}, sourcePrice = 0) {
  const text = catalogPriceText(item);
  if (/日元|円|JPY|yen|税込|税抜/i.test(text)) return "JPY";
  if (isLikely52ToysJpyPrice(item, sourcePrice)) return "JPY";
  if (/人民币|RMB|CNY|(?:\d+(?:\.\d+)?\s*元)|(?:零售价|售价|定价)[:：]?\s*\d+(?:\.\d+)?\s*元/i.test(text)) return "CNY";
  if (
    isLikelyJapaneseCatalogPrice(item)
    && sourcePrice > 0
    && sourcePrice < 1000
    && !Number.isInteger(sourcePrice)
    && /定价|售价|零售价|price/i.test(text)
  ) {
    return "CNY";
  }
  return isLikelyJapaneseCatalogPrice(item) ? "JPY" : "CNY";
}

function isLikely52ToysJpyPrice(item = {}, sourcePrice = 0) {
  const price = Number(sourcePrice || item.price || 0);
  if (price < 1000) return false;
  const text = [
    item.name,
    item.brand,
    item.brandGroup,
    item.series,
    item.work,
    item.character,
    item.description,
  ].filter(Boolean).join(" ");
  return /52\s*TOYS|52TOYS|BEASTBOX|MEGABOX|猛兽匣|万能匣|BEASTDRIVE/i.test(text);
}

function catalogRecordPrice(item = {}) {
  const serverPrice = Number(item.priceRmb || 0);
  if (serverPrice > 0) return Math.round(serverPrice);
  const sourcePrice = Number(item.price || 0);
  if (!sourcePrice) return 0;
  return Math.round(catalogPriceCurrency(item, sourcePrice) === "JPY" ? sourcePrice * JPY_TO_CNY_RATE : sourcePrice);
}

function catalogPriceDisplay(item = {}) {
  if (item.priceDisplay) return item.priceDisplay;
  const sourcePrice = Number(item.price || 0);
  if (!sourcePrice) return "";
  if (catalogPriceCurrency(item, sourcePrice) !== "JPY") return `参考价 ${rmbMoney(sourcePrice)}`;
  return `日本发售价 ${sourcePrice.toLocaleString("zh-CN")} 日元 ≈ ${rmbMoney(catalogRecordPrice(item))}`;
}

function dateText(date) {
  if (!date) return "-";
  const [year, month, day] = String(date).slice(0, 10).split("-");
  return `${year}.${month}.${day}`;
}

function daysUntil(date, nowValue = new Date()) {
  const parts = String(date || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return Infinity;
  const [year, month, day] = parts;
  const due = new Date(year, month - 1, day);
  if (due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== day) return Infinity;
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) return Infinity;
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / 86400000);
}

function isAllYears() {
  return selectedYear === "all";
}
// 某个日期是否落在当前选中的年份内（"全部"时永远为真）。
function inSelectedYear(dateStr) {
  return isAllYears() || String(dateStr || "").startsWith(String(selectedYear));
}
function yearRecords() {
  return isAllYears() ? records.slice() : records.filter((record) => Number(record.date.slice(0, 4)) === selectedYear);
}

function matchesActiveCategory(record) {
  return activeCategory === "全部" || normalizeCategory(record.category, record) === activeCategory;
}

function categoryRecords(source = records) {
  return source.filter(matchesActiveCategory);
}

function yearCategoryRecords() {
  return categoryRecords(yearRecords());
}

function categoryScopeText() {
  return activeCategory === "全部" ? "全部收藏" : activeCategory;
}

function renderYearOptions() {
  const years = [...new Set([...records.map((record) => Number(record.date.slice(0, 4))), currentYear])]
    .sort((a, b) => b - a);
  ui.yearSelect.innerHTML =
    `<option value="all">全部年份</option>` + years.map((year) => `<option value="${year}">${year}</option>`).join("");
  ui.yearSelect.value = isAllYears() ? "all" : String(selectedYear);
}

function renderMetrics() {
  const annual = yearCategoryRecords();
  const purchases = annual.filter((record) => record.status === "已入库");
  const preorders = annual.filter((record) => record.status === "预定中");
  const activePreorders = categoryRecords(records).filter((record) => record.status === "预定中");
  const paymentPreorders = activePreorders.filter(isPaymentPreorder);
  const arrivalPreorders = activePreorders.filter(isArrivalPreorder);
  const annualQuantity = totalQuantity(annual);
  const purchaseQuantity = totalQuantity(purchases);
  const activePreorderQuantity = totalQuantity(activePreorders);
  const paymentCount = paymentPreorders.length;
  const arrivalCount = arrivalPreorders.length;
  const paid = annual.reduce((sum, record) => sum + Number(record.paid), 0);
  const purchasePaid = purchases.reduce((sum, record) => sum + Number(record.paid), 0);
  const balance = paymentPreorders.reduce((sum, record) => sum + preorderBalance(record), 0);
  const dueIn30Days = paymentPreorders.filter(
    (record) => record.dueDate && daysUntil(record.dueDate) <= 30,
  ).length;

  ui.heroYear.textContent = isAllYears() ? "全部" : selectedYear;
  ui.annualTotal.textContent = formatMoneyValue(paid);
  ui.heroItems.textContent = `${annualQuantity} 件藏品`;
  ui.heroPreorders.textContent = `${preorders.length} 项预定追踪中`;
  ui.collectionCount.textContent = totalQuantity(records);
  ui.preorderCount.textContent = records.filter((record) => record.status === "预定中").length;
  ui.purchaseCount.innerHTML = `${purchaseQuantity} <small>件</small>`;
  ui.purchaseValue.textContent = `${money(purchasePaid)} 已支付`;
  ui.trackingCount.innerHTML = `${activePreorders.length} <small>项</small>`;
  ui.depositValue.textContent = `待补款 ${paymentCount} · 待到货 ${arrivalCount}${activePreorderQuantity !== activePreorders.length ? ` · ${activePreorderQuantity} 件` : ""}`;
  ui.balanceValue.textContent = money(balance);
  ui.balanceHint.textContent = dueIn30Days ? `${dueIn30Days} 项将在 30 天内补款` : "暂无 30 天内补款项目";
  ui.reserveHint.textContent = money(Math.ceil(balance / 3 / 100) * 100);
}

function renderChart() {
  const paidByMonth = Array(12).fill(0);
  const forecastByMonth = Array(12).fill(0);

  yearCategoryRecords().forEach((record) => {
    const paidMonth = Number(record.date.slice(5, 7)) - 1;
    paidByMonth[paidMonth] += Number(record.paid);
    if (isPaymentPreorder(record) && record.dueDate && inSelectedYear(record.dueDate)) {
      const dueMonth = Number(record.dueDate.slice(5, 7)) - 1;
      if (dueMonth >= 0 && dueMonth < 12) forecastByMonth[dueMonth] += preorderBalance(record);
    }
  });

  const maxValue = Math.max(10000, ...paidByMonth, ...forecastByMonth);
  ui.chartBars.innerHTML = paidByMonth
    .map((paid, index) => {
      const forecast = forecastByMonth[index];
      const paidHeight = Math.round((paid / maxValue) * 174);
      const forecastHeight = Math.round((forecast / maxValue) * 174);
      return `
        <div class="month-column" title="${index + 1} 月：已支付 ${money(paid)}，预计补款 ${money(forecast)}">
          <div class="month-bars">
            <i class="month-bar paid" style="height:${paidHeight}px"></i>
            <i class="month-bar forecast" style="height:${forecastHeight}px"></i>
          </div>
          <small>${String(index + 1).padStart(2, "0")}</small>
        </div>`;
    })
    .join("");
}

function renderCalendar() {
  const monthly = Array.from({ length: 12 }, () => []);
  categoryRecords(records)
    .filter((record) => isPaymentPreorder(record) && /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate || "") && inSelectedYear(record.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .forEach((record) => {
      const month = Number(record.dueDate.slice(5, 7)) - 1;
      if (month >= 0 && month < 12) monthly[month].push(record);
    });

  ui.calendarGrid.innerHTML = monthly
    .map((items, index) => {
      const total = items.reduce((sum, record) => sum + preorderBalance(record), 0);
      const events = items.length
        ? items
            .map(
              (record) => `
                <article class="calendar-event">
                  <div>
                    <span>待补款 · ${record.dueDate.slice(8, 10)} 日</span>
                    <h3>${escapeHtml(recordDisplayName(record))}</h3>
                  </div>
                  <strong>${money(preorderBalance(record))}</strong>
                </article>`,
            )
            .join("")
        : `<p class="calendar-empty">暂无补款</p>`;
      return `
        <section class="calendar-month ${items.length ? "has-payment" : ""}">
          <header>
            <div><b>${String(index + 1).padStart(2, "0")}</b><span>月</span></div>
            <strong>${items.length ? money(total) : "-"}</strong>
          </header>
          <div class="calendar-events">${events}</div>
        </section>`;
    })
    .join("");
}

function iconForCategory(category) {
  const normalized = normalizeCategory(category);
  const meta = CATEGORY_META[normalized] || CATEGORY_META["高达模型"];
  return [meta.icon, meta.thumbClass];
}

function imageForRecord(record) {
  const displayName = recordDisplayName(record);
  const image = record.imageUrl || record.catalogCoverImage || productImages[displayName.toLowerCase()] || productImages[String(record.name || "").toLowerCase()] || "";
  return image.startsWith("/assets/") ? `.${image}` : image;
}

function recordDisplayName(record = {}) {
  return record.name || "";
}

function recordOriginalName(record = {}) {
  return "";
}

function recordDisplaySeries(record = {}) {
  return record.series || "";
}

function recordSearchText(record = {}) {
  return [
    recordDisplayName(record),
    record.name,
    recordDisplaySeries(record),
    record.series,
    record.catalogModelNumber,
    record.catalogBrand,
    record.catalogCategory,
    normalizeCategory(record.category, record),
  ].filter(Boolean).join(" ");
}

function filteredRecords() {
  let filtered = activeView === "calendar"
    ? records.filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate || "") && inSelectedYear(record.dueDate))
    : yearRecords();
  const viewStatus = activeView === "preorders" ? "预定中" : activeStatus;
  if (activeView === "calendar") filtered = filtered.filter(isPaymentPreorder);
  else if (viewStatus !== "全部") filtered = filtered.filter((record) => record.status === viewStatus);
  filtered = categoryRecords(filtered);
  if (searchTerm) {
    filtered = filtered.filter((record) =>
      recordSearchText(record).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }
  return filtered.sort((a, b) => {
    if (activeView === "preorders") {
      const stageDelta = Number(isArrivalPreorder(a)) - Number(isArrivalPreorder(b));
      if (stageDelta) return stageDelta;
      if (isPaymentPreorder(a) && a.dueDate !== b.dueDate) {
        return String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
      }
    }
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
}

function renderRecords() {
  const filtered = filteredRecords();
  ui.recordList.innerHTML = filtered
    .map((record) => {
      const [icon, thumbClass] = iconForCategory(record.category);
      const image = imageForRecord(record);
      const displayName = recordDisplayName(record);
      const originalName = recordOriginalName(record);
      const displaySeries = recordDisplaySeries(record);
      const isPreorder = record.status === "预定中";
      const isPayment = isPaymentPreorder(record);
      const stageLabel = preorderStageLabel(record);
      const stageClass = isPayment ? "stage-payment" : isPreorder ? "stage-arrival" : "";
      const quantity = recordQuantity(record);
      const balance = preorderBalance(record);
      const paymentDate = String(record.paymentCompletedDate || record.paymentCompletedAt || "").slice(0, 10);
      const recordDate = isPayment
        ? `预计补款 ${dateText(record.dueDate)}`
        : isPreorder
          ? `${paymentDate ? `${dateText(paymentDate)} 已补款 · ` : ""}等待到货`
          : `入库于 ${dateText(record.date)}`;
      return `
        <article class="record-card ${record.catalogId ? "is-linked-catalog" : ""}" data-record="${escapeHtml(record.id)}" data-preorder-stage="${isPreorder ? preorderStage(record) : ""}" title="${record.catalogId ? "查看关联图鉴" : "这条藏品还未关联图鉴"}">
          <div class="record-thumb ${thumbClass}">
            <i data-lucide="${icon}"></i>
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(displayName)}" loading="lazy" onerror="this.remove()" />` : ""}
            ${quantity > 1 ? `<span class="record-qty">×${quantity}</span>` : ""}
          </div>
          <div class="record-info">
            <h3 title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</h3>
            ${originalName ? `<span class="record-original-name">原记录名：${escapeHtml(originalName)}</span>` : ""}
            <span class="record-meta">${escapeHtml(displaySeries)} · ${escapeHtml(normalizeCategory(record.category, record))}</span>
            <span class="record-date">${recordDate}</span>
          </div>
          <div class="record-side">
            <span class="status-chip ${isPreorder ? `preorder ${stageClass}` : ""}">${escapeHtml(stageLabel)}</span>
            <strong class="record-price">${money(isPayment ? balance : record.paid)}</strong>
            ${image ? "" : `<button class="edit-btn recognize-card-btn" data-recognize="${record.id}" aria-label="识别 ${escapeHtml(displayName)} 的产品图" title="联网识别产品图">
              <i data-lucide="sparkles"></i>
            </button>`}
            <button class="edit-btn" data-edit="${record.id}" aria-label="编辑 ${escapeHtml(displayName)}" title="编辑记录">
              <i data-lucide="pencil"></i>
            </button>
            <button class="delete-btn" data-delete="${record.id}" aria-label="删除 ${escapeHtml(displayName)}" title="删除记录">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </article>`;
    })
    .join("");
  ui.emptyState.classList.toggle("visible", filtered.length === 0);
}

function renderPayments() {
  const preorders = categoryRecords(records).filter((record) => record.status === "预定中");
  const payments = preorders
    .filter(isPaymentPreorder)
    .sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));
  const arrivals = preorders
    .filter(isArrivalPreorder)
    .sort((a, b) => String(a.paymentCompletedDate || a.paymentCompletedAt || a.date || "").localeCompare(String(b.paymentCompletedDate || b.paymentCompletedAt || b.date || "")));

  if (!preorders.length) {
    const label = activeCategory === "全部" ? "" : `${escapeHtml(activeCategory)} `;
    ui.paymentList.innerHTML = `<div class="no-payment">${label}预定待办已全部处理。</div>`;
    return;
  }

  const renderGroup = (stage, items) => {
    if (!items.length) return "";
    const isPayment = stage === PREORDER_STAGE_PAYMENT;
    const visible = items.slice(0, 4);
    const quantity = totalQuantity(items);
    const countLabel = quantity === items.length ? `${items.length} 项` : `${items.length} 项 · ${quantity} 件`;
    return `
      <section class="preorder-task-group" data-stage="${stage}">
        <header class="preorder-task-heading">
          <span>${isPayment ? "待补款" : "待到货"}</span>
          <b>${countLabel}</b>
        </header>
        ${visible.map((record) => {
          const days = isPayment && /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate || "") ? daysUntil(record.dueDate) : Infinity;
          const dayLabel = isPayment
            ? !Number.isFinite(days) ? "日期待定" : days < 0 ? "已到期" : days === 0 ? "今天" : `${days} 天后`
            : "等待签收";
          const chipClass = isPayment ? (Number.isFinite(days) && days <= 30 ? "urgent" : "") : "arrival";
          const paymentDate = String(record.paymentCompletedDate || record.paymentCompletedAt || "").slice(0, 10);
          const meta = isPayment
            ? `${dateText(record.dueDate)} · ${recordDisplaySeries(record)}`
            : `${paymentDate ? `${dateText(paymentDate)} 补款完成` : "已付清"} · ${recordDisplaySeries(record)}`;
          const saving = Boolean(preorderTaskSaving);
          const savingThis = preorderTaskSaving?.id === record.id;
          return `
            <article class="payment-item ${isPayment ? "stage-payment" : "stage-arrival"}">
              <div class="payment-item-top">
                <h3>${escapeHtml(recordDisplayName(record))}</h3>
                <span class="due-chip ${chipClass}">${dayLabel}</span>
              </div>
              <span class="payment-meta">${escapeHtml(meta)}</span>
              <div class="payment-item-bottom">
                <strong>${isPayment ? money(preorderBalance(record)) : "已付清"}</strong>
                <button class="settle-btn ${isPayment ? "" : "arrival"}" data-preorder-action="${escapeHtml(record.id)}" data-stage="${stage}" ${saving ? "disabled" : ""}>${savingThis ? "保存中…" : isPayment ? "补款完成" : "确认到货"}</button>
              </div>
            </article>`;
        }).join("")}
        ${items.length > visible.length ? `<p class="preorder-task-more">另有 ${items.length - visible.length} 项，请到预定追踪查看</p>` : ""}
      </section>`;
  };

  ui.paymentList.innerHTML = renderGroup(PREORDER_STAGE_PAYMENT, payments) + renderGroup(PREORDER_STAGE_ARRIVAL, arrivals);
  ui.paymentList.setAttribute("aria-busy", String(Boolean(preorderTaskSaving)));
}

function renderView() {
  const scope = categoryScopeText();
  const viewContent = {
    collection: {
      kicker: "COLLECTION ARCHIVE",
      title: activeCategory === "全部" ? "收藏库" : `${activeCategory}收藏库`,
      description: `查看并管理本年度${scope}的入库与预定记录。`,
      count: `${totalQuantity(filteredRecords())} ITEMS`,
    },
    preorders: {
      kicker: "PREORDER TRACKING",
      title: activeCategory === "全部" ? "预定追踪" : `${activeCategory}预定追踪`,
      description: `集中查看${scope}待补款与待到货的预定项目。`,
      count: `${totalQuantity(filteredRecords())} TARGETS`,
    },
    calendar: {
      kicker: "PAYMENT SCHEDULE",
      title: activeCategory === "全部" ? "补款日历" : `${activeCategory}补款日历`,
      description: `按月份查看${scope}的预计补款时间，提前安排收藏预算。`,
      count: `${totalQuantity(filteredRecords())} DUES`,
    },
    contributions: {
      kicker: "CATALOG CONTRIBUTION",
      title: "图鉴贡献",
      description: "查看你提交的图鉴纠错、采纳记录、贡献值和段位成长。",
      count: "ARCHIVE RANK",
    },
  };
  const content = viewContent[activeView] || viewContent.collection;
  document.body.dataset.view = activeView;
  ui.viewKicker.textContent = content.kicker;
  ui.viewTitle.textContent = content.title;
  ui.viewDescription.textContent = content.description;
  ui.viewCount.textContent = content.count;
}

function adminDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function adminRelativeTime(iso) {
  if (!iso) return "从未";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "从未";
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function renderAccountSecurity() {
  if (!ACCOUNT_SECURITY_UI_ENABLED) {
    if (ui.accountSecurityNotice) ui.accountSecurityNotice.hidden = true;
    if (ui.accountSecurityModal) ui.accountSecurityModal.hidden = true;
    return;
  }
  if (!ui.accountSecurityNotice || !accountStatus) return;
  const emailBound = Boolean(accountStatus.emailBound);
  ui.accountSecurityNotice.hidden = emailBound;
  if (emailBound) {
    if (ui.accountSecurityModal) ui.accountSecurityModal.hidden = true;
  } else {
    ui.accountSecurityTitle.textContent = "请绑定邮箱";
    ui.accountSecurityText.textContent = "绑定后忘记密码时可通过邮箱验证码找回账号。";
  }
  if (ui.emailBindStatus) {
    ui.emailBindStatus.textContent = emailBound ? `已绑定 ${accountStatus.emailMasked || ""}` : "未绑定";
  }
  if (ui.bindEmailForm) ui.bindEmailForm.hidden = emailBound;
  window.lucide?.createIcons();
}

function avatarReviewText(status = "") {
  return {
    pending: "头像已提交，等待安全审核",
    checking: "头像正在进行内容安全识别",
    approved: "头像已更新",
    rejected: "头像未通过内容安全识别",
    manual_review: "头像进入人工复核",
    needs_openid: "请在小程序同步微信身份后更换头像",
    needs_config: "头像安全识别待配置",
    check_failed: "头像安全识别提交失败",
  }[status] || "";
}

function renderAccountAvatar() {
  if (!ui.accountAvatar) return;
  const user = accountStatus || {};
  const name = user.nickname || user.username || currentUsername || "玩";
  const initial = String(name || "玩").trim().slice(0, 1).toUpperCase();
  const avatarUrl = user.avatarUrl || "";
  ui.accountAvatar.innerHTML = avatarUrl
    ? `<img src="${escapeHtml(displayImageUrl(avatarUrl, 96))}" alt="" />`
    : `<span>${escapeHtml(initial)}</span>`;
  const statusText = avatarReviewText(user.avatarReviewStatus || "");
  if (ui.accountAvatarChip) {
    ui.accountAvatarChip.title = statusText ? `${statusText}。头像由小程序审核通过后同步` : "头像由小程序审核通过后同步";
  }
}

function showAccountSecurityModal() {
  if (!ui.accountSecurityModal) return;
  renderAccountSecurity();
  if (accountStatus?.emailBound) return;
  ui.accountSecurityModal.hidden = false;
}

function hideAccountSecurityModal() {
  if (ui.accountSecurityModal) ui.accountSecurityModal.hidden = true;
}

function setBindEmailCooldown(seconds) {
  window.clearInterval(bindEmailCodeTimer);
  let left = Number(seconds || 60);
  ui.sendBindEmailCode.disabled = true;
  ui.sendBindEmailCode.textContent = `${left}s`;
  bindEmailCodeTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(bindEmailCodeTimer);
      ui.sendBindEmailCode.disabled = false;
      ui.sendBindEmailCode.textContent = "发送验证码";
      return;
    }
    ui.sendBindEmailCode.textContent = `${left}s`;
  }, 1000);
}

async function refreshSessionStatus() {
  const response = await fetch(SESSION_ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error("session failed");
  const session = await response.json();
  if (session.authenticated && session.user) {
    accountStatus = session.user;
    currentUsername = session.user.username || currentUsername;
    isAdmin = Boolean(session.user.isAdmin);
    if (ui.currentUserLabel) ui.currentUserLabel.textContent = currentUsername;
    renderAccountAvatar();
    renderAccountSecurity();
  }
}

async function sendBindEmailCode() {
  if (!ui.bindEmailForm || !ui.sendBindEmailCode) return;
  const form = new FormData(ui.bindEmailForm);
  const email = String(form.get("email") || "").trim();
  ui.sendBindEmailCode.disabled = true;
  ui.sendBindEmailCode.textContent = "发送中";
  try {
    const response = await fetch(EMAIL_SEND_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, scene: "bind_email" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "验证码发送失败");
    if (result.devCode && ui.bindEmailForm.elements.code) {
      ui.bindEmailForm.elements.code.value = result.devCode;
      showToast(`本地测试验证码：${result.devCode}`);
    } else {
      showToast("邮箱验证码已发送");
    }
    setBindEmailCooldown(60);
  } catch (error) {
    showToast(error.message || "验证码发送失败");
    ui.sendBindEmailCode.disabled = false;
    ui.sendBindEmailCode.textContent = "发送验证码";
  }
}

async function bindEmail(event) {
  event.preventDefault();
  const form = new FormData(ui.bindEmailForm);
  const payload = {
    email: String(form.get("email") || "").trim(),
    code: String(form.get("code") || "").trim(),
  };
  try {
    const response = await fetch(BIND_EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "绑定失败");
    accountStatus = result.user || accountStatus;
    showToast("邮箱已绑定");
    renderAccountSecurity();
    ui.bindEmailForm.reset();
  } catch (error) {
    showToast(error.message || "绑定失败，请重试");
  }
}

const adminUpdateTypeLabels = {
  feature: "新增",
  fix: "修复",
  source: "资讯源",
  ops: "运维",
  note: "备注",
};

let adminAccountRows = [];
let adminAccountVisible = ADMIN_ACCOUNT_PAGE_SIZE;
let adminWeiboQrState = null;
let adminWeiboQrTimer = 0;

// Admin-only: per-account summary (counts + spend), so the admin can see every registered
// account, its last login, and the data it has written — without crossing account data.
async function renderAdmin() {
  if (!isAdmin || !ui.adminTableBody) return;
  setupAdminTabs();
  ui.adminTableBody.innerHTML = `<tr><td colspan="7" class="muted">加载中…</td></tr>`;
  if (ui.adminAccountPager) ui.adminAccountPager.innerHTML = "";
  if (ui.adminCatalogOps) ui.adminCatalogOps.innerHTML = `<p class="admin-update-empty">正在读取图鉴维护状态…</p>`;
  if (ui.adminNewsOps) ui.adminNewsOps.innerHTML = `<p class="admin-update-empty">正在读取资讯抓取状态…</p>`;
  if (ui.adminContributionOps) ui.adminContributionOps.innerHTML = `<p class="admin-update-empty">正在读取图鉴贡献…</p>`;
  if (ui.adminCatalogSubmissionOps) ui.adminCatalogSubmissionOps.innerHTML = `<p class="admin-update-empty">正在读取图鉴建档草稿…</p>`;
  if (ui.adminFeedbackOps) ui.adminFeedbackOps.innerHTML = `<p class="admin-update-empty">正在读取用户反馈…</p>`;
  if (ui.adminAccessSummary) ui.adminAccessSummary.innerHTML = `<p class="admin-update-empty">正在读取用户活跃分布…</p>`;
  renderAdminUpdates();
  loadAdminAccessSummary();
  try {
    const reviewStatuses = "submitted,ai_reviewing,ready_for_review,duplicate_suspected,needs_more,risk_review";
    const [response, catalogSubmissionResponse] = await Promise.all([
      fetch(ADMIN_OVERVIEW_ENDPOINT, { cache: "no-store" }),
      fetch(`${ADMIN_CATALOG_SUBMISSIONS_ENDPOINT}?status=${encodeURIComponent(reviewStatuses)}&limit=80`, { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`admin overview failed (${response.status})`);
    if (!catalogSubmissionResponse.ok) throw new Error(`catalog submission review failed (${catalogSubmissionResponse.status})`);
    const { accounts = [], totals = {}, catalogOps = {}, infoOps = {}, catalogContributionOps = {}, pickupFeedbackOps = {}, catalogFeedbackOps = {}, pickupSubmissionOps = {} } = await response.json();
    const catalogSubmissionOps = await catalogSubmissionResponse.json();
    const openFeedbackTotal = Number(pickupFeedbackOps.totalOpen || 0) + Number(catalogFeedbackOps.totalOpen || 0);
    setAdminTabBadge("adminFeedbackBadge", openFeedbackTotal);
    setAdminTabBadge("adminContributionBadge", Number(catalogContributionOps.totalOpen || 0));
    setAdminTabBadge("adminCatalogSubmissionBadge", Number(catalogSubmissionOps.items?.length || 0));
    setAdminTabBadge("adminSubmissionBadge", Number(pickupSubmissionOps.totalPending || 0));
    adminAccountRows = accounts;
    adminAccountVisible = ADMIN_ACCOUNT_PAGE_SIZE;
    ui.adminSummary.innerHTML = [
      ["注册账号", String(totals.accounts ?? accounts.length)],
      ["藏品总数", String(totals.records ?? 0)],
      ["图鉴条目", String(catalogOps.totalPublished ?? 0)],
      ["待审建档", String(catalogSubmissionOps.items?.length ?? 0)],
      ["待审贡献", String(catalogContributionOps.totalOpen ?? 0)],
      ["24h 资讯", String(infoOps.published24h ?? infoOps.articles24h ?? 0)],
      ["待处理反馈", String(openFeedbackTotal)],
      ["抓取失败", String(infoOps.errors24h ?? 0)],
      ["待补款合计", money(totals.balanceDue ?? 0)],
    ]
      .map(([label, value]) => `<div class="admin-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");
    renderAdminCatalogOps(catalogOps);
    renderAdminNewsOps(infoOps);
    renderAdminCatalogSubmissionOps(catalogSubmissionOps);
    renderAdminContributionOps(catalogContributionOps);
    renderAdminFeedbackOps({ pickupFeedbackOps, catalogFeedbackOps });
    renderAdminPickupSubmissions(pickupSubmissionOps);
    renderAdminAccountTable();
    window.lucide?.createIcons();
  } catch {
    ui.adminSummary.innerHTML = "";
    if (ui.adminCatalogOps) ui.adminCatalogOps.innerHTML = `<p class="admin-update-empty">图鉴维护状态加载失败。</p>`;
    if (ui.adminNewsOps) ui.adminNewsOps.innerHTML = `<p class="admin-update-empty">资讯抓取状态加载失败。</p>`;
    if (ui.adminContributionOps) ui.adminContributionOps.innerHTML = `<p class="admin-update-empty">图鉴贡献加载失败。</p>`;
    if (ui.adminCatalogSubmissionOps) ui.adminCatalogSubmissionOps.innerHTML = `<p class="admin-update-empty">图鉴建档草稿加载失败。</p>`;
    if (ui.adminFeedbackOps) ui.adminFeedbackOps.innerHTML = `<p class="admin-update-empty">用户反馈加载失败。</p>`;
    if (ui.adminAccessSummary) ui.adminAccessSummary.innerHTML = `<p class="admin-update-empty">用户活跃分布加载失败。</p>`;
    ui.adminTableBody.innerHTML = `<tr><td colspan="7" class="muted">无法加载账号数据，请点刷新重试</td></tr>`;
  }
}

function renderAdminHealth(status, label) {
  const normalized = status === "ok" ? "ok" : status === "bad" ? "bad" : "warn";
  return `<span class="admin-health ${normalized}"><i></i>${escapeHtml(label)}</span>`;
}

function renderAdminMetric(label, value, hint = "") {
  return `<div class="admin-kv"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "—"))}</strong>${hint ? `<em>${escapeHtml(hint)}</em>` : ""}</div>`;
}

function renderAdminSimpleRows(rows, { empty = "暂无记录", labelKey = "label", valueKey = "value" } = {}) {
  if (!rows?.length) return `<p class="admin-mini-empty">${escapeHtml(empty)}</p>`;
  return rows
    .map((row) => `<div class="admin-mini-row"><span>${escapeHtml(row[labelKey] || "")}</span><b>${escapeHtml(String(row[valueKey] ?? ""))}</b></div>`)
    .join("");
}

function adminAccessMetric(rows = [], type, key = "activeUsers") {
  return Number(rows.find((row) => row.type === type)?.[key] || 0);
}

function renderAdminAccessSummary(data = {}) {
  if (!ui.adminAccessSummary) return;
  const today = data.today || [];
  const sevenDays = data.sevenDays || [];
  const daily = data.daily || [];
  const topPaths = (data.topPaths || []).slice(0, 6);
  const dailyRows = daily.length
    ? daily
        .slice(0, 14)
        .map((row) => `<div class="admin-access-day"><span>${escapeHtml(row.day)} · ${escapeHtml(row.label)}</span><b>${row.activeUsers} 人 / ${row.events} 次</b></div>`)
        .join("")
    : `<p class="admin-mini-empty">还没有足够数据，部署后访问会自动累积。</p>`;
  ui.adminAccessSummary.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">ADMIN · ACTIVITY</p>
        <h3>Web / 小程序活跃</h3>
      </div>
      <span class="admin-section-note">按登录账号优先去重，未登录按 IP + UA 估算</span>
    </div>
    <div class="admin-kv-grid admin-access-grid">
      ${renderAdminMetric("今日 Web", adminAccessMetric(today, "web"))}
      ${renderAdminMetric("今日小程序", adminAccessMetric(today, "miniprogram"))}
      ${renderAdminMetric("7 日 Web", adminAccessMetric(sevenDays, "web"))}
      ${renderAdminMetric("7 日小程序", adminAccessMetric(sevenDays, "miniprogram"))}
    </div>
    <div class="admin-access-columns">
      <div>
        <h4>最近分布</h4>
        <div class="admin-access-days">${dailyRows}</div>
      </div>
      <div>
        <h4>7 日高频入口</h4>
        ${renderAdminSimpleRows(topPaths.map((row) => ({ label: `${row.label} · ${row.path}`, value: row.events })), { empty: "暂无入口数据" })}
      </div>
    </div>`;
}

async function loadAdminAccessSummary() {
  if (!ui.adminAccessSummary) return;
  ui.adminAccessSummary.innerHTML = `<p class="admin-update-empty">正在读取用户活跃分布…</p>`;
  try {
    const response = await fetch(`${ACCESS_SUMMARY_ENDPOINT}?days=14`, { cache: "no-store" });
    if (!response.ok) throw new Error(`access summary failed (${response.status})`);
    renderAdminAccessSummary(await response.json());
  } catch {
    ui.adminAccessSummary.innerHTML = `<p class="admin-update-empty">用户活跃分布加载失败。</p>`;
  }
}

function adminSourceStatusText(row = {}) {
  if (row.status === "ok") return adminRelativeTime(row.lastFetchedAt);
  if (row.status === "error") return `${row.lastError?.label || "失败"} · ${adminRelativeTime(row.lastError?.created_at)}`;
  if (row.status === "never") return "从未抓取";
  return `延迟 ${row.ageMinutes ?? "?"} 分钟`;
}

function renderAdminErrorDetails(errors = []) {
  if (!errors.length) return `<p class="admin-mini-empty">暂无失败记录。</p>`;
  return errors
    .map((error) => `
      <details class="admin-error-item">
        <summary>
          <span>${escapeHtml(error.source_name || error.adapter_key || "未知来源")}</span>
          <b>${escapeHtml(error.label || "错误")} · ${escapeHtml(adminRelativeTime(error.created_at))}</b>
        </summary>
        <div class="admin-error-body">
          <p>${escapeHtml(error.message || "无错误信息")}</p>
          <small>adapter: ${escapeHtml(error.adapter_key || "—")} · attempts: ${escapeHtml(String(error.attempts ?? "—"))} · ${escapeHtml(adminDateTime(error.created_at))}</small>
        </div>
      </details>`)
    .join("");
}

function renderAdminWeiboQrBox() {
  if (!adminWeiboQrState) return "";
  const status = adminWeiboQrState.status || "waiting";
  const done = ["success", "failed", "expired"].includes(status);
  return `
    <div class="admin-weibo-qr ${escapeHtml(status)}">
      ${adminWeiboQrState.imageUrl && !done ? `<img src="${escapeHtml(adminWeiboQrState.imageUrl)}" alt="微博扫码登录二维码" referrerpolicy="no-referrer" />` : ""}
      <div>
        <strong>${escapeHtml(adminWeiboQrState.message || "等待扫码")}</strong>
        <p>${escapeHtml(adminWeiboQrState.expiresAt && !done ? `二维码有效期至 ${adminDateTime(adminWeiboQrState.expiresAt)}` : adminWeiboQrState.verified?.source ? `验证源：${adminWeiboQrState.verified.source}` : "扫码成功后会自动写入服务器 Cookie。")}</p>
        ${adminWeiboQrState.verified ? `<p>验证：${escapeHtml(adminWeiboQrState.verified.ok ? `通过，读取 ${adminWeiboQrState.verified.cardCount || 0} 条卡片` : adminWeiboQrState.verified.message || "失败")}</p>` : ""}
      </div>
    </div>`;
}

async function startAdminWeiboLogin() {
  if (!isAdmin) return;
  window.clearInterval(adminWeiboQrTimer);
  adminWeiboQrState = { status: "loading", message: "正在生成微博二维码…" };
  renderAdminNewsOps(window.lastAdminInfoOps || {});
  try {
    const response = await fetch(`${ADMIN_WEIBO_LOGIN_ENDPOINT}/start`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "二维码生成失败");
    adminWeiboQrState = result;
    renderAdminNewsOps(window.lastAdminInfoOps || {});
    adminWeiboQrTimer = window.setInterval(pollAdminWeiboLogin, 2000);
  } catch (error) {
    adminWeiboQrState = { status: "failed", message: error.message || "二维码生成失败" };
    renderAdminNewsOps(window.lastAdminInfoOps || {});
  }
}

async function pollAdminWeiboLogin() {
  if (!adminWeiboQrState?.sessionId) return;
  try {
    const response = await fetch(`${ADMIN_WEIBO_LOGIN_ENDPOINT}/${encodeURIComponent(adminWeiboQrState.sessionId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "二维码状态读取失败");
    adminWeiboQrState = result;
    renderAdminNewsOps(window.lastAdminInfoOps || {});
    if (["success", "failed", "expired"].includes(result.status)) {
      window.clearInterval(adminWeiboQrTimer);
      if (result.status === "success") {
        showToast("微博 Cookie 已更新");
        renderAdmin();
      }
    }
  } catch (error) {
    window.clearInterval(adminWeiboQrTimer);
    adminWeiboQrState = { ...adminWeiboQrState, status: "failed", message: error.message || "扫码登录失败" };
    renderAdminNewsOps(window.lastAdminInfoOps || {});
  }
}

function renderAdminCatalogOps(data = {}) {
  if (!ui.adminCatalogOps) return;
  const weekly = data.weeklyRun || {};
  const healthLabel = data.health === "ok" ? "周更正常" : data.health === "bad" ? "周更异常" : "需要确认";
  const brandRows = (data.recentBrands?.length ? data.recentBrands : data.topBrands || []).map((row) => ({
    label: row.brand,
    value: `${row.count} 条`,
  }));
  const runRows = (data.recentRuns || []).slice(0, 4).map((row) => ({
    label: row.task,
    value: `${row.status}${row.finished_at || row.started_at ? ` · ${adminRelativeTime(row.finished_at || row.started_at)}` : ""}`,
  }));
  const noteRows = (data.recentNotes || []).slice(0, 4).map((row) => ({
    label: row.title,
    value: adminRelativeTime(row.created_at),
  }));
  const sourceRows = (weekly.sources || []).map((source) => ({
    label: source.label,
    value: `${source.status === "ok" ? "成功" : "失败"} · +${source.created || 0} / 更 ${source.updated || 0}`,
  }));
  const stageRows = (weekly.stages || []).map((stage) => ({
    label: stage.label,
    value: `${stage.status === "ok" ? "完成" : stage.status === "skipped" ? "跳过" : stage.status === "failed" ? "失败" : "待确认"} · ${stage.detail || ""}`,
  }));
  const weeklyStatusClass = weekly.status === "ok" ? "ok" : weekly.status === "failed" || weekly.status === "missing" ? "bad" : "warn";
  const progress = weekly.stageTotal ? Math.round(((weekly.stageDone || 0) / weekly.stageTotal) * 100) : 0;
  ui.adminCatalogOps.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">CATALOG WEEKLY</p>
        <h3>图鉴维护进度</h3>
      </div>
      ${renderAdminHealth(data.health, healthLabel)}
    </div>
    <div class="admin-kv-grid">
      ${renderAdminMetric("已发布", data.totalPublished ?? 0)}
      ${renderAdminMetric("7 天新增", data.added7d ?? 0)}
      ${renderAdminMetric("7 天更新", data.updated7d ?? 0)}
      ${renderAdminMetric("待处理", data.pending ?? 0)}
    </div>
    <div class="admin-weekly-status ${weeklyStatusClass}">
      <div>
        <span>周更流程</span>
        <strong>${escapeHtml(weekly.statusLabel || "尚无周更报告")}</strong>
        <em>${escapeHtml(weekly.finishedAt ? `${adminRelativeTime(weekly.finishedAt)}结束 · ${weekly.dryRun ? "试跑" : "正式运行"}` : "没有可用运行时间")}</em>
      </div>
      <b>${escapeHtml(`${weekly.successfulSourceCount ?? 0}/${weekly.expectedSourceCount ?? 0} 源`)}</b>
    </div>
    <div class="admin-flow-bar" aria-label="周更阶段进度">
      <span style="width:${Math.max(0, Math.min(100, progress))}%"></span>
    </div>
    <div class="admin-two-col admin-flow-grid">
      <div>
        <h4>流程阶段</h4>
        ${renderAdminSimpleRows(stageRows, { empty: "暂无流程阶段记录" })}
      </div>
      <div>
        <h4>来源覆盖</h4>
        ${renderAdminSimpleRows(sourceRows, { empty: "暂无来源运行记录" })}
      </div>
    </div>
    <div class="admin-two-col">
      <div>
        <h4>${data.recentBrands?.length ? "本周新增品牌" : "条目最多品牌"}</h4>
        ${renderAdminSimpleRows(brandRows, { empty: "本周暂无新增品牌" })}
      </div>
      <div>
        <h4>最近维护</h4>
        ${renderAdminSimpleRows(runRows, { empty: "暂无维护运行记录" })}
      </div>
    </div>
    <div class="admin-mini-list">
      <h4>最近图鉴公告</h4>
      ${renderAdminSimpleRows(noteRows, { empty: "暂无图鉴公告" })}
    </div>`;
}

function renderAdminNewsOps(data = {}) {
  if (!ui.adminNewsOps) return;
  window.lastAdminInfoOps = data;
  const healthLabel = data.health === "ok" ? "运行正常" : data.health === "bad" ? "当前故障" : "有待处理项";
  const sourceRows = (data.sourceStatuses || [])
    .filter((row) => row.adapterKey !== "weibo")
    .slice(0, 5)
    .map((row) => ({
    label: row.name,
    value: adminSourceStatusText(row),
    }));
  const currentErrors = data.currentErrors || [];
  const errorRows = currentErrors.slice(0, 6).map((row) => ({
    label: row.source_name || row.adapter_key || "抓取错误",
    value: `${row.label || "错误"} · ${adminRelativeTime(row.created_at)}`,
  }));
  const weibo = data.weiboOps || {};
  const diagnosis = weibo.diagnosis || {};
  const cookieText = weibo.cookieNeedsRefresh ? "需要更新" : "未见失效";
  const weiboSourceRows = (weibo.sources || []).slice(0, 8).map((row) => ({
    label: row.name,
    value: adminSourceStatusText(row),
  }));
  const weiboActiveErrors = weibo.activeErrors || [];
  const weiboHistoryErrors = weibo.historyErrors || [];
  const errorGroupRows = (data.errorGroups || []).map((row) => ({
    label: row.label,
    value: `${row.count} 条`,
  }));
  ui.adminNewsOps.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">HOURLY INTEL</p>
        <h3>资讯抓取健康</h3>
      </div>
      ${renderAdminHealth(data.health, healthLabel)}
    </div>
    <div class="admin-kv-grid">
      ${renderAdminMetric("1h 抓取", data.raw1h ?? 0)}
      ${renderAdminMetric("24h 入库", data.raw24h ?? 0)}
      ${renderAdminMetric("待审核", data.pendingReview ?? 0)}
      ${renderAdminMetric("24h 失败尝试", data.errors24h ?? 0)}
    </div>
    ${currentErrors.length ? `<details class="admin-error-drawer" open>
      <summary>当前失败详情 · ${escapeHtml(String(currentErrors.length))} 个来源需要处理</summary>
      <div class="admin-two-col">
        <div>
          <h4>失败类型</h4>
          ${renderAdminSimpleRows(errorGroupRows, { empty: "暂无失败类型" })}
        </div>
        <div>
          <h4>具体原因</h4>
          ${renderAdminErrorDetails(currentErrors)}
        </div>
      </div>
    </details>` : `<div class="admin-current-status ok"><span>当前运行</span><strong>所有资讯源均在预期窗口内完成</strong></div>`}
    <div class="admin-weibo-panel ${escapeHtml(diagnosis.level || (data.cookieNeedsRefresh ? "bad" : "ok"))}">
      <div class="admin-weibo-head">
        <div>
          <span>微博订阅 · 当前状态</span>
          <strong>${escapeHtml(diagnosis.title || `Cookie ${cookieText}`)}</strong>
          <em>${escapeHtml(diagnosis.body || "")}</em>
        </div>
        <div class="admin-weibo-actions">
          <b>${escapeHtml(String(weibo.ok ?? 0))}/${escapeHtml(String(weibo.total ?? data.weiboSources ?? 0))} 源正常</b>
          <span class="admin-weibo-cookie ${weibo.cookieNeedsRefresh ? "warn" : "ok"}">Cookie：${escapeHtml(cookieText)}</span>
          <button class="btn-line" type="button" data-admin-weibo-login>${weibo.cookieNeedsRefresh ? "扫码更新 Cookie" : "更新 Cookie"}</button>
        </div>
      </div>
      <div class="admin-weibo-metrics">
        ${renderAdminMetric("已正常运行", weibo.ok ?? 0)}
        ${renderAdminMetric("需处理", weibo.failed ?? 0)}
        ${renderAdminMetric("未按时运行", weibo.stale ?? 0)}
        ${renderAdminMetric("单轮上限", weibo.policy?.maxSourcesPerRun ?? 6, `${weibo.policy?.delayMinSeconds ?? 8}-${weibo.policy?.delayMaxSeconds ?? 18}s 间隔`)}
      </div>
      ${renderAdminWeiboQrBox()}
      <div class="admin-two-col">
        <div>
          <h4>最近运行</h4>
          ${renderAdminSimpleRows(weiboSourceRows, { empty: "暂无微博源" })}
        </div>
        <div>
          <h4>${weiboActiveErrors.length ? "当前失败原因" : "当前待办"}</h4>
          ${weiboActiveErrors.length ? renderAdminErrorDetails(weiboActiveErrors) : `<p class="admin-mini-empty">当前没有需要处理的微博源。</p>`}
        </div>
      </div>
      ${weiboHistoryErrors.length ? `<details class="admin-weibo-history">
        <summary>历史提醒 · ${escapeHtml(String(weiboHistoryErrors.length))} 条，不影响当前运行</summary>
        <div>${renderAdminErrorDetails(weiboHistoryErrors)}</div>
      </details>` : ""}
    </div>
    ${sourceRows.length || errorRows.length ? `<div class="admin-two-col">
      <div>
        <h4>其他来源状态</h4>
        ${renderAdminSimpleRows(sourceRows, { empty: "暂无非微博来源" })}
      </div>
      <div>
        <h4>当前待处理</h4>
        ${renderAdminSimpleRows(errorRows, { empty: "当前没有待处理的抓取失败" })}
      </div>
    </div>` : ""}`;
}

const pickupFeedbackStatusLabels = {
  open: "待处理",
  reviewing: "处理中",
  resolved: "已修正",
  dismissed: "已忽略",
};

const contributionTypeLabels = {
  correction: "图鉴纠错",
  supplement: "补充资料",
  photo: "玩家实拍",
};

const contributionScoreTypeOptions = [
  ["field_correction", "字段纠错", 5],
  ["missing_field", "补充缺失字段", 5],
  ["user_photo", "上传玩家实拍", 2],
  ["official_source", "补充官图 / 官方来源", 8],
  ["manual_or_box", "补充说明书 / 盒照", 10],
  ["accessory_list", "补充配件清单", 10],
  ["new_catalog", "新增图鉴", 15],
  ["major_fix", "重大错误修正", 20],
  ["malicious", "恶意提交", -10],
];

const catalogContributionFields = [
  ["name", "名称", "basic"],
  ["brand", "厂牌", "basic"],
  ["series", "系列", "basic"],
  ["work", "作品", "basic"],
  ["character", "角色", "basic"],
  ["releaseDate", "发售时间", "basic"],
  ["price", "发售价", "more"],
  ["aliases", "搜索词", "more"],
  ["description", "玩具简介", "more"],
];

const catalogContributionGroupLabels = {
  basic: "常改信息",
  more: "补充资料",
};

const catalogContributionPlaceholders = {
  price: "例如：日本发售价 12000 日元，或 RMB 699",
  aliases: "只写想新增的搜索词，例如：强自、Strike Freedom、MGEX 强袭自由",
  description: "写一小段你认为更准确的简介就好",
};

function renderContributionDiff(items = []) {
  return (items || []).map((item) => `
    <div class="admin-contrib-diff-row${item.fieldKey === "aliases" ? " alias-add" : ""}">
      <div><span>${escapeHtml(item.fieldLabel || item.fieldKey || "字段")}</span><b>${escapeHtml(item.oldValue || "空")}</b></div>
      <i data-lucide="${item.fieldKey === "aliases" ? "plus" : "arrow-right"}"></i>
      <div><span>${item.fieldKey === "aliases" ? "建议新增" : "用户建议"}</span><b>${escapeHtml(item.proposedValue || "空")}</b></div>
    </div>
  `).join("");
}

const contributionAiRecommendationLabels = {
  approve: "建议采纳",
  reject: "建议不采纳",
  needs_more: "需要补充",
  unsure: "无法判断",
};
const contributionAiVerdictLabels = {
  support: "有支持",
  conflict: "有冲突",
  insufficient: "证据不足",
  low_risk: "低风险",
};
const contributionAiVerdictTone = {
  support: "ok",
  conflict: "bad",
  insufficient: "warn",
  low_risk: "ok",
};
const contributionAiAssessmentLabels = {
  confirmed: "译名有明确依据",
  player_common: "大陆玩家常用",
  alias_only: "更适合作别名",
  conflict: "证据存在冲突",
  insufficient: "译名证据不足",
  support: "图片支持",
  not_visible: "图片无法证明",
  unavailable: "AI 未看到图片",
  consistent: "多来源一致",
  mixed: "来源说法不一",
  weak: "来源强度不足",
};
const contributionAiSourceTierLabels = {
  official: "官方",
  specialist: "资料站",
  reference: "百科",
  community: "玩家社区",
  marketplace: "交易页",
  unknown: "其他",
};

function contributionAiAssessmentTone(status = "") {
  if (["confirmed", "player_common", "support", "consistent"].includes(status)) return "ok";
  if (["conflict", "mixed"].includes(status)) return "bad";
  return "warn";
}

function normalizeContributionAiResult(aiResult = {}) {
  const result = aiResult?.result && typeof aiResult.result === "object" ? aiResult.result : aiResult;
  if (!result || typeof result !== "object" || !Object.keys(result).length) return null;
  return {
    ...result,
    reviewedAt: aiResult.reviewedAt || result.reviewedAt || "",
    model: aiResult.model || result.model || "",
    provider: aiResult.provider || result.provider || "",
    collectorProfile: aiResult.collectorProfile || result.collectorProfile || null,
    evidenceBundle: aiResult.evidenceBundle || result.evidenceBundle || null,
  };
}

function renderContributionAiReview(aiResult = {}) {
  const review = normalizeContributionAiResult(aiResult);
  if (!review) return "";
  const recommendation = review.recommendation || "unsure";
  const confidence = Math.round(Math.max(0, Math.min(1, Number(review.confidence || 0))) * 100);
  const fieldRows = (Array.isArray(review.fieldReviews) ? review.fieldReviews : []).slice(0, 3).map((field) => {
    const verdict = field.verdict || "insufficient";
    return `<div class="admin-contrib-ai-field verdict-${escapeHtml(verdict)}">
      <span class="ai-field-tone ${escapeHtml(contributionAiVerdictTone[verdict] || "warn")}">${escapeHtml(contributionAiVerdictLabels[verdict] || "待判断")}</span>
      <b>${escapeHtml(field.fieldLabel || field.fieldKey || "字段")}</b>
      ${field.reason ? `<p>${escapeHtml(field.reason)}</p>` : ""}
      ${field.suggestedValue ? `<small>建议值：${escapeHtml(field.suggestedValue)}</small>` : ""}
    </div>`;
  }).join("");
  const risks = (Array.isArray(review.risks) ? review.risks : []).slice(0, 2).map((risk) => `<span>${escapeHtml(risk)}</span>`).join("");
  const decisionReasons = (Array.isArray(review.decisionReasons) ? review.decisionReasons : []).slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
  const question = Array.isArray(review.questionsForUser) && review.questionsForUser[0] ? String(review.questionsForUser[0]) : "";
  const decision = review.adminDecision || review.suggestedAdminNote || "";
  const assessments = [
    ["术语", review.terminologyAssessment],
    ["图片", review.visualAssessment],
    ["来源", review.sourceAssessment],
  ].filter(([, item]) => item && typeof item === "object").map(([label, item]) => {
    const status = item.status || "insufficient";
    const conclusion = item.conclusion || "";
    return `<div class="admin-contrib-ai-basis tone-${escapeHtml(contributionAiAssessmentTone(status))}">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(contributionAiAssessmentLabels[status] || status)}</b>
      ${conclusion ? `<p>${escapeHtml(conclusion)}</p>` : ""}
    </div>`;
  }).join("");
  const visualObservations = (Array.isArray(review.visualAssessment?.observations) ? review.visualAssessment.observations : [])
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const evidenceUsed = (Array.isArray(review.evidenceUsed) ? review.evidenceUsed : []).slice(0, 6);
  const fallbackEvidence = (Array.isArray(review.evidenceBundle?.results) ? review.evidenceBundle.results : []).slice(0, 6);
  const evidenceRows = (evidenceUsed.length ? evidenceUsed : fallbackEvidence).map((item) => {
    const label = item.title || item.source || item.url || "参考来源";
    const tier = item.tier || "unknown";
    const claim = item.claim || item.snippet || "";
    const body = `<span>${escapeHtml(contributionAiSourceTierLabels[tier] || tier)}</span><b>${escapeHtml(label)}</b>${claim ? `<small>${escapeHtml(claim)}</small>` : ""}`;
    return item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`
      : `<div>${body}</div>`;
  }).join("");
  const visualEvidence = (Array.isArray(review.evidenceBundle?.visualEvidence) ? review.evidenceBundle.visualEvidence : []).slice(0, 4);
  const imageRows = visualEvidence.map((image, index) => `<figure>
    <img src="${escapeHtml(image.url || "")}" alt="${escapeHtml(image.label || `考据图 ${index + 1}`)}" loading="lazy" />
    <figcaption>${escapeHtml(image.label || `考据图 ${index + 1}`)}</figcaption>
  </figure>`).join("");
  const vision = review.evidenceBundle?.vision || {};
  const profileLabel = review.collectorProfile?.label || review.evidenceBundle?.collectorProfile?.label || "玩具收藏圈考据";
  return `<section class="admin-contrib-ai ai-${escapeHtml(recommendation)}">
    <div class="admin-contrib-ai-head">
      <div>
        <span>${escapeHtml(profileLabel)}</span>
        <b>${escapeHtml(contributionAiRecommendationLabels[recommendation] || recommendation)}</b>
      </div>
      <strong>可信度 ${confidence}%</strong>
    </div>
    ${review.identityConclusion ? `<p class="admin-contrib-ai-identity"><b>商品身份</b>${escapeHtml(review.identityConclusion)}</p>` : ""}
    ${review.summary ? `<p class="admin-contrib-ai-summary">${escapeHtml(review.summary)}</p>` : ""}
    ${decision ? `<p class="admin-contrib-ai-decision">${escapeHtml(decision)}</p>` : ""}
    ${review.confidenceReason ? `<p class="admin-contrib-ai-confidence">信心依据：${escapeHtml(review.confidenceReason)}</p>` : ""}
    ${assessments ? `<div class="admin-contrib-ai-basis-grid">${assessments}</div>` : ""}
    ${visualObservations ? `<div class="admin-contrib-ai-list"><b>AI 实际看到</b><ul>${visualObservations}</ul></div>` : ""}
    ${imageRows ? `<div class="admin-contrib-ai-visuals">${imageRows}</div><p class="admin-contrib-ai-vision-state">${vision.used ? `视觉取证已查看 ${Number(vision.requestedImages || visualEvidence.length)} 张图 · ${escapeHtml([vision.provider, vision.model].filter(Boolean).join(" / ") || "多模态模型")}` : "视觉取证未成功，这些图只供管理员人工参考，AI 结论不得当作看图结论"}</p>` : ""}
    ${fieldRows ? `<div class="admin-contrib-ai-fields">${fieldRows}</div>` : ""}
    ${decisionReasons ? `<div class="admin-contrib-ai-list"><b>决策依据</b><ul>${decisionReasons}</ul></div>` : ""}
    ${evidenceRows ? `<div class="admin-contrib-ai-sources"><b>实际引用证据</b><div>${evidenceRows}</div></div>` : ""}
    ${risks ? `<div class="admin-contrib-ai-tags">${risks}</div>` : ""}
    ${question ? `<p class="admin-contrib-ai-note">需补充：${escapeHtml(question)}</p>` : ""}
    <footer>${escapeHtml([review.provider, review.model].filter(Boolean).join(" / ") || "AI")} · ${escapeHtml(review.reviewedAt ? adminRelativeTime(review.reviewedAt) : "考据结果")} · 仅供管理员参考</footer>
  </section>`;
}

function contributionDefaultScoreType(items = []) {
  const first = items[0] || {};
  if (first.fieldKey === "description" || first.fieldKey === "aliases") return "missing_field";
  return "field_correction";
}

function renderAdminContributionOps(ops = {}) {
  if (!ui.adminContributionOps) return;
  const items = ops.items || [];
  const pending = Number(ops.totalOpen || 0);
  const rows = items.length
    ? items.map((item) => {
        const canApply = item.statusGroup === "open" && (item.items || []).some((it) => it.writable);
        const canHandle = item.statusGroup === "open";
        const evidence = (item.evidence || []).map((ev) => ev.url ? `<a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.text || ev.url)}</a>` : `<span>${escapeHtml(ev.text || "")}</span>`).join("");
        const defaultType = contributionDefaultScoreType(item.items || []);
        const defaultScore = contributionScoreTypeOptions.find(([key]) => key === defaultType)?.[2] ?? 5;
        return `<article class="admin-contrib-item contrib-${escapeHtml(item.statusGroup || "open")}" data-contribution-id="${escapeHtml(item.id)}">
          <div class="admin-feedback-top">
            <span class="admin-feedback-status">${escapeHtml(item.statusLabel || item.status)}</span>
            <time>${escapeHtml(adminRelativeTime(item.createdAt))}</time>
          </div>
          <h4>${escapeHtml(item.targetName || item.targetId || "未知图鉴")}</h4>
          <p class="admin-feedback-hint">${escapeHtml(contributionTypeLabels[item.type] || item.type)} · ${escapeHtml(item.sourceClient || "unknown")}</p>
          <div class="admin-contrib-diff">${renderContributionDiff(item.items || [])}</div>
          ${item.userNote ? `<p class="admin-feedback-message">${escapeHtml(item.userNote)}</p>` : ""}
          ${item.sourceText || evidence ? `<div class="admin-feedback-meta">${item.sourceText ? `<span>${escapeHtml(item.sourceText)}</span>` : ""}${evidence}</div>` : ""}
          ${renderContributionAiReview(item.aiResult)}
          ${canHandle ? `<div class="admin-contrib-score">
            <label>
              <span>贡献类型</span>
              <select data-contribution-score-type>
                ${contributionScoreTypeOptions.map(([key, label, score]) => `<option value="${escapeHtml(key)}" data-score="${score}"${key === defaultType ? " selected" : ""}>${escapeHtml(label)} · ${score > 0 ? `+${score}` : score}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>贡献值</span>
              <input data-contribution-score type="number" min="-50" max="50" step="1" value="${defaultScore}" />
            </label>
          </div>` : ""}
          <div class="admin-feedback-meta">
            <span>${escapeHtml(item.submitterUsername || "匿名用户")}</span>
            <span>${escapeHtml(item.targetId || "")}</span>
            ${item.adminNote ? `<span>${escapeHtml(item.adminNote)}</span>` : ""}
          </div>
          ${canHandle ? `<div class="admin-feedback-actions">
            ${item.status === "pending" ? `<button class="btn-line" type="button" data-contribution-status="reviewing">标记审核中</button>` : ""}
            <button class="btn-line ai" type="button" data-contribution-action="ai-review">AI 深度考据</button>
            ${canApply ? `<button class="btn-line approve" type="button" data-contribution-action="apply">应用到图鉴</button>` : ""}
            <button class="btn-line" type="button" data-contribution-status="needs_more">要求补充</button>
            <button class="btn-line danger" type="button" data-contribution-status="rejected">拒绝</button>
          </div>` : ""}
        </article>`;
      }).join("")
    : `<p class="admin-mini-empty">还没有待审图鉴贡献。</p>`;
  ui.adminContributionOps.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">CATALOG CONTRIBUTIONS</p>
        <h3>图鉴贡献审核</h3>
      </div>
      <div class="admin-contrib-head-actions">
        ${renderAdminHealth(pending > 0 ? "warn" : "ok", pending > 0 ? `${pending} 条待审核` : "暂无待审")}
        ${pending > 0 ? `<button class="btn-line ai" type="button" data-contribution-action="ai-review-batch">批量考据</button>` : ""}
      </div>
    </div>
    <div class="admin-feedback-list admin-contrib-list">
      ${rows}
    </div>`;
  window.lucide?.createIcons();
}

const catalogSubmissionEditorFields = [
  ["name", "玩具名称", true],
  ["brand", "厂牌", false],
  ["modelNumber", "官方编号", false],
  ["category", "收藏分类", false],
  ["series", "系列", false],
  ["scale", "比例 / 尺寸", false],
  ["work", "作品 / IP", false],
  ["character", "角色", false],
  ["releaseDate", "发售日期", false],
  ["price", "参考定价", false],
  ["aliases", "别名 / 搜索词", false],
];

function catalogSubmissionStatusClass(status = "") {
  if (["ready_for_review"].includes(status)) return "ok";
  if (["duplicate_suspected", "needs_more", "risk_review"].includes(status)) return "warn";
  return "pending";
}

function catalogSubmissionValue(proposal = {}, key) {
  if (key === "aliases") return Array.isArray(proposal.aliases) ? proposal.aliases.join("、") : String(proposal.aliases || "");
  if (key === "price") return proposal.price === 0 || proposal.price ? String(proposal.price) : "";
  return String(proposal[key] || "");
}

function renderCatalogSubmissionAiReview(aiResult = {}) {
  const result = aiResult?.result || {};
  const summary = result.summary || "AI 初审尚未返回结论。";
  const missing = Array.isArray(result.missing) ? result.missing.slice(0, 6) : [];
  const risks = Array.isArray(result.risks) ? result.risks.slice(0, 6) : [];
  const mode = result.mode === "ai" ? "AI 初审" : "规则初审";
  return `<section class="catalog-submission-ai">
    <div><b>${escapeHtml(mode)}</b><span>${escapeHtml(summary)}</span></div>
    ${missing.length ? `<p><strong>待补充</strong>${missing.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</p>` : ""}
    ${risks.length ? `<p class="risk"><strong>风险提示</strong>${risks.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</p>` : ""}
  </section>`;
}

function renderAdminCatalogSubmissionOps(ops = {}) {
  if (!ui.adminCatalogSubmissionOps) return;
  const items = Array.isArray(ops.items) ? ops.items : [];
  const rows = items.length
    ? items.map((item) => {
        const proposal = item.proposed || {};
        const canReview = !["published", "merged", "rejected"].includes(item.status);
        const fields = catalogSubmissionEditorFields.map(([key, label, required]) => `<label>
          <span>${escapeHtml(label)}${required ? " <b>必填</b>" : ""}</span>
          <input data-catalog-submission-field="${escapeHtml(key)}" value="${escapeHtml(catalogSubmissionValue(proposal, key))}"${required ? " required" : ""} />
        </label>`).join("");
        const media = (item.media || []).map((media, index) => `<a href="${escapeHtml(media.imageUrl || media.assetPath || "")}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(media.imageUrl || media.assetPath || "")}" alt="投稿素材 ${index + 1}" loading="lazy" /><span>${escapeHtml({ official: "产品图", package: "包装 / 说明书", player: "玩家实拍" }[media.kind] || "投稿素材")}</span></a>`).join("");
        const sources = (item.sourceLinks || []).map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`).join("");
        const candidates = (item.candidates || []).slice(0, 5).map((candidate) => `<button class="catalog-submission-candidate" type="button" data-catalog-submission-action="merge" data-catalog-submission-target="${escapeHtml(candidate.catalogId || "")}">
          合并到 ${escapeHtml(candidate.name || candidate.catalogId || "候选词条")} · ${Math.round(Number(candidate.score || 0) * 100)}%
        </button>`).join("");
        return `<article class="catalog-submission-card" data-catalog-submission-id="${escapeHtml(item.id)}">
          <div class="admin-feedback-top">
            <span class="admin-feedback-status ${catalogSubmissionStatusClass(item.status)}">${escapeHtml(item.statusLabel || item.status || "审核中")}</span>
            <time>${escapeHtml(adminRelativeTime(item.createdAt))}</time>
          </div>
          <h4>${escapeHtml(proposal.name || "未命名图鉴草稿")}</h4>
          <p class="admin-feedback-hint">投稿人：${escapeHtml(item.submitterUsername || "匿名用户")} · ${escapeHtml(item.id)}</p>
          <section class="catalog-submission-editor">
            <div class="catalog-submission-editor-head">
              <div><span>FINAL CATALOG DRAFT</span><b>管理员收录稿</b></div>
              <p>可直接修正后收录；原始投稿和审核记录会保留。</p>
            </div>
            <div class="catalog-submission-fields">${fields}</div>
            <label class="catalog-submission-editor-wide"><span>产品简介</span><textarea data-catalog-submission-field="description" rows="4">${escapeHtml(catalogSubmissionValue(proposal, "description"))}</textarea></label>
          </section>
          ${proposal.userNote ? `<div class="catalog-submission-user-note"><b>投稿人说明</b><p>${escapeHtml(proposal.userNote)}</p></div>` : ""}
          ${media ? `<div class="catalog-submission-media">${media}</div>` : ""}
          ${sources ? `<div class="catalog-submission-sources"><b>来源链接</b>${sources}</div>` : ""}
          ${renderCatalogSubmissionAiReview(item.aiResult)}
          ${candidates ? `<div class="catalog-submission-candidates"><b>疑似重复候选</b><div>${candidates}</div></div>` : ""}
          ${item.adminNote ? `<p class="admin-feedback-message">上次审核说明：${escapeHtml(item.adminNote)}</p>` : ""}
          ${canReview ? `<div class="admin-feedback-actions catalog-submission-actions">
            <button class="btn-line ai" type="button" data-catalog-submission-action="rerun">重新 AI 初审</button>
            <button class="btn-line approve" type="button" data-catalog-submission-action="publish">收录新词条</button>
            <button class="btn-line" type="button" data-catalog-submission-action="needs_more">要求补充</button>
            <button class="btn-line danger" type="button" data-catalog-submission-action="reject">拒绝</button>
          </div>` : ""}
        </article>`;
      }).join("")
    : `<p class="admin-mini-empty">还没有待处理的图鉴建档草稿。</p>`;
  ui.adminCatalogSubmissionOps.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">COMMUNITY CATALOG</p>
        <h3>图鉴建档审核</h3>
      </div>
      ${renderAdminHealth(items.length ? "warn" : "ok", items.length ? `${items.length} 条待审核` : "暂无待审")}
    </div>
    <div class="admin-feedback-list catalog-submission-list">${rows}</div>`;
}

function catalogSubmissionFinalDraft(card) {
  const finalDraft = {};
  card?.querySelectorAll("[data-catalog-submission-field]").forEach((field) => {
    finalDraft[field.dataset.catalogSubmissionField] = String(field.value || "").trim();
  });
  return finalDraft;
}

async function updateCatalogSubmissionReview(card, action, extra = {}) {
  const id = card?.dataset.catalogSubmissionId;
  if (!id) return;
  const button = card.querySelector(`[data-catalog-submission-action="${CSS.escape(action)}"]`);
  const originalText = button?.textContent || "";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "处理中...";
    }
    const body = { action, ...extra };
    if (action === "publish") body.final = catalogSubmissionFinalDraft(card);
    const response = await fetch(`${ADMIN_CATALOG_SUBMISSIONS_ENDPOINT}/${encodeURIComponent(id)}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "审核更新失败");
    showToast(action === "publish" ? "已收录到正式图鉴" : action === "merge" ? "已合并到现有图鉴" : "审核状态已更新");
    renderAdmin();
    if (action === "publish" || action === "merge") renderCatalog();
  } catch (error) {
    showToast(error.message || "审核更新失败");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function rerunCatalogSubmissionAiReview(card) {
  const id = card?.dataset.catalogSubmissionId;
  if (!id) return;
  const button = card.querySelector('[data-catalog-submission-action="rerun"]');
  const originalText = button?.textContent || "";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "AI 初审中...";
    }
    const response = await fetch(`${ADMIN_CATALOG_SUBMISSIONS_ENDPOINT}/${encodeURIComponent(id)}/ai-review`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "AI 初审失败");
    showToast("AI 初审结果已更新");
    renderAdmin();
  } catch (error) {
    showToast(error.message || "AI 初审失败");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function updateContributionStatus(id, status) {
  if (!id || !status) return;
  const body = { status };
  if (status === "rejected") {
    const reason = window.prompt("请填写未采纳原因，用户会在“我的贡献”里看到。");
    if (!reason || !reason.trim()) {
      showToast("拒绝贡献需要填写原因");
      return;
    }
    body.adminNote = reason.trim();
  } else if (status === "needs_more") {
    const note = window.prompt("请写一句需要补充的内容，用户会在“我的贡献”里看到。");
    if (!note || !note.trim()) {
      showToast("请填写需要补充的说明");
      return;
    }
    body.adminNote = note.trim();
  }
  try {
    const response = await fetch(`${ADMIN_CONTRIBUTIONS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("处理失败");
    showToast("图鉴贡献状态已更新");
    renderAdmin();
  } catch (error) {
    showToast(error.message || "处理失败，请重试");
  }
}

async function applyContribution(id) {
  if (!id) return;
  try {
    const card = document.querySelector(`[data-contribution-id="${CSS.escape(id)}"]`);
    const contributionType = card?.querySelector("[data-contribution-score-type]")?.value || "field_correction";
    const score = Number(card?.querySelector("[data-contribution-score]")?.value || 0);
    const response = await fetch(`${ADMIN_CONTRIBUTIONS_ENDPOINT}/${encodeURIComponent(id)}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve", adminNote: "网页端审核通过", contributionType, score }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "应用失败");
    const points = Number(result.contribution?.pointsAwarded || 0);
    showToast(points > 0 ? `已应用到正式图鉴，贡献值 +${points}` : "已应用到正式图鉴");
    renderAdmin();
    if (activeView === "catalog") renderCatalog();
  } catch (error) {
    showToast(error.message || "应用失败，请重试");
  }
}

async function aiReviewContribution(id) {
  if (!id) return;
  const card = document.querySelector(`[data-contribution-id="${CSS.escape(id)}"]`);
  const button = card?.querySelector('[data-contribution-action="ai-review"]');
  const originalText = button?.textContent || "";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "正在查图和资料...";
    }
    const response = await fetch(`${ADMIN_CONTRIBUTIONS_ENDPOINT}/${encodeURIComponent(id)}/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "test" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "AI 深度考据失败");
    showToast("AI 收藏圈考据报告已生成，未改变审核状态");
    renderAdmin();
  } catch (error) {
    showToast(error.message === "AI_KEY_NOT_CONFIGURED" ? "AI key 未配置，暂时不能考据" : (error.message || "AI 深度考据失败"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "AI 深度考据";
    }
  }
}

async function aiReviewContributionBatch(button) {
  const originalText = button?.textContent || "";
  const cards = [...document.querySelectorAll("[data-contribution-id]")]
    .filter((card) => card.querySelector('[data-contribution-action="ai-review"]'))
    .slice(0, 6);
  if (!cards.length) {
    showToast("当前列表没有需要预审的贡献");
    return;
  }
  let reviewed = 0;
  let failed = 0;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = `预审 0/${cards.length}`;
    }
    for (let index = 0; index < cards.length; index += 1) {
      const id = cards[index].dataset.contributionId;
      const itemButton = cards[index].querySelector('[data-contribution-action="ai-review"]');
      if (button) button.textContent = `预审 ${index + 1}/${cards.length}`;
      if (itemButton) {
        itemButton.disabled = true;
        itemButton.textContent = "预审中...";
      }
      try {
        const response = await fetch(`${ADMIN_CONTRIBUTIONS_ENDPOINT}/${encodeURIComponent(id)}/ai-review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "test", light: true }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.error || "AI 深度考据失败");
        reviewed += 1;
      } catch {
        failed += 1;
      } finally {
        if (itemButton) {
          itemButton.disabled = false;
          itemButton.textContent = "AI 深度考据";
        }
      }
    }
    showToast(`已完成收藏圈考据 ${reviewed} 条${failed ? `，失败 ${failed} 条` : ""}`);
    renderAdmin();
  } catch (error) {
    showToast(error.message === "AI_KEY_NOT_CONFIGURED" ? "AI key 未配置，暂时不能考据" : (error.message || "批量考据失败"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "批量考据";
    }
  }
}

function contributionStatusText(status = "") {
  return {
    pending: "审核中",
    ai_reviewed: "审核中",
    reviewing: "审核中",
    needs_more: "需要补充",
    approved: "已采纳",
    applied: "已采纳",
    rejected: "未采纳",
  }[status] || status || "审核中";
}

function contributionStatusClass(status = "") {
  if (["approved", "applied"].includes(status)) return "ok";
  if (status === "rejected") return "bad";
  if (status === "needs_more") return "warn";
  return "pending";
}

function contributionScoreText(value = 0) {
  const score = Number(value || 0);
  if (score > 0) return `+${score}`;
  if (score < 0) return String(score);
  return "";
}

const contributionRankVisuals = {
  1: { icon: "tag", benefits: ["我的贡献页保留记录"] },
  2: { icon: "shield", benefits: ["头像旁展示基础贡献徽章", "图鉴页展示贡献者名字"] },
  3: { icon: "compass", benefits: ["个人主页展示贡献成就卡", "可进入本月贡献榜"] },
  4: { icon: "cpu", benefits: ["贡献提交进入优先审核队列", "可申请新增图鉴"] },
  5: { icon: "crown", benefits: ["解锁专属称号", "可申请认领品牌或系列专题"] },
  6: { icon: "gem", benefits: ["获得可信贡献者标识", "低风险贡献进入快速审核队列"] },
  7: { icon: "orbit", benefits: ["获得图鉴共建者身份标识", "可进入贡献名人堂"] },
};

const contributionBadgeCatalog = [
  { id: "first_contribution", name: "首条贡献", icon: "zap", imageUrl: "./assets/badges/badge_first.jpg", description: "第一条图鉴贡献被管理员采纳。", condition: "采纳 1 次" },
  { id: "accepted_10", name: "10 次采纳", icon: "award", imageUrl: "./assets/badges/badge_10.jpg", description: "累计 10 次信息被图鉴管理员采纳。", condition: "采纳 10 次" },
  { id: "accepted_50", name: "50 次采纳", icon: "shield", imageUrl: "./assets/badges/badge_50.jpg", description: "累计 50 次信息被图鉴管理员采纳。", condition: "采纳 50 次" },
  { id: "accepted_100", name: "100 次采纳", icon: "crown", imageUrl: "./assets/badges/badge_100.jpg", description: "累计 100 次信息被图鉴管理员采纳。", condition: "采纳 100 次" },
  { id: "new_catalog_10", name: "新增图鉴 10 条", icon: "plus-circle", imageUrl: "./assets/badges/badge_new_10.jpg", description: "主导新增并完善 10 个以上新玩具条目。", condition: "新增图鉴被采纳 10 次" },
  { id: "correction_expert", name: "纠错达人", icon: "search", imageUrl: "./assets/badges/badge_fixer.jpg", description: "多次修正图鉴中的字段错误。", condition: "字段纠错被采纳 20 次" },
  { id: "photo_contributor", name: "图片贡献者", icon: "camera", imageUrl: "./assets/badges/badge_shutter.jpg", description: "玩家实拍或图片资料贡献被采纳。", condition: "图片贡献被采纳 5 次" },
  { id: "researcher", name: "资料考据员", icon: "book-open", imageUrl: "./assets/badges/badge_researcher.jpg", description: "补充官方来源或关键资料并被采纳。", condition: "官方来源贡献被采纳 5 次" },
  { id: "accessory_expert", name: "配件清单专家", icon: "activity", imageUrl: "./assets/badges/badge_accessories.jpg", description: "为条目补充精细配件清单。", condition: "配件清单贡献被采纳 5 次" },
  { id: "manual_collector", name: "说明书收藏家", icon: "file-text", imageUrl: "./assets/badges/badge_manual.jpg", description: "补充说明书或盒照资料。", condition: "说明书/盒照贡献被采纳 5 次" },
  { id: "high_acceptance", name: "高采纳率贡献者", icon: "thumbs-up", imageUrl: "./assets/badges/badge_elite.jpg", description: "长期保持高质量贡献和高采纳率。", condition: "采纳数 >= 10 且通过率 >= 80%" },
];

let contributionUnlockedBadgeIds = new Set();

function formatContributionRank(value = {}) {
  const level = value.level || {};
  const levelNumber = Number(level.level || 1);
  const visual = contributionRankVisuals[levelNumber] || contributionRankVisuals[1];
  const points = Number(value.points || 0);
  const progress = Math.max(0, Math.min(100, Number(level.progress || 0)));
  const rank = Number(value.rank || 0);
  const totalRanked = Number(value.totalRanked || 0);
  return {
    level: levelNumber,
    title: level.title || "新晋记录员",
    tier: level.tier || "I",
    icon: visual.icon,
    benefits: visual.benefits,
    nextTitle: level.nextTitle || "",
    points,
    progress,
    desc: Number(level.nextAt || 0) > 0
      ? `距离${level.nextTitle ? `「${level.nextTitle}」` : "下一段位"}还差 ${Number(level.remaining || 0)} 点`
      : "你已经站在图鉴贡献的最高段位。",
    accepted: Number(value.accepted || 0),
    pending: Number(value.pending || 0),
    rejected: Number(value.rejected || 0),
    approvalRate: Number(value.approvalRate || 0),
    monthlyScore: Number(value.monthlyScore || 0),
    rankLabel: rank > 0 ? `${rank}/${totalRanked || rank}` : "预留",
    className: level.className || "rank-rookie",
  };
}

function renderContributionRank(value = {}) {
  if (!ui.contributionRankCard) return;
  const rank = formatContributionRank(value);
  const userName = currentUsername || accountStatus?.username || "玩家";
  const initial = String(userName || "玩").trim().slice(0, 1).toUpperCase();
  const currentLabel = `Lv.${rank.level} ${rank.title}`;
  const nextLabel = rank.nextTitle ? `Lv.${rank.level + 1} ${rank.nextTitle}` : "MAX";
  ui.contributionRankCard.className = `contribution-rank-card rank-theme-${rank.level} ${String(rank.className || "").replace(/[^a-z0-9_-]/gi, "")}`;
  ui.contributionRankCard.innerHTML = `
    <div class="contrib-user-panel">
      <div class="user-info-header">
        <div class="avatar-container">
          <div class="user-avatar">${escapeHtml(initial)}</div>
          <span class="level-indicator">Lv.${rank.level}</span>
        </div>
        <div class="user-meta">
          <h2 class="user-name">${escapeHtml(userName)}</h2>
          <p class="user-title">${escapeHtml(rank.title)} · ${escapeHtml(rank.tier)}</p>
        </div>
      </div>

      <div class="rank-card-container">
        <div class="rank-card rank-theme-${rank.level}">
          <div class="rank-card-overlay"></div>
          <div class="rank-card-badge-icon"><i data-lucide="${escapeHtml(rank.icon)}"></i></div>
          <div class="rank-card-corners">
            <span class="corner tl"></span><span class="corner tr"></span>
            <span class="corner bl"></span><span class="corner br"></span>
          </div>
          <div class="rank-card-content">
            <div class="card-title-group">
              <span class="card-label">ARCHIVE PASS</span>
              <span class="card-sys">[ VERIFIED ]</span>
            </div>
            <div class="card-main-rank">${escapeHtml(rank.title)}</div>
            <div class="card-score-group">
              <div class="score-item">
                <span class="score-label">贡献值</span>
                <span class="score-val">${rank.points}</span>
              </div>
              <div class="score-item align-right">
                <span class="score-label">通过率</span>
                <span class="score-val">${rank.approvalRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-labels">
          <span>${escapeHtml(currentLabel)}</span>
          <span>${escapeHtml(nextLabel)}</span>
        </div>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${rank.progress}%"></div></div>
        <p class="progress-hint">${escapeHtml(rank.desc)}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-box"><span class="stat-num">${rank.accepted}</span><span class="stat-label">被采纳数</span></div>
        <div class="stat-box"><span class="stat-num">${rank.pending}</span><span class="stat-label">待审核</span></div>
        <div class="stat-box"><span class="stat-num">${rank.rejected}</span><span class="stat-label">未采纳</span></div>
        <div class="stat-box"><span class="stat-num">${escapeHtml(rank.rankLabel)}</span><span class="stat-label">本月排名</span></div>
      </div>

      <div class="benefits-wrap">
        <h3>当前解锁权益</h3>
        <ul class="benefits-list">
          ${rank.benefits.map((item) => `<li><i data-lucide="check-circle" class="icon-cyan"></i>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
  window.lucide?.createIcons?.();
}

function renderContributionNotifications(items = []) {
  if (!ui.contributionNoticeCard) return;
  const rows = (items || []).slice(0, 4);
  ui.contributionNoticeCard.innerHTML = `
    <h3>最近通知</h3>
    ${rows.length ? `<div class="contrib-notice-list">${rows.map((item) => `
      <article class="contrib-notice">
        <strong>${escapeHtml(item.title || "图鉴通知")}</strong>
        <p>${escapeHtml(item.content || "").replace(/\n/g, "<br>")}</p>
      </article>`).join("")}</div>` : `<p class="admin-update-empty">贡献被采纳后，会在这里收到通知。</p>`}`;
}

function renderContributionBadges(items = []) {
  if (!ui.contributionBadgeCard) return;
  const unlocked = new Map((items || []).map((item) => [String(item.id || ""), item]));
  contributionUnlockedBadgeIds = new Set(unlocked.keys());
  const unlockedCount = contributionBadgeCatalog.filter((badge) => contributionUnlockedBadgeIds.has(badge.id)).length;
  ui.contributionBadgeCard.innerHTML = `
    <div class="panel-header badges-header">
      <h3><i data-lucide="award"></i> 馆员荣誉勋章</h3>
      <span class="badge-count">${unlockedCount} / ${contributionBadgeCatalog.length}</span>
    </div>
    <div class="badges-grid">
      ${contributionBadgeCatalog.map((badge) => {
        const serverBadge = unlocked.get(badge.id) || {};
        const name = serverBadge.name || badge.name;
        const isUnlocked = contributionUnlockedBadgeIds.has(badge.id);
        return `<button class="badge-item ${isUnlocked ? "unlocked" : ""}" type="button" data-badge-id="${escapeHtml(badge.id)}" aria-label="${escapeHtml(name)}">
          <span class="badge-icon-box">
            <img src="${escapeHtml(badge.imageUrl)}" alt="${escapeHtml(name)}" class="badge-image-icon" loading="lazy" />
          </span>
          <span class="badge-name-lbl">${escapeHtml(name)}</span>
        </button>`;
      }).join("")}
    </div>`;
  window.lucide?.createIcons?.();
}

function contributionBadgeInfo(id = "") {
  const badge = contributionBadgeCatalog.find((item) => item.id === id);
  if (!badge) return null;
  return {
    ...badge,
    unlocked: contributionUnlockedBadgeIds.has(id),
  };
}

function showContributionBadgeTooltip(event) {
  const target = event.target.closest("[data-badge-id]");
  const badge = contributionBadgeInfo(target?.dataset.badgeId || "");
  if (!badge || !ui.contributionBadgeTooltip) return;
  ui.contributionBadgeTooltip.innerHTML = `
    <h4>${escapeHtml(badge.name)}</h4>
    <p>${escapeHtml(badge.description)}</p>
    <strong>解锁条件：${escapeHtml(badge.condition)}</strong>
    <span>${badge.unlocked ? "已获得" : "未解锁"}</span>`;
  ui.contributionBadgeTooltip.hidden = false;
  moveContributionBadgeTooltip(event);
}

function moveContributionBadgeTooltip(event) {
  if (!ui.contributionBadgeTooltip || ui.contributionBadgeTooltip.hidden) return;
  ui.contributionBadgeTooltip.style.left = `${event.clientX + 14}px`;
  ui.contributionBadgeTooltip.style.top = `${event.clientY + 14}px`;
}

function hideContributionBadgeTooltip() {
  if (ui.contributionBadgeTooltip) ui.contributionBadgeTooltip.hidden = true;
}

function renderContributionRecordProposal(item = {}) {
  const first = item.items?.[0] || {};
  if (!first.proposedValue) return "";
  const proposed = escapeHtml(first.proposedValue);
  if (first.fieldKey === "aliases") {
    return `<div class="contrib-alias-proposal">
      <span>新增搜索词</span>
      <strong>${proposed}</strong>
      <small>原有搜索词会保留，这次贡献只追加可用词。</small>
    </div>`;
  }
  return `<div>修改提案：${first.oldValue ? `从 <s>${escapeHtml(first.oldValue)}</s> ` : ""}调整为 <strong>${proposed}</strong></div>`;
}

function renderContributionRecords(items = []) {
  if (!ui.contributionRecordList) return;
  const rows = items || [];
  if (ui.contributionRecordCount) ui.contributionRecordCount.textContent = `${rows.length} 条`;
  ui.contributionRecordList.innerHTML = rows.length
    ? rows.map((item) => {
        const first = item.items?.[0] || {};
        const score = contributionScoreText(item.contributionScore);
        const statusClass = contributionStatusClass(item.status);
        const typeLabel = item.contributionTypeLabel || first.fieldLabel || item.type || "图鉴贡献";
        const note = item.adminNote || item.contributionDescription || item.userNote || "";
        return `<article class="contrib-record log-item ${statusClass}" data-contribution-target="${escapeHtml(item.targetId || "")}">
          <div class="log-header">
            <div class="log-title-row">
              <span class="log-type">${escapeHtml(item.targetName || "未知图鉴")}</span>
              <span class="log-status-badge ${statusClass}">${escapeHtml(contributionStatusText(item.status))}</span>
            </div>
            ${score ? `<span class="log-score-gain ${Number(item.contributionScore || 0) > 0 ? "plus" : "minus"}">${escapeHtml(score)} 贡献值</span>` : `<span class="log-score-gain">待结算</span>`}
          </div>
          <div class="log-content">
            <div>提交类型：<strong>${escapeHtml(typeLabel)}</strong></div>
            ${first.fieldLabel ? `<div>修正字段：<strong>${escapeHtml(first.fieldLabel)}</strong></div>` : ""}
            ${renderContributionRecordProposal(item)}
            ${note ? `<div class="${item.status === "rejected" ? "reject-reason" : ""}">${item.status === "rejected" ? "处理说明：" : "备注："}${escapeHtml(note)}</div>` : ""}
          </div>
          <div class="log-footer">
            <span>来源：${escapeHtml(item.sourceClient || "web")}</span>
            <span>${escapeHtml(adminRelativeTime(item.createdAt))}</span>
          </div>
        </article>`;
      }).join("")
    : `<div class="contrib-empty"><i data-lucide="book-open-check"></i><h3>还没有图鉴贡献</h3><p>在图鉴详情页点“补充图鉴资料”，被采纳后会积累贡献值。</p></div>`;
  window.lucide?.createIcons?.();
}

async function renderContributions() {
  if (!ui.contributionPanel) return;
  if (ui.contributionRankCard) ui.contributionRankCard.innerHTML = `<p class="admin-update-empty">正在读取贡献值…</p>`;
  if (ui.contributionRecordList) ui.contributionRecordList.innerHTML = `<p class="admin-update-empty">正在读取贡献记录…</p>`;
  try {
    const response = await fetch(CONTRIBUTIONS_MINE_ENDPOINT, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "贡献记录加载失败");
    renderContributionRank(result.contributionValue || {});
    renderContributionNotifications(result.notifications || []);
    renderContributionBadges(result.badges || []);
    renderContributionRecords(result.items || []);
  } catch (error) {
    const message = "暂时无法读取图鉴贡献，请确认已登录后再试。";
    if (ui.contributionRankCard) ui.contributionRankCard.innerHTML = `<p class="admin-update-empty">${escapeHtml(message)}</p>`;
    if (ui.contributionNoticeCard) ui.contributionNoticeCard.innerHTML = `<h3>最近通知</h3><p class="admin-update-empty">暂无通知。</p>`;
    if (ui.contributionBadgeCard) ui.contributionBadgeCard.innerHTML = `<h3>获得徽章</h3><p class="admin-update-empty">暂无徽章。</p>`;
    if (ui.contributionRecordList) ui.contributionRecordList.innerHTML = `<p class="admin-update-empty">暂时无法读取贡献记录。</p>`;
  }
}

function renderAdminFeedbackRows(items = [], { kind = "pickup" } = {}) {
  return items.slice(0, 12).map((item) => {
    const status = item.status || "open";
    const canHandle = !["resolved", "dismissed"].includes(status);
    const isCatalog = kind === "catalog";
    const title = isCatalog ? (item.catalogName || item.catalogId || "未知图鉴") : (item.pickupName || item.pickupId || "未知取件表");
    const hint = isCatalog ? (item.issueType || "图鉴错误") : item.sectionHint;
    return `
      <article class="admin-feedback-item ${escapeHtml(status)}" data-feedback-kind="${escapeHtml(kind)}" data-feedback-id="${escapeHtml(item.id)}">
        <div class="admin-feedback-top">
          <span class="admin-feedback-status">${escapeHtml(pickupFeedbackStatusLabels[status] || status)}</span>
          <time>${escapeHtml(adminRelativeTime(item.createdAt))}</time>
        </div>
        <h4>${escapeHtml(title)}</h4>
        ${hint ? `<p class="admin-feedback-hint">${escapeHtml(hint)}</p>` : ""}
        <p class="admin-feedback-message">${escapeHtml(item.message)}</p>
        <div class="admin-feedback-meta">
          <span>${escapeHtml(item.reporterUsername || "匿名用户")}</span>
          <span>${escapeHtml(isCatalog ? item.catalogId : item.pickupId || "")}</span>
          ${item.adminNote ? `<span>${escapeHtml(item.adminNote)}</span>` : ""}
        </div>
        ${canHandle ? `
          <div class="admin-feedback-actions">
            ${status === "open" ? `<button class="btn-line" type="button" data-feedback-status="reviewing">标记处理中</button>` : ""}
            <button class="btn-line approve" type="button" data-feedback-status="resolved">已修正</button>
            <button class="btn-line" type="button" data-feedback-status="dismissed">忽略</button>
          </div>` : ""}
      </article>`;
  }).join("");
}

function renderAdminFeedbackOps({ pickupFeedbackOps = {}, catalogFeedbackOps = {} } = {}) {
  if (!ui.adminFeedbackOps) return;
  const pickupItems = pickupFeedbackOps.items || [];
  const catalogItems = catalogFeedbackOps.items || [];
  const totalOpen = Number(pickupFeedbackOps.totalOpen || 0) + Number(catalogFeedbackOps.totalOpen || 0);
  const catalogRows = renderAdminFeedbackRows(catalogItems, { kind: "catalog" });
  const pickupRows = renderAdminFeedbackRows(pickupItems, { kind: "pickup" });
  const rows = [
    `<div class="admin-feedback-group"><h4>图鉴错误反馈</h4>${catalogRows || `<p class="admin-mini-empty">还没有图鉴反馈。</p>`}</div>`,
    `<div class="admin-feedback-group"><h4>取件错误反馈</h4>${pickupRows || `<p class="admin-mini-empty">还没有取件反馈。</p>`}</div>`,
  ].join("");
  ui.adminFeedbackOps.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">USER FEEDBACK</p>
        <h3>用户错误反馈</h3>
      </div>
      ${renderAdminHealth(totalOpen > 0 ? "warn" : "ok", totalOpen > 0 ? `${totalOpen} 条待处理` : "暂无待处理")}
    </div>
    <div class="admin-feedback-list">
      ${rows}
    </div>`;
  window.lucide?.createIcons();
}

function renderSubmissionParts(parts = {}) {
  return Object.entries(parts || {})
    .map(([sec, runners]) =>
      `<div class="psub-sec"><b>${escapeHtml(sec)}</b> ${Object.entries(runners || {})
        .map(([r, arr]) => `${escapeHtml(r)}:${(arr || []).map(escapeHtml).join(",")}`)
        .join(" / ")}</div>`,
    )
    .join("");
}

function renderAdminPickupSubmissions(ops = {}) {
  if (!ui.adminPickupSubmissions) return;
  const items = ops.items || [];
  const pending = Number(ops.totalPending || 0);
  const statusLabel = (s) => (s === "approved" ? "已发布" : s === "rejected" ? "已驳回" : "待审核");
  const rows = items.length
    ? items
        .map((s) => {
          const isPending = s.status === "pending";
          const warn = (s.parseWarnings || []).length
            ? `<div class="psub-warn">解析提示 ${s.parseWarnings.length} 条：${escapeHtml(s.parseWarnings.slice(0, 3).join("；"))}</div>`
            : "";
          return `<article class="psub-item psub-${escapeHtml(s.status)}" data-sub-id="${escapeHtml(s.id)}">
            <div class="psub-head">
              <div><strong>${escapeHtml(s.name)}</strong> <span class="psub-spec">${escapeHtml(s.spec || "")}</span></div>
              <span class="psub-status">${statusLabel(s.status)}</span>
            </div>
            <div class="psub-meta">${s.sectionCount} 部位 · ${s.partCount} 件 · 投稿人 ${escapeHtml(s.submitter || "匿名")} · ${adminDateTime(s.createdAt)}</div>
            ${warn}
            <details class="psub-detail"><summary>预览件号</summary><div class="psub-parts">${renderSubmissionParts(s.parts)}</div></details>
            <a class="psub-export" href="${ADMIN_PICKUP_SUBMISSION_ENDPOINT}/${encodeURIComponent(s.id)}/export">⬇ 导出 Excel 核对</a>
            ${s.adminNote ? `<div class="psub-note">备注：${escapeHtml(s.adminNote)}</div>` : ""}
            ${
              isPending
                ? `<div class="psub-actions">
                    <button class="btn-line approve" type="button" data-sub-action="approve">通过并发布</button>
                    <button class="btn-line" type="button" data-sub-action="reject">驳回</button>
                  </div>`
                : s.publishedPickupId
                  ? `<div class="psub-meta muted">已发布为 ${escapeHtml(s.publishedPickupId)}</div>`
                  : ""
            }
          </article>`;
        })
        .join("")
    : `<p class="admin-mini-empty">还没有用户投稿。</p>`;
  ui.adminPickupSubmissions.innerHTML = `
    <div class="admin-card-head">
      <div>
        <p class="section-kicker">USER UPLOADS</p>
        <h3>取件表投稿</h3>
      </div>
      ${renderAdminHealth(pending > 0 ? "warn" : "ok", pending > 0 ? `${pending} 条待审` : "暂无待审")}
    </div>
    <div class="psub-list">${rows}</div>`;
  window.lucide?.createIcons();
}

async function reviewPickupSubmission(id, action) {
  if (!isAdmin || !id || !action) return;
  if (action === "reject" && !window.confirm("驳回这份投稿?")) return;
  let adminNote = "";
  if (action === "reject") adminNote = window.prompt("驳回理由(选填,会记录):") || "";
  try {
    const response = await fetch(`${ADMIN_PICKUP_SUBMISSION_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, adminNote }),
    });
    if (!response.ok) throw new Error("submission update failed");
    showToast(action === "approve" ? "已通过并发布" : "已驳回");
    renderAdmin();
  } catch {
    showToast("处理投稿失败，请重试");
  }
}

async function updateFeedbackStatus(kind, id, status) {
  if (!isAdmin || !id || !status) return;
  const endpoint = kind === "catalog" ? ADMIN_CATALOG_FEEDBACK_ENDPOINT : ADMIN_PICKUP_FEEDBACK_ENDPOINT;
  try {
    const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error("feedback update failed");
    showToast("反馈状态已更新");
    renderAdmin();
  } catch {
    showToast("处理反馈失败，请重试");
  }
}

function renderAdminAccountTable() {
  const accounts = adminAccountRows.slice(0, adminAccountVisible);
  ui.adminTableBody.innerHTML = accounts.length
    ? accounts
        .map(
          (a) => `
      <tr>
        <td class="admin-user">${escapeHtml(a.username)}${a.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ""}</td>
        <td class="num">${a.recordCount}</td>
        <td class="num">${a.preorderCount}</td>
        <td class="num">${money(a.totalPaid)}</td>
        <td class="num">${money(a.balanceDue)}</td>
        <td class="${a.lastLoginAt ? "" : "muted"}">${adminDateTime(a.lastLoginAt)}</td>
        <td class="muted">${adminDateTime(a.createdAt)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="muted">暂无账号</td></tr>`;
  if (!ui.adminAccountPager) return;
  const total = adminAccountRows.length;
  const hasMore = adminAccountVisible < total;
  ui.adminAccountPager.innerHTML = `
    <span>已显示 ${Math.min(adminAccountVisible, total)} / ${total} 个账号</span>
    ${hasMore ? `<button class="btn-line" type="button" data-admin-show-more>展开更多</button>` : ""}`;
}

// 账号看板二级标签:点标签切换 pane(各模块独立,不再全堆一页)
function setupAdminTabs() {
  const tabs = document.querySelector("#adminTabs");
  if (!tabs || tabs.dataset.bound) return;
  tabs.dataset.bound = "1";
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-tab");
    if (!btn) return;
    const pane = btn.dataset.pane;
    tabs.querySelectorAll(".admin-tab").forEach((t) => t.classList.toggle("active", t === btn));
    document.querySelectorAll("#adminPanel .admin-pane").forEach((p) => {
      const on = p.dataset.pane === pane;
      p.hidden = !on;
      p.classList.toggle("active", on);
    });
  });
}

// 标签上的红点徽标(待处理反馈 / 待审投稿)
function setAdminTabBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  const n = Number(count) || 0;
  el.textContent = String(n);
  el.hidden = n <= 0;
}

async function renderAdminUpdates() {
  if (!isAdmin || !ui.adminUpdateList) return;
  ui.adminUpdateList.innerHTML = `<p class="admin-update-empty">正在读取更新公告…</p>`;
  try {
    const response = await fetch(ADMIN_UPDATES_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`admin updates failed (${response.status})`);
    const { updates = [] } = await response.json();
    ui.adminUpdateList.innerHTML = updates.length
      ? updates.map(renderAdminUpdateItem).join("")
      : `<p class="admin-update-empty">还没有更新记录。</p>`;
    window.lucide?.createIcons();
  } catch {
    ui.adminUpdateList.innerHTML = `<p class="admin-update-empty">更新公告加载失败，请点刷新重试。</p>`;
  }
}

function renderAdminUpdateItem(item) {
  const type = adminUpdateTypeLabels[item.type] || item.type || "更新";
  const bodyLines = String(item.body || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return `
    <article class="admin-update-item" data-update-id="${escapeHtml(item.id)}">
      <div class="admin-update-meta">
        <span class="upd-type upd-${escapeHtml(item.type || "note")}">${escapeHtml(type)}</span>
        <time>${adminDateTime(item.createdAt)}</time>
        <b>${escapeHtml(item.createdBy || "admin")}</b>
      </div>
      <h4>${escapeHtml(item.title)}</h4>
      <div class="admin-update-body">
        ${bodyLines.length ? bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>暂无内容。</p>"}
      </div>
      <button class="admin-update-delete" type="button" data-update-delete="${escapeHtml(item.id)}" aria-label="删除更新记录" title="删除更新记录">
        <i data-lucide="trash-2"></i>
      </button>
    </article>`;
}

async function createAdminUpdate(event) {
  event.preventDefault();
  if (!isAdmin || !ui.adminUpdateForm) return;
  const form = new FormData(ui.adminUpdateForm);
  const payload = {
    title: String(form.get("title") || "").trim(),
    type: String(form.get("type") || "note").trim(),
    body: String(form.get("body") || "").trim(),
  };
  if (!payload.title || !payload.body) {
    showToast("请填写更新标题和内容");
    return;
  }
  try {
    const response = await fetch(ADMIN_UPDATES_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("save failed");
    ui.adminUpdateForm.reset();
    showToast("更新公告已记录");
    renderAdminUpdates();
  } catch {
    showToast("保存失败，请重试");
  }
}

async function deleteAdminUpdate(id) {
  if (!isAdmin || !id) return;
  const ok = await confirmAction({
    title: "删除更新记录",
    message: "这条更新公告会被永久删除。",
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;
  try {
    const response = await fetch(`${ADMIN_UPDATES_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("delete failed");
    showToast("更新记录已删除");
    renderAdminUpdates();
  } catch {
    showToast("删除失败，请重试");
  }
}

const newsCategoryLabels = {
  new_release: "新品",
  reissue: "再版",
  preorder: "预定",
  payment: "补款",
  shipping: "出货",
  event: "活动",
  social_post: "社交动态",
};

function infoDate(iso) {
  if (!iso) return "时间待确认";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "时间待确认";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 同步「已订阅/全部」切换 + 未订阅提示条的显隐
function syncNewsScope() {
  const scope = document.querySelector("#newsScope");
  const banner = document.querySelector("#newsSubBanner");
  if (scope) {
    scope.hidden = !newsState.hasSubscriptions;
    scope.querySelectorAll("[data-news-scope]").forEach((b) => {
      b.classList.toggle("active", (b.dataset.newsScope === "all") === newsState.discover);
    });
  }
  if (banner) banner.hidden = newsState.hasSubscriptions;
}

// 打开频道订阅弹层：按分组列出所有频道 + 当前订阅状态
async function openNewsSubModal() {
  const modal = document.querySelector("#newsSubModal");
  const list = document.querySelector("#newsSubList");
  if (!modal || !list) return;
  const search = document.querySelector("#newsSubSearch");
  if (search) search.value = "";
  list.innerHTML = `<p class="news-sub-loading">加载频道中…</p>`;
  modal.hidden = false;
  try {
    const res = await fetch(NEWS_CHANNELS_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error("channels failed");
    const { channels = [] } = await res.json();
    const groups = {};
    channels.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });
    list.innerHTML = Object.keys(groups).map((g) => `
      <div class="news-sub-group">
        <p class="news-sub-group-title">${escapeHtml(g)}</p>
        ${groups[g].map((c) => `
          <label class="news-sub-item">
            <input type="checkbox" value="${escapeHtml(c.id)}"${c.subscribed ? " checked" : ""} />
            <span class="news-sub-name">${escapeHtml(c.name)}</span>
            <span class="news-sub-count">${c.count}</span>
          </label>`).join("")}
      </div>`).join("");
  } catch {
    list.innerHTML = `<p class="news-sub-loading">频道加载失败，请重试。</p>`;
  }
}
function closeNewsSubModal() { const m = document.querySelector("#newsSubModal"); if (m) m.hidden = true; }
// 频道搜索：按名字实时过滤，整组无命中则隐藏分组标题
function filterNewsSubList(q) {
  const query = String(q || "").trim().toLowerCase();
  document.querySelectorAll("#newsSubList .news-sub-item").forEach((item) => {
    const name = (item.querySelector(".news-sub-name")?.textContent || "").toLowerCase();
    item.style.display = !query || name.includes(query) ? "" : "none";
  });
  document.querySelectorAll("#newsSubList .news-sub-group").forEach((g) => {
    const anyVisible = Array.from(g.querySelectorAll(".news-sub-item")).some((i) => i.style.display !== "none");
    g.style.display = anyVisible ? "" : "none";
  });
}
async function saveNewsSubs() {
  const list = document.querySelector("#newsSubList");
  if (!list) return;
  const sourceIds = Array.from(list.querySelectorAll("input[type=checkbox]:checked")).map((i) => i.value);
  try {
    const res = await fetch(NEWS_SUBS_ENDPOINT, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceIds }) });
    if (!res.ok) throw new Error("save failed");
    showToast(sourceIds.length ? `已订阅 ${sourceIds.length} 个频道` : "已清空订阅，显示全部资讯");
    closeNewsSubModal();
    newsState.discover = false;
    renderNews();
  } catch {
    showToast("保存失败，请重试");
  }
}

async function renderNews() {
  if (!ui.newsList) return;
  newsState.loading = true;
  ui.newsList.innerHTML = `<p class="news-loading">加载中…</p>`;
  ui.newsEmpty.hidden = true;
  const params = new URLSearchParams();
  params.set("limit", "120");
  if (newsState.search) params.set("q", newsState.search);
  if (newsState.discover) params.set("all", "1");
  try {
    const response = await fetch(`${NEWS_ENDPOINT}?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`news failed ${response.status}`);
    const { items = [], hasSubscriptions = false } = await response.json();
    newsState.items = items;
    newsState.hasSubscriptions = hasSubscriptions;
    syncNewsScope();
    const filtered = newsState.category === "bandai" ? items.filter(isBandaiNews) : items;
    const list = newsState.wishOnly ? filtered.filter((it) => newsWish.has(it.id)) : filtered;
    ui.newsList.innerHTML = list
      .map((item) => {
        const image = normalizeNewsImages(item.imageUrls || [], "thumb")[0] || "";
        const cat = item.category || "new_release";
        const catLabel = newsCategoryLabels[cat] || cat;
        const wished = newsWish.has(item.id);
        const thumb = image
          ? `<div class="news-thumb"><img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" /></div>`
          : `<div class="news-thumb empty"><i data-lucide="newspaper"></i><b>${escapeHtml(catLabel)}</b><span>${escapeHtml(item.sourceName || "")}</span></div>`;
        return `
          <article class="news-card" data-id="${escapeHtml(item.id)}">
            <div class="news-thumb-wrap">
              ${thumb}
              <span class="news-tag tag-${escapeHtml(cat)}">${escapeHtml(catLabel)}</span>
              ${isAdmin ? `<button class="news-admin-delete" type="button" data-info-delete="${escapeHtml(item.id)}" aria-label="删除资讯" title="删除资讯"><i data-lucide="trash-2"></i></button>` : ""}
              <button class="news-wish${wished ? " on" : ""}" type="button" data-wish="${escapeHtml(item.id)}" aria-label="加入想要清单"><i data-lucide="heart"></i></button>
            </div>
            <div class="news-body">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary || item.body || "")}</p>
              <div class="news-foot">
                <span class="news-src">${escapeHtml(item.sourceName)}</span>
                <time>${infoDate(item.publishedAt || item.createdAt)}</time>
              </div>
            </div>
          </article>`;
      })
      .join("");
    ui.newsEmpty.hidden = list.length > 0;
    if (!list.length && newsState.wishOnly) ui.newsEmpty.textContent = "想要清单还是空的，先去资讯里点 ♥ 收藏吧。";
    else if (!list.length && newsState.category === "bandai") ui.newsEmpty.textContent = "暂时还没有万代相关资讯。";
    else ui.newsEmpty.textContent = "暂时还没有发布的资讯。";
    updateWishCount();
  } catch {
    ui.newsList.innerHTML = "";
    ui.newsEmpty.hidden = false;
    ui.newsEmpty.textContent = "资讯加载失败，请稍后重试。";
  } finally {
    newsState.loading = false;
    window.lucide?.createIcons?.();
  }
}

async function renderDashboardNewsRail() {
  if (!ui.dashboardNewsList) return;
  if (activeView !== "dashboard") return;
  ui.dashboardNewsList.innerHTML = `<p class="dashboard-news-loading">正在同步新品资讯...</p>`;
  try {
    const response = await fetch(`${NEWS_ENDPOINT}?limit=8`, { cache: "no-store" });
    if (!response.ok) throw new Error(`dashboard news failed ${response.status}`);
    const { items = [] } = await response.json();
    dashboardNewsItems = items.slice(0, 8);
    if (!dashboardNewsItems.length) {
      ui.dashboardNewsList.innerHTML = `<p class="dashboard-news-empty">暂时还没有新品资讯。</p>`;
      return;
    }
    ui.dashboardNewsList.innerHTML = dashboardNewsItems
      .map((item) => {
        const image = normalizeNewsImages(item.imageUrls || [], "thumb")[0] || "";
        const cat = item.category || "new_release";
        const catLabel = newsCategoryLabels[cat] || cat;
        const thumb = image
          ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.dashboard-news-card').classList.add('no-image'); this.remove()" />`
          : `<i data-lucide="newspaper"></i>`;
        return `
          <article class="dashboard-news-card${image ? "" : " no-image"}" data-dashboard-news="${escapeHtml(item.id)}">
            <div class="dashboard-news-img">
              ${thumb}
              <span class="news-tag tag-${escapeHtml(cat)}">${escapeHtml(catLabel)}</span>
            </div>
            <div class="dashboard-news-copy">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary || item.body || "")}</p>
              <span>${escapeHtml(item.sourceName || "资讯源")} · ${infoDate(item.publishedAt || item.createdAt)}</span>
            </div>
          </article>`;
      })
      .join("");
    window.lucide?.createIcons?.();
  } catch {
    ui.dashboardNewsList.innerHTML = `<p class="dashboard-news-empty">新品资讯暂时加载失败。</p>`;
  }
}

function isBandaiNews(item = {}) {
  const haystack = [
    item.title,
    item.summary,
    item.body,
    item.sourceName,
    item.sourceType,
    item.sourceUrl,
    ...(item.imageUrls || []),
  ].filter(Boolean).join(" ");
  return /万代|萬代|bandai|バンダイ|premium\s*bandai|p[-\s]?bandai|プレミアムバンダイ|tamashii|魂ウェブ|魂web|高达|高達|gundam|ガンダム|ガンプラ|gunpla/i.test(haystack);
}

function renderInfoSources() {
  if (!ui.infoSourceList) return;
  ui.infoSourceList.innerHTML = infoReviewState.sources.length
    ? infoReviewState.sources
        .map((source) => `
          <div class="info-source-item">
            <div>
              <strong>${escapeHtml(source.name)}</strong>
              <span>${escapeHtml(source.sourceType)} · ${escapeHtml(source.adapterKey)} · ${source.enabled ? "启用" : "停用"}</span>
            </div>
            <button type="button" data-source-edit="${escapeHtml(source.id)}">编辑</button>
          </div>`)
        .join("")
    : `<p class="news-empty-inline">还没有资讯源，先添加 RSS 或网页源。</p>`;
}

// 一键发布全部待审：循环复用单条 /action 发布接口（带各卡当前编辑值）
async function publishAllPending() {
  const cards = [...document.querySelectorAll(".info-review-card")];
  if (!cards.length) { showToast("没有待审核的资讯"); return; }
  if (!(await confirmDialog(`一键发布全部 ${cards.length} 条待审核资讯？`, { title: "情报审核", confirmText: "全部发布" }))) return;
  const btn = document.querySelector("#infoPublishAll");
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = "发布中…"; }
  let ok = 0;
  for (const card of cards) {
    try {
      const r = await fetch(`${INFO_ARTICLES_ADMIN_ENDPOINT}/${encodeURIComponent(card.dataset.infoId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...readInfoCardPayload(card), action: "publish" }),
      });
      if (r.ok) ok += 1;
    } catch {}
  }
  if (btn) { btn.disabled = false; if (orig) btn.innerHTML = orig; }
  showToast(`已发布 ${ok}/${cards.length} 条`);
  renderInfoReview();
  renderNews();
}
document.querySelector("#infoPublishAll")?.addEventListener("click", publishAllPending);

async function deleteInfoArticleById(id, { refreshReview = false } = {}) {
  if (!id) return false;
  const response = await fetch(`${INFO_ARTICLES_ADMIN_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`delete info failed ${response.status}`);
  newsWish.delete(id);
  saveWish();
  updateWishCount();
  showToast("资讯已删除");
  renderNews();
  if (refreshReview) renderInfoReview();
  return true;
}

function renderInfoReviewCards() {
  if (!ui.infoReviewList) return;
  const items = infoReviewState.items;
  const pendCount = document.querySelector("#infoPendingCount");
  if (pendCount) pendCount.textContent = String(items.length);
  const pubAll = document.querySelector("#infoPublishAll");
  if (pubAll) pubAll.hidden = items.length === 0;
  ui.infoReviewList.innerHTML = items
    .map((item) => {
      const raw = item.raw || {};
      const image = normalizeNewsImages([...(item.imageUrls || []), ...(raw.imageUrls || [])], "thumb")[0] || "";
      return `
        <article class="info-review-card" data-info-id="${escapeHtml(item.id)}">
          <div class="review-media">
            ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />` : `<i data-lucide="image"></i>`}
          </div>
          <div class="review-main">
            <div class="news-meta">
              <span>${escapeHtml(newsCategoryLabels[item.category] || item.category)}</span>
              <span>${escapeHtml(item.sourceName)}</span>
              <span>可信度 ${Math.round(Number(item.confidence || 0) * 100)}%</span>
              <span>优先级 ${item.priority}</span>
            </div>
            <label>标题<input data-field="title" value="${escapeHtml(item.title)}" /></label>
            <label>AI摘要<textarea data-field="summary" rows="3">${escapeHtml(item.summary)}</textarea></label>
            <div class="review-grid">
              <label>分类
                <select data-field="category">
                  ${Object.entries(newsCategoryLabels).map(([value, label]) => `<option value="${value}" ${item.category === value ? "selected" : ""}>${label}</option>`).join("")}
                </select>
              </label>
              <label>优先级<input data-field="priority" type="number" min="1" max="5" value="${escapeHtml(String(item.priority || 1))}" /></label>
              <label>可信度<input data-field="confidence" type="number" min="0" max="1" step="0.05" value="${escapeHtml(String(item.confidence || 0.6))}" /></label>
            </div>
            <label>风险提示<textarea data-field="riskNotes" rows="2">${escapeHtml(item.riskNotes || "")}</textarea></label>
            <details class="raw-info-box" open>
              <summary>原始内容</summary>
              <p>${escapeHtml(raw.contentText || item.body || "无正文，仅有标题/链接。")}</p>
              <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceUrl)}</a>
            </details>
            <div class="review-actions">
              <button type="button" class="btn-line" data-info-save>保存编辑</button>
              <button type="button" class="settle-btn" data-info-action="publish">发布</button>
              <button type="button" class="btn-line danger" data-info-action="reject">驳回</button>
              <button type="button" class="btn-line" data-info-action="duplicate">标记重复</button>
              <button type="button" class="btn-line danger" data-info-delete="${escapeHtml(item.id)}">删除</button>
            </div>
          </div>
        </article>`;
    })
    .join("");
  ui.infoReviewEmpty.hidden = items.length > 0;
  window.lucide?.createIcons?.();
}

async function renderInfoReview() {
  if (!isAdmin || !ui.infoReviewList) return;
  infoReviewState.loading = true;
  ui.infoReviewList.innerHTML = `<p class="news-loading">加载待审队列…</p>`;
  try {
    const response = await fetch(INFO_REVIEW_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`review failed ${response.status}`);
    const data = await response.json();
    infoReviewState.items = data.items || [];
    infoReviewState.sources = data.sources || [];
    renderInfoSources();
    renderInfoReviewCards();
  } catch {
    ui.infoReviewList.innerHTML = "";
    ui.infoReviewEmpty.hidden = false;
    ui.infoReviewEmpty.textContent = "审核队列加载失败，请稍后重试。";
  } finally {
    infoReviewState.loading = false;
  }
}

function readInfoCardPayload(card) {
  const payload = {};
  card.querySelectorAll("[data-field]").forEach((field) => {
    payload[field.dataset.field] = field.value;
  });
  payload.priority = Number(payload.priority || 1);
  payload.confidence = Number(payload.confidence || 0.6);
  return payload;
}

async function saveInfoArticle(card, extra = {}) {
  const id = card.dataset.infoId;
  const payload = { ...readInfoCardPayload(card), ...extra };
  const response = await fetch(`${INFO_ARTICLES_ADMIN_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("save failed");
  return response.json();
}

function renderAll() {
  renderYearOptions();
  renderMetrics();
  renderChart();
  renderCalendar();
  renderRecords();
  renderPayments();
  renderView();
  renderDashboardNewsRail();
  window.lucide?.createIcons?.();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// crypto.randomUUID() only exists in a secure context (HTTPS or localhost). The cloud is
// served over plain HTTP at an IP, where it throws — so fall back to a good-enough random id.
function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    /* not a secure context — use the fallback below */
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function setDefaultFormDate() {
  ui.recordForm.elements.date.value = localDateText();
}

function showModal(record = null) {
  editingRecordId = record?.id || "";
  ui.recordForm.reset();
  ui.submitRecordButton.disabled = false;
  ui.modalKicker.textContent = record ? "EDIT ARCHIVE ENTRY" : "NEW ARCHIVE ENTRY";
  ui.modalTitle.textContent = record ? "编辑收藏记录" : "记录一笔收藏";
  ui.submitRecordLabel.textContent = record ? "保存修改" : "写入资料库";
  if (record) {
    ensureCategoryOption(ui.recordForm.elements.category, normalizeCategory(record.category, record));
    Object.entries({
      name: record.name,
      category: normalizeCategory(record.category, record),
      series: record.series,
      status: record.status,
      quantity: recordQuantity(record),
      price: record.price,
      paid: record.paid,
      date: record.date,
      dueDate: record.dueDate,
      imageUrl: record.imageUrl || "",
    }).forEach(([name, value]) => {
      // Coerce missing values to "" so the inputs never literally show "undefined".
      ui.recordForm.elements[name].value = value ?? "";
    });
  } else {
    setDefaultFormDate();
    ui.recordForm.elements.quantity.value = "1";
  }
  updateDueField();
  setRecognizeBusy(false);
  setRecognizeHint("");
  clearOptions();
  resetCatalogPick(record);
  refreshImageThumb();
  ui.modalBackdrop.hidden = false;
  ui.recordForm.elements.name.focus();
}

function hideModal() {
  editingRecordId = "";
  ui.modalBackdrop.hidden = true;
  ui.recordForm.reset();
  ui.submitRecordButton.disabled = false;
  ui.modalKicker.textContent = "NEW ARCHIVE ENTRY";
  ui.modalTitle.textContent = "记录一笔收藏";
  ui.submitRecordLabel.textContent = "写入资料库";
  setDefaultFormDate();
  updateDueField();
  setRecognizeBusy(false);
  setRecognizeHint("");
  clearOptions();
  resetCatalogPick(null);
}

function updateDueField() {
  const isPreorder = ui.statusField.value === "预定中";
  const priceInput = ui.recordForm.elements.price;
  const paidInput = ui.recordForm.elements.paid;
  const hasPrice = priceInput.value !== "";
  const needsPayment = isPreorder && (!hasPrice || preorderStageFromAmounts(priceInput.value, paidInput.value) === PREORDER_STAGE_PAYMENT);
  ui.recordForm.elements.dueDate.required = needsPayment;
  document.querySelector(".due-field").style.display = needsPayment ? "" : "none";
  // In-stock = bought outright, so 已支付 always equals 总价 — hide the redundant field
  // (the submit handler already sets paid = price for 已入库).
  const paidField = document.querySelector(".paid-field");
  if (paidField) {
    paidField.style.display = isPreorder ? "" : "none";
    ui.recordForm.elements.paid.required = isPreorder;
  }
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => ui.toast.classList.remove("visible"), 2400);
}

// Themed in-app confirm (replaces the native window.confirm, which clashes with the dark UI).
// Returns a Promise<boolean>.
function confirmDialog(message, { title = "确认操作", confirmText = "确定", cancelText = "取消", danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop confirm-backdrop";
    backdrop.innerHTML = `
      <section class="confirm-modal" role="alertdialog" aria-modal="true">
        <h2 class="confirm-title">${escapeHtml(title)}</h2>
        <p class="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="confirm-ok${danger ? " danger" : ""}">${escapeHtml(confirmText)}</button>
        </div>
      </section>`;
    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
    };
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    backdrop.querySelector(".confirm-cancel").addEventListener("click", () => close(false));
    backdrop.querySelector(".confirm-ok").addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(backdrop);
    backdrop.querySelector(".confirm-ok").focus();
  });
}

async function requestImageMatch(record, { force = false } = {}) {
  const response = await fetch(IMAGE_MATCH_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: record.id,
      name: record.name,
      series: record.series,
      category: normalizeCategory(record.category, record),
      force,
    }),
    // Never let the UI spin forever: give up after 120s (server search is ~15-40s).
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`image match failed (${response.status})`);
  return response.json();
}

function applyImageMatch(recordId, result) {
  if (!result || !result.imageUrl) return false;
  let updatedRecord = null;
  records = records.map((item) =>
    item.id === recordId ? (updatedRecord = { ...item, imageUrl: result.imageUrl, imageMatch: result }) : item,
  );
  saveRecords("自动匹配产品图");
  renderAll();
  if (updatedRecord) syncRecordToCatalog(updatedRecord, { quiet: true, allowLinkedUpdate: true });
  return true;
}

async function syncRecordToCatalog(record, { quiet = false, allowLinkedUpdate = false } = {}) {
  // 图鉴改为管理员手工维护。收藏记录只保留 catalogId 关联，不再由用户录入自动生成/刷新图鉴候选。
  return null;
}

// Auto-match runs in the background only when the record still has no image (used right
// after adding a record). Editing an existing image uses the manual 识图 button instead.
function enqueueImageMatch(record) {
  if (imageForRecord(record)) return false;
  window.setTimeout(async () => {
    try {
      const result = await requestImageMatch(record);
      if (applyImageMatch(record.id, result)) {
        showToast(`已匹配「${record.name}」产品图`);
      } else {
        // Niche brands often have no findable image — tell the user instead of staying silent.
        showToast(`「${record.name}」没自动识别到图，可在编辑里点「识图」或手动填地址`);
      }
    } catch {
      // The dashboard stays usable when the optional local matcher is offline.
    }
  }, 0);
  return true;
}

function setRecognizeBusy(busy) {
  if (!ui.recognizeBtn) return;
  // Keep the button enabled while busy so a second click can cancel.
  ui.recognizeBtn.disabled = false;
  ui.recognizeBtn.classList.toggle("is-loading", busy);
  ui.recognizeLabel.textContent = busy ? "取消" : "识图";
  window.lucide?.createIcons?.();
}

function setRecognizeHint(message, isError = false) {
  if (!ui.recognizeHint) return;
  ui.recognizeHint.textContent = message || "";
  ui.recognizeHint.hidden = !message;
  ui.recognizeHint.classList.toggle("is-error", Boolean(isError));
}

function clearOptions() {
  if (!ui.recognizeOptions) return;
  ui.recognizeOptions.innerHTML = "";
  ui.recognizeOptions.hidden = true;
}

function renderOptions(options) {
  if (!ui.recognizeOptions) return;
  ui.recognizeOptions.hidden = false;
  ui.recognizeOptions.innerHTML = options
    .map(
      (opt, index) =>
        `<button type="button" class="opt" data-index="${index}" title="${escapeHtml(opt.source || opt.title || "")}">
           <img src="${escapeHtml(opt.previewUrl)}" alt="候选 ${index + 1}" loading="lazy" onerror="this.closest('.opt').remove()" />
         </button>`,
    )
    .join("");
}

function displayImageUrl(url, width = 512) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/assets/")) return `.${raw}`;
  if (raw.startsWith("./assets/") || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (/^https?:\/\/wsrv\.nl\//i.test(raw)) return raw;
  if (/^https:\/\/cdn\.rebrickable\.com\//i.test(raw)) return `./api/img-proxy?u=${encodeURIComponent(raw)}`;
  if (/^https?:\/\//i.test(raw)) {
    return `https://wsrv.nl/?url=${encodeURIComponent(raw)}&w=${width}&output=webp&we`;
  }
  return raw;
}

let imageThumbLoadSeq = 0;

function hideImageThumb() {
  const wrap = document.querySelector("#imageCurrent");
  const img = document.querySelector("#imageCurrentImg");
  if (wrap) wrap.hidden = true;
  if (img) img.removeAttribute("src");
}

// 当前产品图缩略图：先确认图片能加载，再显示，避免坏地址露出浏览器裂图。
function refreshImageThumb() {
  const wrap = document.querySelector("#imageCurrent");
  const img = document.querySelector("#imageCurrentImg");
  if (!wrap || !img) return;
  const seq = ++imageThumbLoadSeq;
  const url = (ui.recordForm.elements.imageUrl.value || "").trim();
  hideImageThumb();
  if (!url) return;
  const src = displayImageUrl(url, 256);
  if (!src) return;
  const probe = new Image();
  probe.onload = () => {
    if (seq !== imageThumbLoadSeq || (ui.recordForm.elements.imageUrl.value || "").trim() !== url) return;
    img.src = src;
    wrap.hidden = false;
  };
  probe.onerror = () => {
    if (seq === imageThumbLoadSeq) hideImageThumb();
  };
  probe.src = src;
}

const imagePreviewState = { items: [], index: 0, direct: false, hint: "" };

function normalizePreviewItems(url, options = {}) {
  const rawItems = Array.isArray(options.items) ? options.items : [url];
  const items = [...new Set(rawItems.map((item) => String(item || "").trim()).filter(Boolean))];
  if (!items.length && url) items.push(url);
  const directIndex = items.indexOf(String(url || "").trim());
  const fallbackIndex = Number.isFinite(Number(options.index)) ? Number(options.index) : 0;
  const index = directIndex >= 0 ? directIndex : Math.min(Math.max(0, fallbackIndex), Math.max(0, items.length - 1));
  return { items, index };
}

function previewImageSrc(url, direct) {
  if (!url) return "";
  const sameOrigin = url.startsWith(location.origin) || url.startsWith("./") || url.startsWith("/");
  return direct || sameOrigin ? url : displayImageUrl(url, 1200);
}

function renderImagePreview() {
  const img = document.querySelector("#imgPreviewImg");
  const hintEl = document.querySelector("#imgPreviewHint");
  const countEl = document.querySelector("#imgPreviewCount");
  const prev = document.querySelector("#imgPreviewPrev");
  const next = document.querySelector("#imgPreviewNext");
  const total = imagePreviewState.items.length;
  const currentUrl = imagePreviewState.items[imagePreviewState.index] || "";
  if (img) img.src = previewImageSrc(currentUrl, imagePreviewState.direct);
  if (hintEl) hintEl.textContent = imagePreviewState.hint;
  if (countEl) countEl.textContent = total > 1 ? `${imagePreviewState.index + 1} / ${total}` : "";
  const hasMultiple = total > 1;
  if (prev) prev.hidden = !hasMultiple;
  if (next) next.hidden = !hasMultiple;
  window.lucide?.createIcons?.();
}

function moveImagePreview(delta) {
  const total = imagePreviewState.items.length;
  if (total <= 1) return;
  imagePreviewState.index = (imagePreviewState.index + delta + total) % total;
  renderImagePreview();
}

// 大图预览浮层：单击候选看大图，资讯图可左右切换。
function openImagePreview(url, hint = "双击候选图即可选用 · 点空白处关闭", options = {}) {
  if (!url) return;
  const overlay = document.querySelector("#imgPreview");
  if (!overlay) return;
  const { items, index } = normalizePreviewItems(url, options);
  imagePreviewState.items = items;
  imagePreviewState.index = index;
  imagePreviewState.direct = Boolean(options.direct);
  imagePreviewState.hint = hint;
  overlay.hidden = false;
  renderImagePreview();
}
function closeImagePreview() {
  const overlay = document.querySelector("#imgPreview");
  if (overlay) overlay.hidden = true;
}

// 上传前在浏览器里缩放，避免大图超过后端 512KB 限制。
function resizeImageToDataUrl(file, maxSide = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("不是有效图片"));
      image.onload = () => {
        let { width, height } = image;
        if (width > maxSide || height > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        // PNG 透明图保留 png，其余转 jpeg 压缩。
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("请选择图片文件"); return; }
  setRecognizeHint("正在上传图片…");
  try {
    let dataUrl = await resizeImageToDataUrl(file);
    // 万一压缩后仍偏大，再降一档质量。
    if (dataUrl.length > 480 * 1024) dataUrl = await resizeImageToDataUrl(file, 900, 0.72);
    const res = await fetch(UPLOAD_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) throw new Error("upload failed");
    const { imageUrl } = await res.json();
    ui.recordForm.elements.imageUrl.value = imageUrl;
    refreshImageThumb();
    const saveLabel = ui.submitRecordLabel?.textContent || "保存";
    setRecognizeHint(`图片已上传，点「${saveLabel}」写入资料库`);
  } catch {
    setRecognizeHint("上传失败，请换一张或稍后再试", true);
  }
}

let recognizeOptionsData = [];
async function selectOption(index, button) {
  const opt = recognizeOptionsData[index];
  if (!opt) return;
  ui.recognizeOptions.querySelectorAll(".opt").forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");
  const saveLabel = ui.submitRecordLabel?.textContent || "保存";
  if (opt.local) {
    ui.recordForm.elements.imageUrl.value = opt.imageUrl;
    refreshImageThumb();
    closeImagePreview();
    setRecognizeHint(`已选用已验证的缓存图。请点击「${saveLabel}」写入资料库`);
    return;
  }
  setRecognizeHint("正在保存所选图片…");
  try {
    const response = await fetch(IMAGE_MATCH_SELECT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: opt.imageUrl, sourceUrl: opt.sourceUrl }),
      signal: AbortSignal.timeout(60000),
    });
    const result = response.ok ? await response.json() : {};
    // Prefer the locally-saved copy; fall back to the proxied URL if the download failed.
    const finalUrl = result.imageUrl || opt.previewUrl;
    ui.recordForm.elements.imageUrl.value = finalUrl;
    refreshImageThumb();
    closeImagePreview();
    setRecognizeHint(`已选用这张图。请点击「${saveLabel}」写入资料库`);
  } catch {
    setRecognizeHint("保存失败，请重试或换一张", true);
  }
}

let recognizing = false;
let recognizeTimer = 0;
let recognizeController = null;
// Manual recognition triggered by the 识图 button. Uses the current (possibly unsaved)
// form values and shows a gallery of candidate images for the user to choose from, so a
// wrong auto-pick (e.g. a brand logo) can be replaced by the right product photo.
// Clicking the button again while it's running cancels the in-flight search.
async function recognizeFromForm() {
  if (recognizing) {
    recognizeController?.abort();
    return;
  }
  const form = new FormData(ui.recordForm);
  const name = (form.get("name") || "").trim();
  const series = (form.get("series") || "").trim();
  const category = form.get("category");
  const imageUrl = (form.get("imageUrl") || "").trim();
  if (!name) {
    setRecognizeHint("请先填写藏品名称，再点识图", true);
    return;
  }
  recognizing = true;
  setRecognizeBusy(true);
  clearOptions();
  recognizeController = new AbortController();
  const timeout = window.setTimeout(() => recognizeController?.abort(), 120000);
  const startedAt = Date.now();
  const tick = () =>
    setRecognizeHint(`识别中…已等待 ${Math.round((Date.now() - startedAt) / 1000)}s（联网找图通常 20-60 秒，可点「取消」停止）`);
  tick();
  recognizeTimer = window.setInterval(tick, 1000);
  try {
    const response = await fetch(IMAGE_MATCH_OPTIONS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, series, category, imageUrl }),
      signal: recognizeController.signal,
    });
    if (!response.ok) throw new Error(`options failed (${response.status})`);
    const payload = await response.json();
    const options = Array.isArray(payload.options) ? payload.options : payload.candidates;
    recognizeOptionsData = Array.isArray(options) ? options : [];
    if (recognizeOptionsData.length) {
      setRecognizeHint(`找到 ${recognizeOptionsData.length} 张候选：单击看大图，双击选用`);
      renderOptions(recognizeOptionsData);
    } else {
      setRecognizeHint("没有足够相关的候选图。这条比较小众，可直接粘贴图片地址。", true);
    }
  } catch (error) {
    const aborted = error?.name === "AbortError" || error?.name === "TimeoutError";
    setRecognizeHint(
      aborted
        ? "已取消识图。可重新点「识图」，或手动粘贴图片地址。"
        : "识图失败：请确认本机识图服务已启动，或稍后重试。",
      true,
    );
  } finally {
    window.clearTimeout(timeout);
    window.clearInterval(recognizeTimer);
    recognizing = false;
    recognizeController = null;
    setRecognizeBusy(false);
  }
}

function exportData() {
  backupSnapshot(records, "手动导出");
  const blob = new Blob([JSON.stringify(buildArchive(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `hangar07-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast(`已导出 ${records.length} 条收藏记录`);
}

function buildArchive() {
  return {
    exportedAt: new Date().toISOString(),
    app: "玩物不丧志",
    version: 1,
    records,
    backups: getBackups(),
  };
}

async function copyData() {
  backupSnapshot(records, "手动复制");
  const content = JSON.stringify(buildArchive(), null, 2);
  ui.backupPayload.value = content;
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast(`已复制 ${records.length} 条收藏记录`);
}

function isValidRecord(record) {
  return record && record.id && record.name && record.category && record.status && record.date;
}

function importRecords(file) {
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const archive = JSON.parse(reader.result);
      const imported = Array.isArray(archive) ? archive : archive.records;
      if (!Array.isArray(imported) || !imported.every(isValidRecord)) throw new Error("invalid archive");
      if (!(await confirmDialog(`导入 ${imported.length} 条记录？当前资料会先自动备份。`, { title: "导入恢复", confirmText: "导入" }))) return;
      backupSnapshot(records, "导入前自动备份");
      records = normalizeRecords(structuredClone(imported));
      selectedYear = getDefaultYear();
      saveRecords("导入恢复");
      renderAll();
      showToast(`已恢复 ${records.length} 条收藏记录`);
    } catch {
      showToast("导入失败：请选择「玩物不丧志」导出的 JSON 文件");
    } finally {
      ui.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

async function restorePreviousBackup() {
  const currentPayload = JSON.stringify(records);
  const previous = getBackups().find((backup) => backup.payload !== currentPayload);
  if (!previous) {
    showToast("暂时没有可恢复的历史版本");
    return;
  }
  const restored = JSON.parse(previous.payload);
  if (!(await confirmDialog(`恢复到 ${restored.length} 条记录的历史版本？当前资料会继续保留。`, { title: "恢复上版", confirmText: "恢复" }))) return;
  backupSnapshot(records, "恢复前自动备份");
  records = normalizeRecords(structuredClone(restored));
  selectedYear = getDefaultYear();
  saveRecords("恢复历史版本");
  renderAll();
  showToast(`已恢复历史版本，共 ${records.length} 条`);
}

function selectNav(view) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  [
    ["admin", "#adminPanel"],
    ["contributions", "#contributionPanel"],
    ["catalog", "#catalogPanel"],
    ["pickup", "#pickupPanel"],
    ["news", "#newsPanel"],
    ["infoReview", "#infoReviewPanel"],
  ].forEach(([panelView, selector]) => {
    const panel = document.querySelector(selector);
    if (panel) panel.hidden = view !== panelView;
  });
  const selected = document.querySelector(`.nav-item[data-view="${view}"]`);
  activeView = view;
  ui.viewLabel.textContent = selected.querySelector("span").textContent;
}

function selectRecordTab(status) {
  document.querySelectorAll(".record-tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.status === status);
  });
  activeStatus = status;
}

document.querySelector("#openAddModal").addEventListener("click", () => showModal());
document.querySelector("#closeModal").addEventListener("click", hideModal);
ui.openAccountSecurity?.addEventListener("click", showAccountSecurityModal);
ui.accountSecurityClose?.addEventListener("click", hideAccountSecurityModal);
ui.accountSecurityModal?.addEventListener("click", (event) => {
  if (event.target === ui.accountSecurityModal) hideAccountSecurityModal();
});
ui.sendBindEmailCode?.addEventListener("click", sendBindEmailCode);
ui.bindEmailForm?.addEventListener("submit", bindEmail);
ui.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === ui.modalBackdrop) hideModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.modalBackdrop.hidden) hideModal();
  if (event.key === "Escape" && ui.accountSecurityModal && !ui.accountSecurityModal.hidden) hideAccountSecurityModal();
});

ui.statusField.addEventListener("change", updateDueField);
ui.recordForm.elements.price.addEventListener("input", updateDueField);
ui.recordForm.elements.paid.addEventListener("input", updateDueField);

ui.recordForm.addEventListener(
  "invalid",
  (event) => {
    const label = event.target.closest("label")?.querySelector("span")?.textContent.trim() || "必填项";
    showToast(`请填写「${label}」`);
  },
  true,
);

ui.recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (ui.submitRecordButton.disabled) return;
  const form = new FormData(ui.recordForm);
  const status = form.get("status");
  const price = Number(form.get("price"));
  const quantity = Math.max(1, Math.floor(Number(form.get("quantity")) || 1));
  // In-stock items are paid in full; only preorders track a separate paid amount.
  const paid = status === "已入库" ? price : Number(form.get("paid"));
  const nextPreorderStage = status === "预定中" ? preorderStageFromAmounts(price, paid) : "";

  if (paid > price) {
    showToast("已支付金额不能高于总价");
    return;
  }
  if (nextPreorderStage === PREORDER_STAGE_PAYMENT && !form.get("dueDate")) {
    showToast("请填写「预计补款日期」");
    return;
  }

  const wasEditing = Boolean(editingRecordId);
  const recordsBeforeSubmit = structuredClone(records);
  const existingRecord = wasEditing
    ? records.find((record) => record.id === editingRecordId) || null
    : null;
  let nextRecord = {
    id: editingRecordId || generateId(),
    name: form.get("name").trim(),
    category: normalizeCategory(form.get("category"), { name: form.get("name"), series: form.get("series") }),
    series: form.get("series").trim(),
    status,
    preorderStage: nextPreorderStage,
    quantity,
    price,
    paid,
    date: form.get("date"),
    dueDate: status === "预定中" ? form.get("dueDate") : "",
    imageUrl: form.get("imageUrl").trim(),
    catalogId: selectedCatalogId || "",
  };
  const catalogSync = selectedCatalogSyncFromRecordForm(form);
  if (catalogSync) nextRecord.catalogSync = catalogSync;
  nextRecord = applyPreorderLifecycleTimestamps(nextRecord, existingRecord);
  if (wasEditing) {
    records = records.map((record) => {
      if (record.id !== editingRecordId) return record;
      const existingSync = record.catalogSync && typeof record.catalogSync === "object" ? record.catalogSync : undefined;
      return { ...record, ...nextRecord, ...(catalogSync ? { catalogSync } : existingSync ? { catalogSync: existingSync } : {}) };
    });
  } else {
    records.push(nextRecord);
  }
  // 若当前是「全部年份」视图，保存后保持全部；否则跳到该记录所在年份。
  if (!isAllYears()) selectedYear = Number(form.get("date").slice(0, 4));
  const submitLabel = ui.submitRecordLabel.textContent;
  ui.submitRecordButton.disabled = true;
  ui.submitRecordLabel.textContent = wasEditing ? "保存中" : "写入中";
  renderAll();
  let synced;
  try {
    synced = await saveRecords(wasEditing ? "编辑收藏" : "新增收藏");
  } catch {
    records = recordsBeforeSubmit;
    ui.submitRecordButton.disabled = false;
    ui.submitRecordLabel.textContent = submitLabel;
    renderAll();
    showToast("保存失败，表单内容已保留，请重试");
    return;
  }
  if (synced === null) {
    ui.submitRecordButton.disabled = false;
    ui.submitRecordLabel.textContent = submitLabel;
    showToast("检测到其他设备的修改，表单内容已保留，请确认后重试");
    return;
  }
  ui.submitRecordButton.disabled = false;
  hideModal();
  renderAll();
  const queued = synced === true ? enqueueImageMatch(nextRecord) : false;
  showToast(
    synced === false
      ? "已保存在本机，云端同步失败，请检查网络后重试"
      : wasEditing
        ? queued ? "收藏记录已保存，正在后台识图" : "收藏记录已保存并同步"
        : queued ? "收藏记录已写入，正在后台识图" : "收藏记录已写入并同步",
  );
});

ui.recognizeBtn?.addEventListener("click", recognizeFromForm);
// 单击候选 = 看大图；双击候选 = 选用这张。用一个短延时区分单/双击。
let optClickTimer = 0;
ui.recognizeOptions?.addEventListener("click", (event) => {
  const button = event.target.closest(".opt");
  if (!button) return;
  window.clearTimeout(optClickTimer);
  optClickTimer = window.setTimeout(() => {
    const opt = recognizeOptionsData[Number(button.dataset.index)];
    if (opt) openImagePreview(opt.previewUrl || opt.imageUrl);
  }, 230);
});
ui.recognizeOptions?.addEventListener("dblclick", (event) => {
  const button = event.target.closest(".opt");
  if (!button) return;
  window.clearTimeout(optClickTimer);
  selectOption(Number(button.dataset.index), button);
});
// 图片上传
document.querySelector("#uploadImageBtn")?.addEventListener("click", () => document.querySelector("#imageFileInput")?.click());
document.querySelector("#imageFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  uploadImageFile(file);
  e.target.value = ""; // 允许重复选同一文件
});
document.querySelector("#imageClearBtn")?.addEventListener("click", () => {
  ui.recordForm.elements.imageUrl.value = "";
  refreshImageThumb();
});
ui.recordForm.elements.imageUrl?.addEventListener("input", refreshImageThumb);
ui.recordForm.elements.imageUrl?.addEventListener("change", refreshImageThumb);
// 当前图缩略图：点一下也能看大图
document.querySelector("#imageCurrentImg")?.addEventListener("click", () => {
  openImagePreview((ui.recordForm.elements.imageUrl.value || "").trim());
});
// 大图预览浮层：点空白关闭
document.querySelector("#imgPreview")?.addEventListener("click", (e) => {
  if (e.target.id === "imgPreview") closeImagePreview();
});
document.querySelector("#imgPreviewPrev")?.addEventListener("click", (e) => {
  e.stopPropagation();
  moveImagePreview(-1);
});
document.querySelector("#imgPreviewNext")?.addEventListener("click", (e) => {
  e.stopPropagation();
  moveImagePreview(1);
});
let imagePreviewTouchX = 0;
document.querySelector("#imgPreview")?.addEventListener("touchstart", (e) => {
  imagePreviewTouchX = e.changedTouches?.[0]?.clientX || 0;
}, { passive: true });
document.querySelector("#imgPreview")?.addEventListener("touchend", (e) => {
  const endX = e.changedTouches?.[0]?.clientX || imagePreviewTouchX;
  const diff = endX - imagePreviewTouchX;
  if (Math.abs(diff) > 42) moveImagePreview(diff < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener("keydown", (e) => {
  if (document.querySelector("#imgPreview")?.hidden) return;
  if (e.key === "Escape") closeImagePreview();
  if (e.key === "ArrowLeft") moveImagePreview(-1);
  if (e.key === "ArrowRight") moveImagePreview(1);
});

ui.yearSelect.addEventListener("change", () => {
  const v = ui.yearSelect.value;
  selectedYear = v === "all" ? "all" : Number(v);
  renderAll();
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  // The record list sits at the bottom of 总览 (below hero/chart), so searching there felt
  // like nothing happened. Jump to 收藏库 (hero hidden, list at the top) so results show up.
  if (searchTerm && activeView !== "collection") {
    selectNav("collection");
    selectRecordTab("全部");
    renderAll();
  } else {
    renderRecords();
    renderView();
  }
  window.lucide?.createIcons?.();
});

document.querySelectorAll(".record-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectRecordTab(tab.dataset.status);
    renderRecords();
    window.lucide?.createIcons?.();
  });
});

document.querySelectorAll(".category-filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category-filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeCategory = button.dataset.category;
    selectNav("collection");
    selectRecordTab("全部");
    renderAll();
  });
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    if ((button.dataset.view === "admin" || button.dataset.view === "infoReview") && !isAdmin) return;
    selectNav(button.dataset.view);
    if (activeView === "collection") selectRecordTab("全部");
    renderAll();
    if (activeView === "admin") renderAdmin();
    if (activeView === "catalog") renderCatalog();
    if (activeView === "pickup") renderPickup();
    if (activeView === "news") renderNews();
    if (activeView === "infoReview") renderInfoReview();
    if (activeView === "contributions") renderContributions();
    setSidebarOpen(false);
  });
});

ui.adminRefresh?.addEventListener("click", renderAdmin);
ui.contributionRefresh?.addEventListener("click", renderContributions);
ui.contributionRecordList?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-contribution-target]");
  const id = card?.dataset.contributionTarget;
  if (id) openCatalogDetail(id);
});
ui.contributionBadgeCard?.addEventListener("mouseover", (event) => {
  if (event.target.closest("[data-badge-id]")) showContributionBadgeTooltip(event);
});
ui.contributionBadgeCard?.addEventListener("mousemove", moveContributionBadgeTooltip);
ui.contributionBadgeCard?.addEventListener("mouseleave", hideContributionBadgeTooltip);
ui.adminUpdateForm?.addEventListener("submit", createAdminUpdate);
ui.adminAccountPager?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-show-more]");
  if (!button) return;
  adminAccountVisible += ADMIN_ACCOUNT_PAGE_SIZE;
  renderAdminAccountTable();
});
ui.adminNewsOps?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-weibo-login]");
  if (!button) return;
  startAdminWeiboLogin();
});
ui.adminFeedbackOps?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feedback-status]");
  if (!button) return;
  const card = button.closest("[data-feedback-id]");
  updateFeedbackStatus(card?.dataset.feedbackKind || "pickup", card?.dataset.feedbackId, button.dataset.feedbackStatus);
});
ui.adminContributionOps?.addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-contribution-status]");
  const actionButton = event.target.closest("[data-contribution-action]");
  if (!statusButton && !actionButton) return;
  if (actionButton?.dataset.contributionAction === "ai-review-batch") {
    aiReviewContributionBatch(actionButton);
    return;
  }
  const card = event.target.closest("[data-contribution-id]");
  const id = card?.dataset.contributionId;
  if (statusButton) updateContributionStatus(id, statusButton.dataset.contributionStatus);
  else if (actionButton?.dataset.contributionAction === "apply") applyContribution(id);
  else if (actionButton?.dataset.contributionAction === "ai-review") aiReviewContribution(id);
});
ui.adminCatalogSubmissionOps?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-catalog-submission-action]");
  if (!button) return;
  const card = button.closest("[data-catalog-submission-id]");
  if (!card) return;
  const action = button.dataset.catalogSubmissionAction;
  if (action === "rerun") {
    rerunCatalogSubmissionAiReview(card);
    return;
  }
  if (action === "publish") {
    const name = String(card.querySelector('[data-catalog-submission-field="name"]')?.value || "这条图鉴草稿").trim();
    if (!(await confirmDialog(`将「${name || "这条图鉴草稿"}」按当前管理员收录稿发布到公开图鉴？`, { title: "确认收录新图鉴", confirmText: "确认收录" }))) return;
    updateCatalogSubmissionReview(card, "publish", { adminNote: "网页端管理员最终确认后收录" });
    return;
  }
  if (action === "needs_more" || action === "reject") {
    const promptText = action === "needs_more" ? "请写明需要投稿人补充的内容：" : "请写明不采纳的原因：";
    const note = window.prompt(promptText);
    if (!note?.trim()) return;
    updateCatalogSubmissionReview(card, action, { adminNote: note.trim() });
    return;
  }
  if (action === "merge") {
    const targetCatalogId = String(button.dataset.catalogSubmissionTarget || "").trim();
    if (!targetCatalogId) return;
    const note = window.prompt("合并说明（可留空）：");
    if (note === null) return;
    updateCatalogSubmissionReview(card, "merge", { targetCatalogId, adminNote: note.trim() });
  }
});
ui.adminPickupSubmissions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sub-action]");
  if (!button) return;
  const card = button.closest("[data-sub-id]");
  reviewPickupSubmission(card?.dataset.subId, button.dataset.subAction);
});
ui.adminUpdateList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-update-delete]");
  if (!button) return;
  deleteAdminUpdate(button.dataset.updateDelete);
});
ui.infoReviewRefresh?.addEventListener("click", renderInfoReview);
let newsSearchTimer = 0;
ui.newsSearch?.addEventListener("input", (event) => {
  newsState.search = event.target.value.trim();
  window.clearTimeout(newsSearchTimer);
  newsSearchTimer = window.setTimeout(renderNews, 220);
});
ui.newsCats?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-news-cat]");
  if (!button) return;
  newsState.category = button.dataset.newsCat;
  ui.newsCats.querySelectorAll("[data-news-cat]").forEach((item) => item.classList.toggle("active", item === button));
  renderNews();
});
ui.infoReviewList?.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-info-id]");
  if (!card) return;
  try {
    const deleteButton = event.target.closest("[data-info-delete]");
    if (deleteButton) {
      const title = card.querySelector('[data-field="title"]')?.value || "这条资讯";
      if (!(await confirmDialog(`删除「${title}」？删除后不会出现在前台资讯页。`, { title: "删除资讯", confirmText: "删除" }))) return;
      await deleteInfoArticleById(deleteButton.dataset.infoDelete || card.dataset.infoId, { refreshReview: true });
      return;
    }
    if (event.target.closest("[data-info-save]")) {
      await saveInfoArticle(card);
      showToast("资讯草稿已保存");
      return;
    }
    const actionButton = event.target.closest("[data-info-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.infoAction;
    const actionText = { publish: "发布", reject: "驳回", duplicate: "标记重复" }[action] || "处理";
    if (!(await confirmDialog(`${actionText}这条资讯？`, { title: "情报审核", confirmText: actionText }))) return;
    await fetch(`${INFO_ARTICLES_ADMIN_ENDPOINT}/${encodeURIComponent(card.dataset.infoId)}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...readInfoCardPayload(card), action }),
    }).then((r) => (r.ok ? r.json() : Promise.reject()));
    showToast(`已${actionText}`);
    renderInfoReview();
    if (action === "publish") renderNews();
  } catch {
    showToast("操作失败，请重试");
  }
});
ui.infoSourceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  data.enabled = data.enabled === "1";
  try {
    const response = await fetch(data.id ? `${INFO_SOURCES_ENDPOINT}/${encodeURIComponent(data.id)}` : INFO_SOURCES_ENDPOINT, {
      method: data.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("source save failed");
    form.reset();
    showToast("资讯源已保存");
    renderInfoReview();
  } catch {
    showToast("资讯源保存失败");
  }
});
ui.infoSourceList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source-edit]");
  if (!button || !ui.infoSourceForm) return;
  const source = infoReviewState.sources.find((item) => item.id === button.dataset.sourceEdit);
  if (!source) return;
  ui.infoSourceForm.elements.id.value = source.id;
  ui.infoSourceForm.elements.name.value = source.name;
  ui.infoSourceForm.elements.sourceType.value = source.sourceType;
  ui.infoSourceForm.elements.adapterKey.value = source.adapterKey;
  ui.infoSourceForm.elements.feedUrl.value = source.feedUrl || "";
  ui.infoSourceForm.elements.homepageUrl.value = source.homepageUrl || "";
  ui.infoSourceForm.elements.enabled.value = source.enabled ? "1" : "0";
});

ui.recordList.addEventListener("click", async (event) => {
  // In-list 识图: open the record's editor and start the picker straight away.
  const recognizeButton = event.target.closest("[data-recognize]");
  if (recognizeButton) {
    const record = records.find((item) => item.id === recognizeButton.dataset.recognize);
    if (record) {
      showModal(record);
      recognizeFromForm();
    }
    return;
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const record = records.find((item) => item.id === editButton.dataset.edit);
    if (record) showModal(record);
    return;
  }
  const button = event.target.closest("[data-delete]");
  if (button) {
    const record = records.find((item) => item.id === button.dataset.delete);
    if (!record) return;
    const ok = await confirmDialog("删除后无法撤销。", {
      title: `删除「${recordDisplayName(record)}」？`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    records = records.filter((item) => item.id !== record.id);
    saveRecords("删除收藏");
    renderAll();
    showToast("收藏记录已删除");
    return;
  }
  const card = event.target.closest("[data-record]");
  if (!card) return;
  const record = records.find((item) => item.id === card.dataset.record);
  if (!record) return;
  if (!record.catalogId) {
    showToast("这条藏品还没有关联图鉴，编辑后可从图鉴选择。");
    return;
  }
  selectNav("catalog");
  renderAll();
  renderCatalog();
  openCatalogDetail(record.catalogId);
});

ui.paymentList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-preorder-action]");
  if (!button || preorderTaskSaving) return;
  const recordId = button.dataset.preorderAction;
  const stage = button.dataset.stage;
  const record = records.find((item) => item.id === recordId);
  if (!record || preorderStage(record) !== stage) {
    showToast("预定状态已更新，请刷新后重试");
    return;
  }

  const previousRecord = structuredClone(record);
  const reason = stage === PREORDER_STAGE_PAYMENT ? "完成预定补款" : "确认预定到货";
  const successMessage = stage === PREORDER_STAGE_PAYMENT
    ? "补款已完成，接下来等待到货"
    : "已确认到货，藏品正式入库";

  preorderTaskSaving = { id: recordId, stage };
  records = records.map((item) => item.id === recordId ? completePreorderTask(item, stage) : item);
  renderAll();

  try {
    await completePreorderTaskOnServer(recordId, stage, localDateText(), reason);
  } catch (error) {
    if (error?.code === "record_sync_superseded") {
      preorderTaskSaving = null;
      renderAll();
      showToast("云端资料已更新，本次预定操作未继续提交");
      return;
    }
    if (error?.statusCode === 409 && error.taskReconciled) {
      preorderTaskSaving = null;
      setSyncState("synced", "已同步云端最新预定状态");
      renderAll();
      resumePendingRecordSync("恢复预定状态后的待同步修改");
      showToast("预定状态已在其他设备更新，其他本机修改不受影响");
      return;
    }
    rollbackPreorderTaskRecord(recordId, previousRecord);
    preorderTaskSaving = null;
    updateDatabaseState(false, "预定状态未同步，请重试");
    renderAll();
    showToast("云端保存失败，预定状态已恢复");
    return;
  }

  preorderTaskSaving = null;
  renderAll();
  resumePendingRecordSync("完成预定任务后的待同步修改");
  showToast(successMessage);
});

document.querySelector("#resetData").addEventListener("click", async () => {
  if (!(await confirmDialog("当前云端资料会先保留历史版本，然后被示例资料覆盖。", { title: "恢复示例数据？", confirmText: "恢复示例", danger: true }))) return;
  backupSnapshot(records, "重置前自动备份");
  records = normalizeRecords(structuredClone(sampleRecords));
  selectedYear = 2026;
  saveRecords("恢复示例资料");
  renderAll();
  showToast("已恢复示例资料库");
});

// 移动端侧边栏开关：同步 .open 状态与遮罩显隐
function setSidebarOpen(open) {
  document.querySelector("#sidebar").classList.toggle("open", open);
  const scrim = document.querySelector("#sidebarScrim");
  if (scrim) scrim.hidden = !open;
}
document.querySelector("#menuToggle").addEventListener("click", () => {
  setSidebarOpen(!document.querySelector("#sidebar").classList.contains("open"));
});
// 点击遮罩（侧边栏右侧空白）即关闭
document.querySelector("#sidebarScrim")?.addEventListener("click", () => setSidebarOpen(false));

ui.themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "night" ? "day" : "night";
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {}
  applyTheme(nextTheme, { animate: true });
});

document.querySelector("#exportData").addEventListener("click", exportData);
document.querySelector("#copyData").addEventListener("click", copyData);
document.querySelector("#importData").addEventListener("click", () => ui.importFile.click());
document.querySelector("#restorePrevious").addEventListener("click", restorePreviousBackup);
ui.importFile.addEventListener("change", () => {
  if (ui.importFile.files[0]) importRecords(ui.importFile.files[0]);
});
document.querySelector("#logoutButton")?.addEventListener("click", async () => {
  navigator.sendBeacon?.(LOGOUT_ENDPOINT);
});

applyTheme(getStoredTheme());
if (window.location.pathname === "/news") selectNav("news");
if (window.location.pathname === "/admin/info-review") selectNav("infoReview");
if (window.location.pathname === "/contributions" || new URLSearchParams(window.location.search).has("contributions")) selectNav("contributions");
setDefaultFormDate();
updateDueField();
renderAll();
if (activeView === "news") renderNews();
if (activeView === "contributions") renderContributions();
hydrateRecordsFromServer();

/* ===================== 模型图鉴（catalog） ===================== */
const catalogCategories = [
  { value: "全部", label: "全部", hint: "" },
  { value: "拼装模型", label: "拼装模型", hint: "HG / RG / MG / 30MM / 角色拼装" },
  { value: "可动成品", label: "成品玩具", hint: "METAL BUILD / ROBOT魂 / SHF / 戴亚克隆" },
  { value: "兵人", label: "兵人 / 人偶", hint: "Hot Toys / INART / 1:6 / 1:12" },
  { value: "雕像", label: "雕像", hint: "Queen Studios / Statue / Bust / 1:1 / 1:3 / 1:4" },
  { value: "变形金刚", label: "变形金刚", hint: "Hasbro / SS / Legacy / WFC / G1" },
  { value: "乐高", label: "乐高", hint: "LEGO / Technic / Star Wars / City / Ideas" },
];
const catalogCategoryLabels = {
  ...Object.fromEntries(catalogCategories.map((item) => [item.value, item.label])),
  万代拼装: "拼装模型",
  万代成品: "成品玩具",
  成品玩具: "成品玩具",
  成品模型: "成品玩具",
  手办雕像: "雕像",
  "手办/雕像": "雕像",
  Transformers: "变形金刚",
  "LEGO / 乐高": "乐高",
  "配件 / 周边": "配件 / 周边",
};
let catalogState = { items: [], total: 0, pageSize: 36, offset: 0, category: "全部", brand: "全部", ip: "全部", grade: "全部", mine: "", search: "", sort: "newest", status: "published", current: null, editing: false, loading: false, searchHint: "", facets: { brands: [], ips: [], grades: [] }, facetsLoading: false, brandsExpanded: false, ipsExpanded: false, gradesExpanded: false, mineStats: { owned: 0, rated: 0, linked: 0 }, officialGallery: { images: [], index: 0, animating: false, timer: 0, requestId: 0 } };
const catalogOfficialImagePreloadCache = new Map();
let catalogOptionsData = [];

function displayCatalogCategory(category) {
  return catalogCategoryLabels[category] || category || "其他";
}

function compactCatalogAlias(value) {
  return String(value || "").replace(/^https?:\/\/\S+$/i, "").replace(/\s+/g, " ").trim();
}

function hasJapaneseKana(value) {
  return /[ぁ-んァ-ン]/.test(String(value || ""));
}

function catalogAliasPreview(item, max = 10) {
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  const base = new Set([item.name, item.modelNumber, item.brand, item.series, item.category].filter(Boolean).map((v) => String(v).trim()));
  const seen = new Set();
  const out = [];
  for (const raw of aliases) {
    const alias = compactCatalogAlias(raw);
    if (!alias || alias.length > 36 || hasJapaneseKana(alias) || base.has(alias) || seen.has(alias)) continue;
    seen.add(alias);
    out.push(alias);
    if (out.length >= max) break;
  }
  return out;
}

function ensureSelectValue(select, value, label = value) {
  if (!select || !value) return;
  const exists = [...select.options].some((option) => option.value === value);
  if (!exists) select.add(new Option(label || value, value));
}

function catStarHtml(value, mode) {
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= value ? "on" : ""}" data-star="${i}">★</span>`;
  return s;
}

function renderCatalog() {
  const newBtn = document.querySelector("#catalogNewBtn");
  if (newBtn) {
    newBtn.hidden = !isAdmin;
    newBtn.textContent = "+ 新增图鉴";
  }
  renderCatalogMode();
  renderCatalogCats();
  renderCatalogSort();
  catalogState.offset = 0;
  catalogState.searchHint = catalogSearchHint(catalogState.search);
  if (catalogState.searchHint) {
    catalogReqSeq += 1;
    catalogState.loading = false;
    catalogState.items = [];
    catalogState.total = 0;
    catalogState.facetsLoading = false;
    catalogState.facets = { brands: [], ips: [], grades: [] };
    renderCatalogFacets();
    renderCatalogGrid();
    renderCatalogStats();
    updateCatalogFilterToggle();
    return;
  }
  loadCatalogFacets();
  loadCatalogPage(false);
}

function catalogCompactSearchTerm(value = "") {
  return String(value || "").normalize("NFKC").trim().replace(/[\s·・_/\\\-:：.]+/g, "");
}

function catalogSearchHint(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = catalogCompactSearchTerm(raw);
  if (!compact) return "";
  if (/^[a-z]+$/i.test(compact) && compact.length < 3) return "继续输入型号或名称，至少 3 个英文/数字字符后开始搜索。";
  if (/^[a-z0-9]+$/i.test(compact) && compact.length < 3) return "继续输入型号或编号，至少 3 个字符后开始搜索。";
  if (compact.length < 2) return "继续输入一个字，搜索会更准。";
  return "";
}

let catalogFacetSeq = 0;
function loadCatalogFacets() {
  const seq = ++catalogFacetSeq;
  const p = new URLSearchParams();
  if (catalogState.category !== "全部") p.set("category", catalogState.category);
  if (catalogState.brand !== "全部") p.set("brand", catalogState.brand);
  if (catalogState.ip !== "全部") p.set("ip", catalogState.ip);
  if (catalogState.grade !== "全部") p.set("grade", catalogState.grade);
  if (isAdmin && catalogState.status !== "published") p.set("status", catalogState.status);
  catalogState.facetsLoading = true;
  catalogState.facets = { brands: [], ips: [], grades: [] };
  renderCatalogFacets();
  fetch(`${CATALOG_ENDPOINT}/facets?${p.toString()}`)
    .then((r) => (r.ok ? r.json() : { brands: [], ips: [], grades: [] }))
    .then((f) => {
      if (seq !== catalogFacetSeq) return;
      catalogState.facetsLoading = false;
      catalogState.facets = f;
      renderCatalogFacets();
    })
    .catch(() => {
      if (seq !== catalogFacetSeq) return;
      catalogState.facetsLoading = false;
      catalogState.facets = { brands: [], ips: [], grades: [] };
      renderCatalogFacets();
    });
}
function renderCatalogFacets() {
  if (catalogState.facetsLoading) {
    [
      [document.querySelector("#catalogBrands"), document.querySelector("#catalogBrandsRow")],
      [document.querySelector("#catalogIps"), document.querySelector("#catalogIpsRow")],
      [document.querySelector("#catalogGrades"), document.querySelector("#catalogGradesRow")],
    ].forEach(([box, row]) => {
      if (!box || !row) return;
      row.hidden = false;
      box.innerHTML = `<span class="cat-chip catalog-facet-loading">筛选加载中...</span>`;
    });
    return;
  }
  const brands = catalogState.facets.brands || [];
  const ips = catalogState.facets.ips || [];
  const grades = catalogState.facets.grades || [];
  const chip = (v, c, active) => `<span class="cat-chip ${active ? "active" : ""}" data-facet="${escapeHtml(v)}">${escapeHtml(v)}${c ? `<b>${c}</b>` : ""}</span>`;
  // 折叠长列表：先显示前 cap 个，多的用「更多」展开。
  const render = (box, row, list, sel, cap, expanded, moreKey) => {
    if (list.length <= 1) { row.hidden = true; return; }
    row.hidden = false;
    const shown = expanded ? list : list.slice(0, cap);
    let html = chip("全部", 0, sel === "全部") + shown.map((x) => chip(x.value, x.count, sel === x.value)).join("");
    if (!expanded && list.length > cap) html += `<span class="cat-chip cat-more" data-more="${moreKey}">更多 ${list.length - cap} ▾</span>`;
    box.innerHTML = html;
  };
  render(document.querySelector("#catalogBrands"), document.querySelector("#catalogBrandsRow"), brands, catalogState.brand, 8, catalogState.brandsExpanded, "brands");
  render(document.querySelector("#catalogIps"), document.querySelector("#catalogIpsRow"), ips, catalogState.ip, 14, catalogState.ipsExpanded, "ips");
  render(document.querySelector("#catalogGrades"), document.querySelector("#catalogGradesRow"), grades, catalogState.grade, 10, catalogState.gradesExpanded, "grades");
}

let catalogReqSeq = 0;
function loadCatalogPage(append) {
  const params = new URLSearchParams();
  if (catalogState.search) params.set("q", catalogState.search);
  if (catalogState.category !== "全部") params.set("category", catalogState.category);
  if (catalogState.brand !== "全部") params.set("brand", catalogState.brand);
  if (catalogState.ip !== "全部") params.set("ip", catalogState.ip);
  if (catalogState.grade !== "全部") params.set("grade", catalogState.grade);
  if (catalogState.mine) params.set("mine", catalogState.mine);
  if (catalogState.sort) params.set("sort", catalogState.sort);
  if (isAdmin && catalogState.status !== "published") params.set("status", catalogState.status);
  params.set("limit", String(catalogState.pageSize));
  params.set("offset", String(catalogState.offset));
  const seq = ++catalogReqSeq;
  catalogState.searchHint = "";
  catalogState.loading = !append;
  if (!append) {
    catalogState.items = [];
    catalogState.total = 0;
    renderCatalogGrid();
    renderCatalogStats();
  }
  fetch(`${CATALOG_ENDPOINT}?${params.toString()}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
    .then(({ items, total, mineStats }) => {
      if (seq !== catalogReqSeq) return;
      catalogState.loading = false;
      catalogState.items = append ? catalogState.items.concat(items || []) : items || [];
      catalogState.total = Number(total ?? catalogState.items.length);
      if (mineStats) catalogState.mineStats = mineStats;
      renderCatalogGrid();
      renderCatalogStats();
    })
    .catch(() => {
      if (seq !== catalogReqSeq) return;
      catalogState.loading = false;
      renderCatalogGrid();
    });
}
function loadMoreCatalog() {
  catalogState.offset += catalogState.pageSize;
  loadCatalogPage(true);
}

function renderCatalogMode() {
  const mode = document.querySelector("#catalogMode");
  if (!mode) return;
  catalogState.status = "published";
  mode.hidden = true;
  mode.querySelectorAll("[data-catalog-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.catalogStatus === catalogState.status);
  });
}

function renderCatalogCats() {
  const box = document.querySelector("#catalogCats");
  if (!box) return;
  box.innerHTML = catalogCategories
    .map((c) => `<span class="cat-chip ${catalogState.category === c.value ? "active" : ""}" data-cat="${escapeHtml(c.value)}" title="${escapeHtml(c.hint || c.label)}">${escapeHtml(c.label)}</span>`)
    .join("");
}

function renderCatalogSort() {
  document.querySelectorAll("#catalogSort [data-sort]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === catalogState.sort);
  });
}

function renderCatalogStats() {
  const stats = document.querySelector("#catalogStats");
  if (!stats) return;
  const ms = catalogState.mineStats || {};
  // 当前条目 + 三个可点击的「我的」维度（点击筛选，再点取消）
  const cards = [
    ["", "当前条目", catalogState.total || catalogState.items.length],
    ["owned", "我拥有", ms.owned || 0],
    ["rated", "我评分", ms.rated || 0],
    ["linked", "我关联", ms.linked || 0],
  ];
  stats.innerHTML = cards
    .map(([key, label, value]) => {
      const clickable = Boolean(key);
      const active = clickable && catalogState.mine === key;
      return `<div class="catalog-stat${clickable ? " clickable" : ""}${active ? " active" : ""}"${clickable ? ` data-mine="${key}"` : ""}>
        <span>${label}${active ? " · 筛选中" : ""}</span><strong>${value}</strong></div>`;
    })
    .join("");
  updateCatalogFilterToggle();
}

function renderCatalogGrid() {
  const grid = document.querySelector("#catalogGrid");
  const empty = document.querySelector("#catalogEmpty");
  if (!grid) return;
  const items = catalogState.items;
  if (empty) {
    empty.hidden = items.length > 0;
    if (catalogState.loading) {
      empty.innerHTML = catalogState.search ? `正在搜索「${escapeHtml(catalogState.search)}」...` : "正在加载图鉴...";
    } else if (catalogState.searchHint) {
      empty.innerHTML = escapeHtml(catalogState.searchHint);
    } else if (catalogState.search || catalogState.category !== "全部" || catalogState.brand !== "全部" || catalogState.ip !== "全部" || catalogState.grade !== "全部" || catalogState.mine) {
      const query = catalogState.search ? `「${escapeHtml(catalogState.search)}」` : "当前筛选";
      empty.innerHTML = `${query}没有匹配条目。<br /><button type="button" class="catalog-empty-action" data-catalog-clear="all">清空筛选</button>`;
    } else {
      empty.innerHTML = "图鉴还没有条目。<br />管理员可点「新增图鉴」录入第一条。";
    }
  }
  grid.innerHTML = items
    .map((it) => {
      const cover = it.coverImage
        ? `<img src="${escapeHtml(displayImageUrl(it.coverImage, 512))}" alt="${escapeHtml(it.name)}" loading="lazy" onerror="this.remove()" />`
        : `<span class="ph">${escapeHtml(it.displayCategory || displayCatalogCategory(it.category))}</span>`;
      return `
        <article class="cat-card" data-id="${it.id}">
          <div class="cat-card-cover">${cover}</div>
          <div class="cat-card-body">
            <div class="cat-card-top">
              ${it.modelNumber ? `<span class="cat-code">${escapeHtml(it.modelNumber)}</span>` : `<span class="cat-code muted-code">${escapeHtml(it.displayCategory || displayCatalogCategory(it.category) || "CATALOG")}</span>`}
              ${it.myRecordStatus ? `<span class="cat-owned">${escapeHtml(it.myRecordStatus)}</span>` : ""}
            </div>
            <div class="cat-card-name">${escapeHtml(it.name)}</div>
            <div class="cat-card-meta">${it.ip && it.ip !== "其他" ? `<span class="cat-work">${escapeHtml(it.ip)}</span>` : ""}${escapeHtml([it.brandGroup || it.brand, it.scale].filter(Boolean).join(" · ") || "—")}</div>
            <div class="cat-card-foot">
              <div class="stars">${catStarHtml(Math.round(it.ratingAvg))}</div>
              <span class="cat-owners">${it.ownerCount} 拥有</span>
            </div>
          </div>
        </article>`;
    })
    .join("");
  if (catalogState.total > items.length) {
    grid.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="catalog-more-btn" id="catalogMoreBtn">加载更多（已显示 ${items.length} / ${catalogState.total}）</button>`,
    );
  }
  window.lucide?.createIcons?.();
}

function openCatalogModal() {
  const backdrop = document.querySelector("#catalogModal");
  const modal = backdrop?.querySelector(".catalog-modal");
  if (!backdrop) return;
  backdrop.hidden = false;
  if (modal) modal.scrollTop = 0;
}
function closeCatalogModal() {
  document.querySelector("#catalogModal").hidden = true;
  window.clearTimeout(catalogState.officialGallery?.timer);
  window.clearTimeout(catalogState.officialGallery?.preloadTimer);
  catalogState.current = null;
  catalogState.editing = false;
  catalogState.officialGallery = { images: [], index: 0, animating: false, timer: 0, requestId: 0 };
}

// ---- 说明书在线预览（万代拼装条目，按需渲染）----
let manualPollTimer = 0;
function resetCatalogManual() {
  window.clearTimeout(manualPollTimer);
  const section = document.querySelector("#catManualSection");
  if (!section) return;
  section.hidden = true;
  const pages = document.querySelector("#catManualPages");
  pages.hidden = true;
  pages.innerHTML = "";
  const hint = document.querySelector("#catManualHint");
  hint.hidden = true;
  hint.textContent = "";
  const btn = document.querySelector("#catManualBtn");
  btn.disabled = false;
  btn.hidden = false;
  document.querySelector("#catManualBtnLabel").textContent = "在线查看说明书";
}

function resetCatalogPickupLink() {
  const section = document.querySelector("#catPickupSection");
  if (!section) return;
  section.hidden = true;
  const btn = document.querySelector("#catPickupBtn");
  if (btn) btn.dataset.pickupId = "";
  const label = document.querySelector("#catPickupBtnLabel");
  if (label) label.textContent = "查看取件表";
  const hint = document.querySelector("#catPickupHint");
  if (hint) hint.textContent = "";
}

function renderCatalogPickupLink(item) {
  resetCatalogPickupLink();
  const pickup = item?.pickup;
  if (!pickup?.id) return;
  const section = document.querySelector("#catPickupSection");
  const btn = document.querySelector("#catPickupBtn");
  const label = document.querySelector("#catPickupBtnLabel");
  const hint = document.querySelector("#catPickupHint");
  if (!section || !btn) return;
  btn.dataset.pickupId = pickup.id;
  if (label) label.textContent = "查看取件表";
  if (hint) {
    const bits = [];
    if (pickup.sectionCount) bits.push(`${pickup.sectionCount} 个部位`);
    if (pickup.partCount) bits.push(`${pickup.partCount} 颗零件`);
    hint.textContent = bits.length ? `已关联官方取件表：${bits.join(" · ")}` : "已关联官方取件表";
  }
  section.hidden = false;
}

async function fetchManualView(catalogId, probe) {
  const res = await fetch(`/api/manual-view/${encodeURIComponent(catalogId)}${probe ? "?probe=1" : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 打开详情时静默探测：有关联说明书才显示入口（probe 不触发渲染）。
async function probeCatalogManual(item) {
  resetCatalogManual();
  if (!item?.id) return;
  try {
    const data = await fetchManualView(item.id, true);
    if (catalogState.current?.id !== item.id) return; // 用户已切到别的条目
    if (Array.isArray(data.manuals) && data.manuals.length) {
      document.querySelector("#catManualSection").hidden = false;
      if (data.manuals.length > 1) {
        document.querySelector("#catManualBtnLabel").textContent = `在线查看说明书（${data.manuals.length} 册）`;
      }
      window.lucide?.createIcons?.();
    }
  } catch {
    /* 探测失败就不显示入口 */
  }
}

function renderManualPages(manuals) {
  const box = document.querySelector("#catManualPages");
  box.innerHTML = manuals
    .map((manual, index) => {
      const head = manuals.length > 1 ? `<p class="cat-manual-book">第 ${index + 1} 册</p>` : "";
      const pages = manual.pages
        .map((page) => `<img src=".${page}" loading="lazy" alt="说明书页" data-manual-img="${escapeHtml(page)}" />`)
        .join("");
      return head + pages;
    })
    .join("");
  box.hidden = false;
}

// 点击按钮：触发渲染并轮询直到全部就绪（首次打开需服务端现场渲染，几秒～半分钟）。
async function openCatalogManual() {
  const item = catalogState.current;
  if (!item?.id) return;
  const btn = document.querySelector("#catManualBtn");
  const label = document.querySelector("#catManualBtnLabel");
  const hint = document.querySelector("#catManualHint");
  btn.disabled = true;
  label.textContent = "加载中…";
  const startedAt = Date.now();
  const poll = async () => {
    try {
      const data = await fetchManualView(item.id, false);
      if (catalogState.current?.id !== item.id) return;
      const manuals = Array.isArray(data.manuals) ? data.manuals : [];
      if (manuals.length && manuals.every((m) => m.status === "ready")) {
        renderManualPages(manuals);
        btn.hidden = true;
        hint.hidden = true;
        return;
      }
      if (Date.now() - startedAt > 120000) {
        btn.disabled = false;
        label.textContent = "在线查看说明书";
        hint.textContent = "准备超时了，稍后再点一次试试。";
        hint.hidden = false;
        return;
      }
      hint.textContent = "首次打开需要准备页面（约几秒到半分钟），正在生成…";
      hint.hidden = false;
      manualPollTimer = window.setTimeout(poll, 2500);
    } catch {
      btn.disabled = false;
      label.textContent = "在线查看说明书";
      hint.textContent = "加载失败，请稍后重试。";
      hint.hidden = false;
    }
  };
  poll();
}

function catalogVersionSummary(item = {}) {
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  const text = [item.name, item.modelNumber, item.series, item.scale, item.work, ...aliases].filter(Boolean).join(" ");
  const tags = [];
  const push = (value) => {
    const clean = String(value || "").trim();
    if (clean && !tags.includes(clean)) tags.push(clean);
  };
  push(item.series);
  push(item.work && item.work !== "其他 / 综合" ? item.work : "");
  push(item.scale);
  if (/festival|expo|展会|会场|限定|抽选|特别|special/i.test(text)) push("限定 / 特别版");
  const year = String(item.releaseDate || "").match(/\b(20\d{2})\b/)?.[1] || String(text).match(/\b(20\d{2})\b/)?.[1];
  if (year) push(`${year} 发售`);
  if (item.modelNumber) push(item.modelNumber);
  return tags.slice(0, 5);
}

function splitCatalogDescription(description = "") {
  const lines = String(description || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const body = [];
  const sources = [];
  let inManualBlock = false;
  for (const line of lines) {
    if (/^---\s*Bandai Manuals\s*---$/i.test(line)) { inManualBlock = true; continue; }
    if (/^---\s*End Bandai Manuals\s*---$/i.test(line)) { inManualBlock = false; continue; }
    if (inManualBlock || /^商品图[：:]/.test(line)) continue;
    const url = line.match(/https?:\/\/\S+/i)?.[0] || "";
    if (url) {
      const label = line.slice(0, line.indexOf(url)).replace(/[：:\s]+$/g, "") || new URL(url).hostname.replace(/^www\./, "");
      sources.push({ label, url });
    } else if (/^(来源|资料来源|官方来源|品牌页|官网)/.test(line)) {
      sources.push({ label: line.replace(/^(来源|资料来源|官方来源)[：:\s]*/i, ""), url: "" });
    } else {
      body.push(line);
    }
  }
  return { body: body.join("\n"), sources };
}

function catalogDescriptionField(description = "", label = "") {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(description || "").match(new RegExp(`^${escaped}[：:]\\s*(.+)$`, "mi"));
  return match ? match[1].trim() : "";
}

function catalogReadableWork(raw = "", fallback = "") {
  const value = String(raw || fallback || "").trim();
  const map = [
    [/閃光のハサウェイ|闪光的哈萨维|閃哈/i, "机动战士高达 闪光的哈萨维"],
    [/SEED\s*DESTINY|seed destiny/i, "机动战士高达 SEED DESTINY"],
    [/SEED/i, "机动战士高达 SEED"],
    [/宇宙世纪|UC/i, "宇宙世纪 UC"],
    [/假面骑士|仮面ライダー/i, "假面骑士"],
  ];
  for (const [re, name] of map) if (re.test(value)) return name;
  return value.replace(/机動战士/g, "机动战士").replace(/ガンダム/g, "高达");
}

function catalogSubjectName(item = {}) {
  const name = String(item.name || "")
    .replace(/^(?:HG|RG|MG|PG|HGUC|HGCE|HGBF|MGEX|METAL BUILD)\s*/i, "")
    .replace(/\b1\/\d+\b/g, "")
    .trim();
  return String(item.character || "").trim() || name || String(item.name || "").trim();
}

function catalogSettingSummary(item = {}, parsedBody = "") {
  const rawDescription = String(item.description || "");
  const rawWork = catalogDescriptionField(rawDescription, "作品") || catalogDescriptionField(rawDescription, "登场作品") || item.work;
  const work = catalogReadableWork(rawWork, item.work);
  const subject = catalogSubjectName(item);
  const name = String(item.name || "");
  const series = String(item.series || "").trim();
  const scale = String(item.scale || "").trim();
  const spec = [series, scale].filter(Boolean).join(" / ");
  if (/梅萨|Messer|メッサー/i.test(name + subject)) {
    const variant = /高文|ガウマン/i.test(name + rawDescription) ? "高文机" : subject;
    return `${subject}出自《${work}》。梅萨是剧中马夫蒂阵营运用的量产型 MS，厚重外形和大型推进布局强调宇宙世纪后期机体的压迫感；本条目对应${variant}规格，适合作为《闪光的哈萨维》系机体和版本辨识参考。`;
  }
  if (/强袭自由|Strike Freedom|ストライクフリーダム/i.test(name + subject)) {
    return `${subject}出自《${work}》，是基拉·大和驾驶的高机动型高达。机体以背部机动兵装翼、龙骑兵系统和多重远程火力为核心特征；本条目为${spec || "图鉴"}版本，重点用于区分不同商品化规格和限定形态。`;
  }
  if (/Hi[-\s]?ν|Hi-ν|海牛/i.test(name + subject)) {
    return `${subject}属于宇宙世纪谱系中人气极高的 ν 高达系机体。其设计强调翼状推进组件与重武装扩展，本条目为${spec || "图鉴"}规格，适合和普通版、HWS 装备及展会限定版本一起对照收藏。`;
  }
  if (/异端|Astray|红龙|金异端/i.test(name + subject)) {
    return `${subject}出自《${work || "机动战士高达 SEED ASTRAY"}》相关谱系。异端系机体常以换装、特殊武装和机体颜色区分版本，本条目可作为对应形态、装备包和再贩版本的辨识资料。`;
  }
  if (/假面骑士|仮面ライダー/i.test(name + subject + work)) {
    return `${subject}出自《${work || "假面骑士"}》相关作品。该条目收录的是${series || "成品可动"}商品化版本，适合用于确认角色形态、发售批次和收藏记录；具体造型以官方商品图与公开资料为准。`;
  }
  if (/高达|ガンダム|GUNDAM|MS\b|机体|機体/i.test(name + subject + work)) {
    return `${subject}出自《${work || item.work || "高达系列"}》。本条目以官方商品资料和说明书索引整理，重点记录机体名称、作品归属、产品线和发售批次，方便区分通贩、限定、再贩及不同规格版本。`;
  }
  if (parsedBody && !/^(由 Bandai|日文名|品番|官网分类|官方说明书|TAMASHII WEB ID|销售形态|价格|发售|定位)[：:]/m.test(parsedBody)) {
    return parsedBody;
  }
  return `${subject || "该条目"}为${[item.brand, series, scale].filter(Boolean).join(" / ") || "当前图鉴"}收录条目，图鉴依据官方公开资料整理，用于确认商品版本、发售信息和收藏记录。`;
}

function renderCatalogSourceLinks(sources = []) {
  const box = document.querySelector("#catSourceLinks");
  if (!box) return;
  box.hidden = sources.length === 0;
  box.innerHTML = sources
    .slice(0, 6)
    .map((source) => {
      const label = escapeHtml(source.label || "资料来源");
      if (!source.url) return `<span>${label}</span>`;
      return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .join("");
}

function renderCatalogContributors(contributors = []) {
  const section = document.querySelector("#catContributorsSection");
  const list = document.querySelector("#catContributorsList");
  const hint = document.querySelector("#catContributorsHint");
  if (!section || !list) return;
  const rows = Array.isArray(contributors) ? contributors.slice(0, 5) : [];
  section.hidden = rows.length === 0;
  if (!rows.length) {
    list.innerHTML = "";
    if (hint) hint.textContent = "";
    return;
  }
  if (hint) hint.textContent = `最近 ${rows.length} 位`;
  list.innerHTML = rows.map((item) => {
    const username = item.username || "玩家";
    const initial = String(username).trim().slice(0, 1) || "玩";
    const action = item.description || item.contributionLabel || "完善了图鉴资料";
    const time = item.createdAt ? adminRelativeTime(item.createdAt) : "";
    const avatar = item.avatarUrl
      ? `<img src="${escapeHtml(displayImageUrl(item.avatarUrl, 120))}" alt="" loading="lazy" decoding="async" />`
      : `<span>${escapeHtml(initial)}</span>`;
    return `<article class="cat-contributor-item">
      <div class="cat-contributor-avatar">${avatar}</div>
      <div class="cat-contributor-copy">
        <strong>${escapeHtml(username)}</strong>
        <p>${escapeHtml(action)}</p>
      </div>
      ${time ? `<time>${escapeHtml(time)}</time>` : ""}
    </article>`;
  }).join("");
}

function mergeCatalogSources(...groups) {
  const seen = new Set();
  const merged = [];
  for (const source of groups.flat()) {
    const label = String(source?.label || "资料来源").trim();
    const url = String(source?.url || "").trim();
    const key = url || label;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ label, url });
  }
  return merged.slice(0, 8);
}

function loadCatalogAiSummary(item, baseSources = []) {
  const desc = document.querySelector("#catViewDesc");
  if (!item?.id || !desc) return;
  const seq = ++catalogSummarySeq;
  const fallback = desc.textContent || "";
  if (fallback) desc.textContent = `${fallback}\n\n正在用 MiMo 搜索整理更完整的设定简介...`;
  fetch(`${CATALOG_ENDPOINT}/${encodeURIComponent(item.id)}/ai-summary`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      if (seq !== catalogSummarySeq || catalogState.current?.id !== item.id) return;
      if (data?.summary) {
        desc.textContent = data.summary;
        renderCatalogSourceLinks(mergeCatalogSources(baseSources, data.sources || []));
      } else {
        desc.textContent = fallback;
        renderCatalogSourceLinks(baseSources);
      }
    })
    .catch(() => {
      if (seq !== catalogSummarySeq || catalogState.current?.id !== item.id) return;
      desc.textContent = fallback;
      renderCatalogSourceLinks(baseSources);
    });
}

function renderCatalogRelated(data = { sections: [] }) {
  const section = document.querySelector("#catRelatedSection");
  const groups = document.querySelector("#catRelatedGroups");
  if (!section || !groups) return;
  const sections = (data.sections || []).filter((group) => Array.isArray(group.items) && group.items.length);
  section.hidden = sections.length === 0;
  groups.innerHTML = sections
    .map((group) => `
      <div class="cat-related-group">
        <p class="cat-related-group-title">${escapeHtml(group.label)} · ${escapeHtml(group.value || "")}</p>
        <div class="cat-related-list">
          ${group.items.map((it) => `
            <button type="button" class="cat-related-card" data-related-id="${escapeHtml(it.id)}">
              <span class="cat-related-thumb">${it.coverImage ? `<img src="${escapeHtml(displayImageUrl(it.coverImage, 256))}" loading="lazy" alt="" onerror="this.remove()" />` : ""}</span>
              <span class="cat-related-copy">
                <span class="cat-related-name">${escapeHtml(it.name)}</span>
                <span class="cat-related-meta">${escapeHtml([it.modelNumber, it.series, it.releaseDate].filter(Boolean).join(" · "))}</span>
              </span>
            </button>
          `).join("")}
        </div>
      </div>
    `)
    .join("");
}

function renderCatalogOfficialGallery(item = {}) {
  const section = document.querySelector("#catOfficialGallery");
  const rail = document.querySelector("#catOfficialGalleryRail");
  const hint = document.querySelector("#catOfficialGalleryHint");
  if (!section || !rail) return;
  const images = Array.isArray(item.officialImages) ? item.officialImages.filter((image) => image?.imageUrl) : [];
  section.hidden = images.length === 0;
  const visible = images.slice(0, 18);
  catalogState.officialGallery = { images: visible, index: 0, animating: false, timer: 0, requestId: 0 };
  rail.innerHTML = visible
    .map((image, index) => {
      const thumb = image.thumbUrl || image.imageUrl;
      const thumbSrc = displayImageUrl(thumb, 220);
      const caption = image.caption || `官图 ${index + 1}`;
      const eager = index < 6;
      return `
        <button type="button" class="cat-gallery-thumb${index === 0 ? " active" : ""}" data-gallery-jump="${index}" aria-label="跳到${escapeHtml(caption)}">
          <img ${eager ? `src="${escapeHtml(thumbSrc)}"` : `data-src="${escapeHtml(thumbSrc)}"`} loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" onerror="this.closest('.cat-gallery-thumb').remove()" />
        </button>
      `;
    })
    .join("");
  if (hint) {
    const remoteCount = images.filter((image) => /^https?:\/\//i.test(image.imageUrl || "")).length;
    hint.textContent = remoteCount ? `${images.length} 张 · 横向滑动预览` : `${images.length} 张`;
  }
  showCatalogOfficialImage(0, 0);
  window.lucide?.createIcons?.();
}

function hydrateCatalogOfficialThumbs(centerIndex = 0) {
  const gallery = catalogState.officialGallery || { images: [] };
  const images = gallery.images || [];
  if (!images.length) return;
  const indexes = new Set([0, 1, 2, centerIndex - 2, centerIndex - 1, centerIndex, centerIndex + 1, centerIndex + 2]);
  indexes.forEach((rawIndex) => {
    const index = (rawIndex + images.length) % images.length;
    const img = document.querySelector(`.cat-gallery-thumb[data-gallery-jump="${index}"] img[data-src]`);
    if (!img) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}

function catalogOfficialImageSrc(image, width = 1200) {
  return displayImageUrl(image?.thumbUrl || image?.imageUrl || "", width);
}

function preloadCatalogOfficialImage(src) {
  if (!src) return Promise.resolve();
  if (catalogOfficialImagePreloadCache.has(src)) return catalogOfficialImagePreloadCache.get(src);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(src);
    img.onerror = () => resolve(src);
    img.src = src;
    if (typeof img.decode === "function") img.decode().then(() => resolve(src)).catch(() => {});
  });
  catalogOfficialImagePreloadCache.set(src, promise);
  return promise;
}

function warmCatalogOfficialImages(centerIndex = 0) {
  const gallery = catalogState.officialGallery || { images: [] };
  const images = gallery.images || [];
  if (images.length <= 1) return;
  window.clearTimeout(gallery.preloadTimer);
  gallery.preloadTimer = window.setTimeout(() => {
    [-1, 1, 2].forEach((delta) => {
      const image = images[(centerIndex + delta + images.length) % images.length];
      preloadCatalogOfficialImage(catalogOfficialImageSrc(image, 1200));
    });
  }, 80);
}

function showCatalogOfficialImage(nextIndex, direction = 1) {
  const gallery = catalogState.officialGallery || { images: [] };
  const images = gallery.images || [];
  if (!images.length) return;
  const index = (nextIndex + images.length) % images.length;
  const image = images[index];
  const main = document.querySelector("#catOfficialMainImg");
  const photo = document.querySelector("#catOfficialMainPhoto");
  const caption = document.querySelector("#catOfficialCaption");
  const stage = document.querySelector("#catOfficialGalleryStage");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (!main || !photo || !caption) return;
  window.clearTimeout(gallery.timer);
  gallery.requestId = (gallery.requestId || 0) + 1;
  const requestId = gallery.requestId;
  gallery.index = index;
  gallery.animating = true;
  catalogState.officialGallery = gallery;
  hydrateCatalogOfficialThumbs(index);
  document.querySelectorAll(".cat-gallery-thumb").forEach((node) => {
    const active = Number(node.dataset.galleryJump) === index;
    node.classList.toggle("active", active);
    if (active && direction !== 0) node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  });
  const full = image.imageUrl || "";
  const src = catalogOfficialImageSrc(image, 1200);
  const title = image.caption || `官图 ${index + 1}`;
  const meta = [image.width && image.height ? `${image.width}×${image.height}` : "", image.sourceLabel].filter(Boolean).join(" · ");
  const applyImage = () => {
    main.src = src;
    main.alt = title;
    photo.dataset.officialImg = full;
    caption.innerHTML = `<strong>${escapeHtml(title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}<span>${index + 1} / ${images.length}</span>`;
  };
  if (reduceMotion || direction === 0) {
    applyImage();
    stage?.classList.remove("is-loading");
    photo.classList.remove("slide-out-left", "slide-out-right", "slide-in-left", "slide-in-right");
    gallery.animating = false;
    warmCatalogOfficialImages(index);
    return;
  }
  const outClass = direction > 0 ? "slide-out-left" : "slide-out-right";
  const inClass = direction > 0 ? "slide-in-right" : "slide-in-left";
  photo.classList.remove("slide-out-left", "slide-out-right", "slide-in-left", "slide-in-right");
  photo.classList.add(outClass);
  stage?.classList.add("is-loading");
  preloadCatalogOfficialImage(src).then(() => {
    if ((catalogState.officialGallery?.requestId || 0) !== requestId) return;
    applyImage();
    stage?.classList.remove("is-loading");
    photo.classList.remove(outClass);
    photo.classList.add(inClass);
    requestAnimationFrame(() => {
      photo.classList.remove(inClass);
      gallery.timer = window.setTimeout(() => {
        if ((catalogState.officialGallery?.requestId || 0) === requestId) gallery.animating = false;
      }, 260);
    });
    warmCatalogOfficialImages(index);
  });
}

function stepCatalogOfficialGallery(delta) {
  const gallery = catalogState.officialGallery || { images: [], index: 0 };
  if (!gallery.images?.length) return;
  showCatalogOfficialImage((gallery.index || 0) + delta, delta);
}

function loadCatalogRelated(id) {
  const section = document.querySelector("#catRelatedSection");
  const groups = document.querySelector("#catRelatedGroups");
  if (section) section.hidden = true;
  if (groups) groups.innerHTML = "";
  if (!id) return;
  fetch(`${CATALOG_ENDPOINT}/${encodeURIComponent(id)}/related`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { sections: [] }))
    .then(renderCatalogRelated)
    .catch(() => renderCatalogRelated({ sections: [] }));
}

function showCatalogView(item) {
  catalogState.current = item;
  catalogState.editing = false;
  const categoryLabel = item.displayCategory || displayCatalogCategory(item.category);
  const aliasPreview = catalogAliasPreview(item);
  const summaryTags = catalogVersionSummary(item);
  const description = splitCatalogDescription(item.description || "");
  document.querySelector("#catalogView").hidden = false;
  document.querySelector("#catalogForm").hidden = true;
  openCatalogModal();
  probeCatalogManual(item);
  renderCatalogPickupLink(item);
  renderCatalogOfficialGallery(item);
  loadCatalogRelated(item.id);
  const modalKicker = document.querySelector("#catalogModalKicker");
  const modalTitle = document.querySelector("#catalogModalTitle");
  if (modalKicker) modalKicker.textContent = "CATALOG ENTRY";
  if (modalTitle) modalTitle.textContent = "图鉴详情";
  document.querySelector("#catViewName").textContent = item.name;
  document.querySelector("#catViewCategory").textContent = [categoryLabel, "正式条目"].filter(Boolean).join(" / ");
  document.querySelector("#catViewMeta").textContent =
    [item.modelNumber, item.brand, item.series, item.scale, item.work].filter(Boolean).join(" · ") || categoryLabel || "";
  const summary = document.querySelector("#catVersionSummary");
  if (summary) {
    summary.hidden = summaryTags.length === 0;
    summary.innerHTML = summaryTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  }
  document.querySelector("#catViewStatus").textContent = "正式图鉴";
  document.querySelector("#catViewStatus").classList.remove("is-pending");
  document.querySelector("#catInfoGrid").innerHTML = [
    ["官方编号", item.modelNumber],
    ["厂牌 / 厂商", item.brand],
    ["产品线 / 系列", item.series],
    ["比例 / 规格", item.scale],
    ["作品", item.work],
    ["角色 / 机体", item.character],
    ["发售时间", item.releaseDate],
    ["顶层分类", categoryLabel],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="cat-info-cell"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  const aliasList = document.querySelector("#catAliasList");
  if (aliasList) {
    aliasList.hidden = aliasPreview.length === 0;
    aliasList.innerHTML = aliasPreview.length
      ? `<span>常用搜索词</span>${aliasPreview.map((alias) => `<b>${escapeHtml(alias)}</b>`).join("")}`
      : "";
  }
  document.querySelector("#catViewPrice").textContent = item.price ? catalogPriceDisplay(item) : "暂无参考价";
  document.querySelector("#catViewPrice").title = item.priceNote || "";
  const cover = document.querySelector("#catViewCover");
  cover.style.display = item.coverImage ? "" : "none";
  cover.onerror = () => {
    cover.style.display = "none";
    cover.removeAttribute("src");
  };
  if (item.coverImage) cover.src = displayImageUrl(item.coverImage, 900);
  document.querySelector("#catStars").innerHTML = catStarHtml(item.myRating || Math.round(item.ratingAvg));
  document.querySelector("#catRatingText").textContent =
    item.ratingCount ? `${item.ratingAvg} ★ · ${item.ratingCount} 人评分${item.myRating ? "（你打了 " + item.myRating + " 星）" : "，点星打分"}` : "还没有人评分，点星打分";
  document.querySelector("#catViewOwners").textContent = `${item.ownerCount} 人拥有这款${item.myRecordCount ? ` · 你已关联 ${item.myRecordCount} 条${item.myRecordStatus ? `（${item.myRecordStatus}）` : ""}` : ""}`;
  document.querySelector("#catViewDesc").textContent = catalogSettingSummary(item, description.body);
  renderCatalogSourceLinks(description.sources);
  renderCatalogContributors(item.contributors || []);
  loadCatalogAiSummary(item, description.sources);
  const canManageCatalog = Boolean(item.canManage);
  document.querySelector("#catAdminActions").hidden = !canManageCatalog;
  document.querySelector("#catApproveBtn").hidden = true;
  document.querySelector("#catReviewHint").textContent = "正式图鉴条目仍可继续编辑维护。";
  const addButton = document.querySelector("#catAddRecordBtn");
  if (addButton) {
    addButton.querySelector("span").textContent = item.myRecordStatus ? "再记录一件" : "加入我的收藏";
  }
  const contributionPanel = document.querySelector("#catContributionPanel");
  const contributionForm = document.querySelector("#catContributionForm");
  const contributionReceipt = document.querySelector("#catContributionReceipt");
  if (contributionPanel && contributionForm) {
    contributionPanel.hidden = true;
    contributionForm.reset();
    contributionForm.hidden = false;
    if (contributionReceipt) contributionReceipt.hidden = true;
  }
  window.lucide?.createIcons?.();
}

function approveCatalogCurrent() {
  if (!catalogState.current?.canManage) return;
  fetch(`${CATALOG_ENDPOINT}/${catalogState.current.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "published" }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((res) => {
      showToast(`「${res.item?.name || catalogState.current.name}」已录入正式图鉴`);
      closeCatalogModal();
      renderCatalog();
    })
    .catch(() => showToast("通过失败，请重试"));
}

function openCatalogDetail(id) {
  fetch(`${CATALOG_ENDPOINT}/${id}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => { if (res && res.item) showCatalogView(res.item); })
    .catch(() => {});
}

function rateCatalog(stars) {
  if (!catalogState.current) return;
  const id = catalogState.current.id;
  fetch(`${CATALOG_ENDPOINT}/${id}/rate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stars }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => { if (res && res.item) { showCatalogView(res.item); renderCatalog(); } })
    .catch(() => {});
}

function catalogContributionValue(item, key) {
  if (!item) return "";
  if (key === "price") return item.price ? catalogPriceDisplay(item) : "";
  if (key === "aliases") return Array.isArray(item.aliases) ? item.aliases.join("、") : "";
  if (key === "description") return item.description || "";
  return String(item[key] ?? "");
}

function fillCatalogContributionField() {
  const form = document.querySelector("#catContributionForm");
  const field = document.querySelector("#catContributionField");
  const oldValue = document.querySelector("#catContributionOldValue");
  const oldLabel = document.querySelector("#catContributionOldLabel");
  const proposedLabel = document.querySelector("#catContributionProposedLabel");
  if (!form || !field || !oldValue) return;
  const item = catalogState.current;
  const isAliasField = field.value === "aliases";
  if (oldLabel) oldLabel.textContent = isAliasField ? "现有搜索词" : "当前内容";
  if (proposedLabel) proposedLabel.textContent = isAliasField ? "建议新增" : "建议修改为";
  oldValue.value = catalogContributionValue(item, field.value);
  form.elements.proposedValue.value = "";
  form.elements.proposedValue.placeholder = catalogContributionPlaceholders[field.value] || "填写你认为正确的内容";
}

function renderCatalogContributionFields(activeKey = catalogContributionFields[0]?.[0]) {
  const fieldInput = document.querySelector("#catContributionField");
  const fieldset = document.querySelector("#catContributionFieldset");
  if (!fieldInput || !fieldset) return;
  const selectedKey = catalogContributionFields.some(([key]) => key === activeKey) ? activeKey : catalogContributionFields[0]?.[0];
  fieldInput.value = selectedKey || "";
  fieldset.innerHTML = Object.entries(catalogContributionGroupLabels)
    .map(([groupKey, groupLabel]) => {
      const buttons = catalogContributionFields
        .filter(([, , group]) => group === groupKey)
        .map(([key, label]) => `<button class="cat-field-chip${key === selectedKey ? " active" : ""}" type="button" data-field-key="${escapeHtml(key)}">${escapeHtml(label)}</button>`)
        .join("");
      return `<div class="cat-field-group"><span>${escapeHtml(groupLabel)}</span><div>${buttons}</div></div>`;
    })
    .join("");
}

function toggleCatalogContribution() {
  const panel = document.querySelector("#catContributionPanel");
  const form = document.querySelector("#catContributionForm");
  const receipt = document.querySelector("#catContributionReceipt");
  if (!panel || !form || !catalogState.current) return;

  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    form.hidden = false;
    if (receipt) receipt.hidden = true;
    renderCatalogContributionFields();
    fillCatalogContributionField();
    form.elements.proposedValue?.focus();
  }
}

function scrollCatalogContributionReceiptIntoView(receipt) {
  if (!receipt) return;
  const modal = receipt.closest(".catalog-modal");
  if (!modal) {
    receipt.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return;
  }
  const modalRect = modal.getBoundingClientRect();
  const receiptRect = receipt.getBoundingClientRect();
  const centeredTop = modal.scrollTop
    + (receiptRect.top - modalRect.top)
    - (modal.clientHeight - receiptRect.height) / 2;
  const maxTop = Math.max(0, modal.scrollHeight - modal.clientHeight);
  const targetTop = Math.max(0, Math.min(maxTop, centeredTop));
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  modal.scrollTo({ top: targetTop, behavior: reduceMotion ? "auto" : "smooth" });
}
window.scrollCatalogContributionReceiptIntoView = scrollCatalogContributionReceiptIntoView;

async function submitCatalogContribution(event) {
  event.preventDefault();
  const item = catalogState.current;
  if (!item?.id) return;
  const form = event.currentTarget;
  const fieldKey = String(form.elements.fieldKey?.value || "").trim();
  const fieldLabel = catalogContributionFields.find(([key]) => key === fieldKey)?.[1] || fieldKey;
  const oldValue = String(form.elements.oldValue?.value || "");
  const proposedValue = String(form.elements.proposedValue?.value || "").trim();
  const userNote = String(form.elements.userNote?.value || "").trim();
  if (!fieldKey || !proposedValue) {
    showToast("请填写纠错字段和建议内容");
    return;
  }
  if (proposedValue === oldValue) {
    showToast(fieldKey === "aliases" ? "这些搜索词已经存在" : "建议内容和当前内容相同");
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const btnText = button?.querySelector(".btn-text");
  const originalText = btnText?.textContent || "提交补充资料";

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    if (btnText) btnText.textContent = "正在提交";
  }
  try {
    const response = await fetch(`${CATALOG_ENDPOINT}/${encodeURIComponent(item.id)}/contributions`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Client-Source": "web" },
      body: JSON.stringify({
        type: "correction",
        userNote,
        items: [{ fieldKey, fieldLabel, oldValue, proposedValue }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "提交失败");
    form.elements.proposedValue?.blur();
    form.elements.userNote?.blur();

    if (button) {
      button.classList.remove("is-loading");
      button.classList.add("is-success");
      if (btnText) btnText.textContent = "已收到";
    }

    window.setTimeout(() => {
      const receipt = document.querySelector("#catContributionReceipt");
      const rank = Number(result.contribution?.contributorStats?.contributorRank || 0);
      const total = Number(result.contribution?.contributorStats?.totalContributors || 0);
      const value = result.contribution?.contributionValue || {};
      const rankText = document.querySelector("#catContributionRank");
      form.reset();
      form.hidden = true;
      if (receipt) {
        receipt.hidden = false;
        if (rankText) {
          rankText.hidden = !(rank > 0);
          rankText.textContent = rank > 0
            ? `你是第 ${rank} 位协助完善图鉴的玩家${total > rank ? `，目前已有 ${total} 位参与` : ""}。采纳后会结算贡献值${Number(value.points || 0) > 0 ? `，你当前已有 ${Number(value.points || 0)} 点` : ""}。`
            : "";
        }
        receipt.classList.remove("show");
        void receipt.offsetWidth;
        receipt.classList.add("show");
        window.requestAnimationFrame(() => scrollCatalogContributionReceiptIntoView(receipt));
      }
      if (button) {
        button.disabled = false;
        button.classList.remove("is-success");
        if (btnText) btnText.textContent = originalText;
      }
      window.lucide?.createIcons?.();
    }, 260);
  } catch (error) {
    showToast(error.message || "网络错误，请稍后重试");
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      if (btnText) btnText.textContent = originalText;
    }
  }
}

function openCatalogEdit(item) {
  if (!isAdmin || (item && !item.canManage)) {
    showToast("只有管理员可以维护图鉴");
    return;
  }
  catalogState.current = item || null;
  catalogState.editing = true;
  catalogOptionsData = [];
  document.querySelector("#catalogView").hidden = true;
  const form = document.querySelector("#catalogForm");
  form.hidden = false;
  form.reset();
  document.querySelector("#catRecognizeOptions").hidden = true;
  document.querySelector("#catRecognizeOptions").innerHTML = "";
  document.querySelector("#catRecognizeHint").hidden = true;
  const modalKicker = document.querySelector("#catalogModalKicker");
  const modalTitle = document.querySelector("#catalogModalTitle");
  if (modalKicker) modalKicker.textContent = item ? "EDIT ENTRY" : "NEW ENTRY";
  if (modalTitle) modalTitle.textContent = item ? "编辑图鉴" : "新增图鉴";
  document.querySelector("#catSaveLabel").textContent = item ? "保存图鉴" : "录入图鉴";
  document.querySelector("#catFormNote").innerHTML = '<i data-lucide="book-open"></i> 图鉴维护仅限管理员；收藏记录不会自动生成图鉴候选。';
  if (item) {
    ensureSelectValue(form.elements.category, item.category, displayCatalogCategory(item.category));
    ["name", "modelNumber", "brand", "series", "scale", "work", "category", "character", "price", "coverImage", "description"].forEach((k) => {
      if (form.elements[k]) form.elements[k].value = item[k] != null ? item[k] : "";
    });
  }
  openCatalogModal();
  window.lucide?.createIcons?.();
}

function saveCatalogForm(event) {
  event.preventDefault();
  const form = document.querySelector("#catalogForm");
  const f = new FormData(form);
  const name = (f.get("name") || "").trim();
  if (!name) { showToast("请填写名称"); return; }
  const payload = {
    name,
    modelNumber: (f.get("modelNumber") || "").trim(),
    brand: (f.get("brand") || "").trim(),
    series: (f.get("series") || "").trim(),
    scale: (f.get("scale") || "").trim(),
    work: (f.get("work") || "").trim(),
    category: f.get("category") || "",
    character: (f.get("character") || "").trim(),
    price: Number(f.get("price")) || 0,
    coverImage: (f.get("coverImage") || "").trim(),
    description: (f.get("description") || "").trim(),
  };
  const editing = catalogState.current && catalogState.current.id;
  const url = editing ? `${CATALOG_ENDPOINT}/${catalogState.current.id}` : CATALOG_ENDPOINT;
  fetch(url, {
    method: editing ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(() => {
      showToast(editing ? "图鉴已更新" : "图鉴已录入");
      closeCatalogModal();
      renderCatalog();
    })
    .catch(() => showToast("保存失败，请重试"));
}

async function deleteCatalogCurrent() {
  if (!catalogState.current?.canManage) return;
  const ok = await confirmDialog("删除后图鉴库里就没有这条了（不影响已关联的藏品）。", {
    title: `删除图鉴「${catalogState.current.name}」？`,
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;
  fetch(`${CATALOG_ENDPOINT}/${catalogState.current.id}`, { method: "DELETE" })
    .then(() => { showToast("图鉴已删除"); closeCatalogModal(); renderCatalog(); })
    .catch(() => showToast("删除失败"));
}

function setCatNormalizeHint(msg, err) {
  const h = document.querySelector("#catNormalizeHint");
  if (!h) return;
  h.textContent = msg;
  h.hidden = !msg;
  h.classList.toggle("is-error", Boolean(err));
}

function gundamNormalizeNote(normalized = {}, rawName = "") {
  return [
    "由收藏记录/图鉴表单生成的高达图鉴候选，已按高达模型词典进行标准化。",
    rawName ? `原始线索：${rawName}` : "",
    normalized.productSystem ? `产品体系：${normalized.productSystem}` : "",
    normalized.productLine ? `产品线：${normalized.productLine}` : "",
    normalized.mechaNameCn || normalized.mechaNameEn ? `机体：${[normalized.mechaNameCn, normalized.mechaNameEn].filter(Boolean).join(" / ")}` : "",
    normalized.work ? `作品：${normalized.work}` : "",
    normalized.version ? `版本：${normalized.version}` : "",
    normalized.reason ? `解析说明：${normalized.reason}` : "",
  ].filter(Boolean).join("\n");
}

function catalogNormalizeGundam() {
  const form = document.querySelector("#catalogForm");
  if (!form) return;
  const rawName = (form.elements.name.value || "").trim();
  if (!rawName) { setCatNormalizeHint("请先填写一个高达线索名，例如：万代mb自由", true); return; }
  setCatNormalizeHint("整理中…先跑高达词典，必要时调用 AI 补全", false);
  fetch(CATALOG_GUNDAM_NORMALIZE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      record: {
        name: rawName,
        modelNumber: form.elements.modelNumber.value || "",
        brand: form.elements.brand.value || "",
        series: form.elements.series.value || "",
        scale: form.elements.scale.value || "",
        category: form.elements.category.value || "高达模型",
        character: form.elements.character.value || "",
      },
    }),
    signal: AbortSignal.timeout(90000),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(({ normalized }) => {
      if (!normalized) throw new Error("empty normalization");
      form.elements.category.value = "高达模型";
      if (normalized.name) form.elements.name.value = normalized.name;
      if (normalized.modelNumber) form.elements.modelNumber.value = normalized.modelNumber;
      if (normalized.brand) form.elements.brand.value = normalized.brand;
      if (normalized.series || normalized.productLine) form.elements.series.value = normalized.series || normalized.productLine;
      if (normalized.scale) form.elements.scale.value = normalized.scale;
      if (normalized.character || normalized.mechaNameCn || normalized.mechaNameEn) {
        form.elements.character.value = normalized.character || [normalized.mechaNameCn, normalized.mechaNameEn].filter(Boolean).join(" / ");
      }
      const note = gundamNormalizeNote(normalized, rawName);
      if (note) form.elements.description.value = note;
      const score = Math.round(Number(normalized.confidence || 0) * 100);
      setCatNormalizeHint(`已整理为标准字段${score ? `，置信度 ${score}%` : ""}${normalized.needsReview ? "，建议审核确认版本" : ""}`, Boolean(normalized.needsReview));
    })
    .catch(() => setCatNormalizeHint("标准化失败，请稍后重试或先手动填写", true));
}

// 图鉴封面识图（复用识图候选接口）
function catalogRecognizeCover() {
  const form = document.querySelector("#catalogForm");
  const name = (form.elements.name.value || "").trim();
  if (!name) { setCatHint("请先填写名称再识图", true); return; }
  setCatHint("识别中…联网找封面图", false);
  fetch(IMAGE_MATCH_OPTIONS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, series: form.elements.brand.value || form.elements.series.value || "", category: form.elements.category.value || "" }),
    signal: AbortSignal.timeout(120000),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(({ options }) => {
      catalogOptionsData = Array.isArray(options) ? options : [];
      const box = document.querySelector("#catRecognizeOptions");
      if (catalogOptionsData.length) {
        setCatHint(`找到 ${catalogOptionsData.length} 张候选：单击看大图，双击选作封面`, false);
        box.hidden = false;
        box.innerHTML = catalogOptionsData
          .map((o, i) => `<button type="button" class="opt" data-i="${i}"><img src="${escapeHtml(o.previewUrl)}" loading="lazy" onerror="this.closest('.opt').remove()" /></button>`)
          .join("");
      } else {
        setCatHint("没找到候选，可手动填封面地址", true);
      }
    })
    .catch(() => setCatHint("识图失败，请稍后重试", true));
}
function setCatHint(msg, err) {
  const h = document.querySelector("#catRecognizeHint");
  h.textContent = msg; h.hidden = !msg; h.classList.toggle("is-error", Boolean(err));
}
function pickCatalogCover(i) {
  const opt = catalogOptionsData[i];
  if (!opt) return;
  setCatHint("正在保存封面…", false);
  fetch(IMAGE_MATCH_SELECT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageUrl: opt.imageUrl, sourceUrl: opt.sourceUrl }),
  })
    .then((r) => (r.ok ? r.json() : {}))
    .then((res) => {
      const url = res.imageUrl || opt.previewUrl;
      document.querySelector("#catalogForm").elements.coverImage.value = url;
      document.querySelector("#catRecognizeOptions").hidden = true;
      setCatHint("已选用这张封面，保存后生效", false);
    })
    .catch(() => setCatHint("保存失败，请重试", true));
}

// ---- 图鉴事件绑定 ----
let catalogSearchTimer = 0;
document.querySelector("#catalogSearch")?.addEventListener("input", (e) => {
  catalogState.search = e.target.value.trim();
  window.clearTimeout(catalogSearchTimer);
  catalogSearchTimer = window.setTimeout(renderCatalog, 360);
});
// 手机端「筛选」开关：收起/展开 排序+品类+品牌+IP+分级 行，标签上带生效中的筛选数。
function updateCatalogFilterToggle() {
  const label = document.querySelector("#catalogFilterToggleLabel");
  if (!label) return;
  const active =
    (catalogState.category !== "全部") + (catalogState.brand !== "全部") + (catalogState.ip !== "全部") + (catalogState.grade !== "全部") + Boolean(catalogState.mine);
  label.textContent = active ? `筛选 · ${active}` : "筛选";
  document.querySelector("#catalogFilterToggle")?.classList.toggle("has-active", active > 0);
}
document.querySelector("#catalogFilterToggle")?.addEventListener("click", (e) => {
  const panel = document.querySelector("#catalogPanel");
  const open = panel.classList.toggle("filters-open");
  e.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelector("#catalogMode")?.addEventListener("click", (e) => {
  const button = e.target.closest("[data-catalog-status]");
  if (!button) return;
  catalogState.status = button.dataset.catalogStatus;
  renderCatalog();
});
document.querySelector("#catalogSort")?.addEventListener("click", (e) => {
  const button = e.target.closest("[data-sort]");
  if (!button) return;
  catalogState.sort = button.dataset.sort;
  renderCatalog();
});
document.querySelector("#catalogCats")?.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cat]");
  if (!chip) return;
  catalogState.category = chip.dataset.cat;
  catalogState.brand = "全部";
  catalogState.ip = "全部";
  catalogState.grade = "全部";
  catalogState.brandsExpanded = false;
  catalogState.ipsExpanded = false;
  catalogState.gradesExpanded = false;
  renderCatalog();
});
document.querySelector("#catalogBrands")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-more]")) { catalogState.brandsExpanded = true; renderCatalogFacets(); return; }
  const chip = e.target.closest("[data-facet]");
  if (!chip) return;
  catalogState.brand = chip.dataset.facet;
  catalogState.ip = "全部";
  catalogState.grade = "全部";
  catalogState.ipsExpanded = false;
  catalogState.gradesExpanded = false;
  catalogState.offset = 0;
  loadCatalogFacets();
  loadCatalogPage(false);
});
document.querySelector("#catalogIps")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-more]")) { catalogState.ipsExpanded = true; renderCatalogFacets(); return; }
  const chip = e.target.closest("[data-facet]");
  if (!chip) return;
  catalogState.ip = chip.dataset.facet;
  catalogState.grade = "全部";
  catalogState.gradesExpanded = false;
  catalogState.offset = 0;
  loadCatalogFacets();
  loadCatalogPage(false);
});
document.querySelector("#catalogGrades")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-more]")) { catalogState.gradesExpanded = true; renderCatalogFacets(); return; }
  const chip = e.target.closest("[data-facet]");
  if (!chip) return;
  catalogState.grade = chip.dataset.facet;
  catalogState.offset = 0;
  loadCatalogFacets();
  loadCatalogPage(false);
});
document.querySelector("#catalogEmpty")?.addEventListener("click", (e) => {
  if (!e.target.closest("[data-catalog-clear]")) return;
  catalogState.search = "";
  catalogState.category = "全部";
  catalogState.brand = "全部";
  catalogState.ip = "全部";
  catalogState.grade = "全部";
  catalogState.mine = "";
  catalogState.brandsExpanded = false;
  catalogState.ipsExpanded = false;
  catalogState.gradesExpanded = false;
  const input = document.querySelector("#catalogSearch");
  if (input) input.value = "";
  renderCatalog();
});
document.querySelector("#catManualBtn")?.addEventListener("click", openCatalogManual);
document.querySelector("#catPickupBtn")?.addEventListener("click", (event) => {
  const pickupId = event.currentTarget.dataset.pickupId || catalogState.current?.pickup?.id;
  if (!pickupId) return;
  closeCatalogModal();
  openPickup(pickupId);
});
document.querySelector("#catManualPages")?.addEventListener("click", (e) => {
  const img = e.target.closest("[data-manual-img]");
  if (img) openImagePreview(img.src, "点空白处关闭");
});
document.querySelector("#catOfficialGalleryRail")?.addEventListener("click", (e) => {
  const thumb = e.target.closest("[data-gallery-jump]");
  if (!thumb) return;
  const index = Number(thumb.dataset.galleryJump) || 0;
  const current = catalogState.officialGallery?.index || 0;
  if (index === current) return;
  showCatalogOfficialImage(index, index >= current ? 1 : -1);
});
document.querySelector("#catOfficialPrev")?.addEventListener("click", () => stepCatalogOfficialGallery(-1));
document.querySelector("#catOfficialNext")?.addEventListener("click", () => stepCatalogOfficialGallery(1));
document.querySelector("#catOfficialMainPhoto")?.addEventListener("click", (e) => {
  const url = e.currentTarget.dataset.officialImg;
  if (url) openImagePreview(displayImageUrl(url, 1400), "产品官图 · 横向预览");
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("#catalogModal")?.hidden || document.querySelector("#catOfficialGallery")?.hidden) return;
  if (e.key === "ArrowLeft") stepCatalogOfficialGallery(-1);
  if (e.key === "ArrowRight") stepCatalogOfficialGallery(1);
});
document.querySelector("#catalogGrid")?.addEventListener("click", (e) => {
  if (e.target.closest("#catalogMoreBtn")) { loadMoreCatalog(); return; }
  const card = e.target.closest(".cat-card");
  if (card) openCatalogDetail(card.dataset.id);
});
document.querySelector("#catRelatedGroups")?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-related-id]");
  if (card) openCatalogDetail(card.dataset.relatedId);
});
// 统计卡片：点击「我拥有/我评分/我关联」筛选当前维度（再点取消）
document.querySelector("#catalogStats")?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-mine]");
  if (!card) return;
  const key = card.dataset.mine;
  catalogState.mine = catalogState.mine === key ? "" : key;
  catalogState.offset = 0;
  renderCatalogStats();
  loadCatalogPage(false);
});
document.querySelector("#catStars")?.addEventListener("click", (e) => {
  const star = e.target.closest("[data-star]");
  if (star) rateCatalog(Number(star.dataset.star));
});
document.querySelector("#catalogNewBtn")?.addEventListener("click", () => { if (isAdmin) openCatalogEdit(null); });
document.querySelector("#catApproveBtn")?.addEventListener("click", approveCatalogCurrent);
document.querySelector("#catEditBtn")?.addEventListener("click", () => openCatalogEdit(catalogState.current));
document.querySelector("#catDeleteBtn")?.addEventListener("click", deleteCatalogCurrent);
document.querySelector("#catAddRecordBtn")?.addEventListener("click", () => addCatalogToRecords(catalogState.current));
document.querySelector("#catContributionToggle")?.addEventListener("click", toggleCatalogContribution);
document.querySelector("#catContributionFieldset")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-field-key]");
  if (!button) return;
  renderCatalogContributionFields(button.dataset.fieldKey);
  fillCatalogContributionField();
  document.querySelector("#catContributionForm")?.elements.proposedValue?.focus();
});
document.querySelector("#catContributionForm")?.addEventListener("submit", submitCatalogContribution);
document.querySelector("#catalogModalClose")?.addEventListener("click", closeCatalogModal);
document.querySelector("#catalogModal")?.addEventListener("click", (e) => { if (e.target.id === "catalogModal") closeCatalogModal(); });
document.querySelector("#catalogForm")?.addEventListener("submit", saveCatalogForm);
document.querySelector("#catNormalizeBtn")?.addEventListener("click", catalogNormalizeGundam);
document.querySelector("#catRecognizeBtn")?.addEventListener("click", catalogRecognizeCover);
let catOptClickTimer = 0;
document.querySelector("#catRecognizeOptions")?.addEventListener("click", (e) => {
  const b = e.target.closest(".opt");
  if (!b) return;
  window.clearTimeout(catOptClickTimer);
  catOptClickTimer = window.setTimeout(() => {
    const opt = catalogOptionsData[Number(b.dataset.i)];
    if (opt) openImagePreview(opt.previewUrl || opt.imageUrl);
  }, 230);
});
document.querySelector("#catRecognizeOptions")?.addEventListener("dblclick", (e) => {
  const b = e.target.closest(".opt");
  if (!b) return;
  window.clearTimeout(catOptClickTimer);
  pickCatalogCover(Number(b.dataset.i));
});

/* ---- 新增/编辑藏品时：从图鉴搜索关联（选中自动带出名称/厂牌/分类/图） ---- */
let selectedCatalogId = "";
let selectedCatalogDefaults = null;
let catalogPickTimer = 0;

function resetCatalogPick(record) {
  selectedCatalogId = (record && record.catalogId) || "";
  selectedCatalogDefaults = null;
  const input = document.querySelector("#catalogPickInput");
  const results = document.querySelector("#catalogPickResults");
  const linked = document.querySelector("#catalogLinked");
  if (input) input.value = "";
  if (results) { results.hidden = true; results.innerHTML = ""; }
  if (linked) {
    if (selectedCatalogId && record) {
      document.querySelector("#catalogLinkedName").textContent = recordDisplayName(record) || "已选条目";
      linked.hidden = false;
    } else {
      linked.hidden = true;
    }
  }
}

let catalogPickReqSeq = 0;
function searchCatalogPick(term) {
  const results = document.querySelector("#catalogPickResults");
  if (!results) return;
  if (!term) { results.hidden = true; results.innerHTML = ""; return; }
  const seq = ++catalogPickReqSeq;
  const SHOW = 15;
  fetch(`${CATALOG_ENDPOINT}/search?q=${encodeURIComponent(term)}&limit=${SHOW}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
    .then(({ items, total }) => {
      if (seq !== catalogPickReqSeq) return; // 丢弃过期的请求结果，避免乱序
      const list = items || [];
      catalogPickResultsData = list;
      if (!list.length) {
        results.hidden = false;
        results.innerHTML = `<div class="cat-pick-empty">图鉴里没有「${escapeHtml(term)}」，直接往下手填即可</div>`;
        return;
      }
      results.hidden = false;
      const rows = list
        .map(
          (it, i) => `
        <div class="cat-pick-row" data-i="${i}">
          <div class="cat-pick-thumb">${it.coverImage ? `<img src="${escapeHtml(displayImageUrl(it.coverImage, 256))}" loading="lazy" onerror="this.remove()" />` : ""}</div>
          <div class="cat-pick-info">
            <div class="cat-pick-name">${escapeHtml(it.name)}</div>
            <div class="cat-pick-meta">${escapeHtml([it.modelNumber, it.brand, it.scale, it.category].filter(Boolean).join(" · "))}</div>
          </div>
        </div>`,
        )
        .join("");
      const more = total > list.length
        ? `<div class="cat-pick-more">共 ${total} 条匹配，已显示前 ${list.length} 条 · 输入更精确（如加比例/编号）可缩小范围</div>`
        : "";
      results.innerHTML = rows + more;
    })
    .catch(() => {});
}

let catalogPickResultsData = [];
function applyCatalogToRecordForm(it) {
  if (!it) return;
  const f = ui.recordForm.elements;
  if (!String(f.name.value || "").trim()) f.name.value = it.name || "";
  const series = [it.brand, it.series, it.scale].filter(Boolean).join(" / ");
  if (series && !String(f.series.value || "").trim()) f.series.value = series;
  if (it.category && !String(f.category.value || "").trim()) {
    const opt = [...f.category.options].find((o) => o.value === it.category || o.text === it.category);
    if (opt) f.category.value = opt.value || opt.text;
  }
  if (it.coverImage && !String(f.imageUrl.value || "").trim()) f.imageUrl.value = it.coverImage;
  refreshImageThumb();
  selectedCatalogId = it.id;
  selectedCatalogDefaults = {
    catalogId: it.id,
    name: it.name || "",
    series,
    category: f.category.value || "",
  };
  document.querySelector("#catalogLinkedName").textContent = it.name;
  document.querySelector("#catalogLinked").hidden = false;
}

function selectedCatalogSyncFromRecordForm(form) {
  if (!selectedCatalogId || !selectedCatalogDefaults || selectedCatalogDefaults.catalogId !== selectedCatalogId) return undefined;
  const same = (a, b) => String(a || "").trim() === String(b || "").trim();
  return {
    name: same(form.get("name"), selectedCatalogDefaults.name),
    series: same(form.get("series"), selectedCatalogDefaults.series),
    category: same(form.get("category"), selectedCatalogDefaults.category),
  };
}

function addCatalogToRecords(item) {
  if (!item) return;
  closeCatalogModal();
  showModal();
  applyCatalogToRecordForm(item);
  showToast(`已带入图鉴「${item.name}」，请按实际入手价填写总价`);
}

function pickCatalogForRecord(i) {
  const it = catalogPickResultsData[i];
  if (!it) return;
  applyCatalogToRecordForm(it);
  const results = document.querySelector("#catalogPickResults");
  results.hidden = true;
  results.innerHTML = "";
  document.querySelector("#catalogPickInput").value = "";
  showToast(`已关联图鉴「${it.name}」`);
}

document.querySelector("#catalogPickInput")?.addEventListener("input", (e) => {
  const term = e.target.value.trim();
  window.clearTimeout(catalogPickTimer);
  catalogPickTimer = window.setTimeout(() => searchCatalogPick(term), 220);
});
document.querySelector("#catalogPickResults")?.addEventListener("click", (e) => {
  const row = e.target.closest(".cat-pick-row");
  if (row) pickCatalogForRecord(Number(row.dataset.i));
});
document.querySelector("#catalogUnlink")?.addEventListener("click", () => {
  selectedCatalogId = "";
  selectedCatalogDefaults = null;
  document.querySelector("#catalogLinked").hidden = true;
  showToast("已取消图鉴关联");
});
/* ===================== 取件台（pickup / 剪件清单） ===================== */
const PICKUP_ENDPOINT = "./api/pickups";
const pickupState = { q: "", brand: "", sort: "hot", offset: 0, limit: 60, total: 0, loaded: [] };
let pickupBrandsLoaded = false;
let pickupView = "section";
let currentPickup = null;
let pickupCutSet = new Set();
let pickupSearchTimer = 0;

// 整理人显示名:用户上传用其用户名;具名整理人(社区精选,compiler 为简短人名)直接显示;
// 官方/默认一律「玩物不丧志AI」。
function pickupCurator(it) {
  const c = String((it && it.compiler) || "").trim();
  if (it && it.source === "user") {
    const m = /·\s*(.+)$/.exec(c);
    return ((m ? m[1] : c) || "玩家").trim();
  }
  if (c && !c.includes("玩物不丧志") && c.length <= 16) return c;
  return "玩物不丧志AI";
}

function pickupParseEntry(entry) {
  const [num, mult] = String(entry).split("*");
  const qty = mult ? parseInt(mult, 10) || 1 : 1;
  return { num: num.trim(), qty };
}
function pickupCutKey(section, runner, idx) {
  return `${section}␟${runner}␟${idx}`;
}
function pickupProgressStorageKey(id) {
  return `pickup-progress-${id}`;
}

function resetPickupFeedbackForm() {
  const form = document.querySelector("#pickupFeedbackForm");
  if (!form) return;
  form.hidden = true;
  form.reset();
}

async function renderPickup() {
  const newBtn = document.querySelector("#pickupNewBtn");
  if (newBtn) newBtn.hidden = !isAdmin;
  if (!pickupBrandsLoaded) await loadPickupBrands();
  await loadPickups(true);
}

async function loadPickupBrands() {
  try {
    const res = await fetch(`${PICKUP_ENDPOINT}/brands`, { cache: "no-store" });
    if (!res.ok) return;
    const { brands = [] } = await res.json();
    const box = document.querySelector("#pickupBrands");
    const top = brands.slice(0, 22);
    box.innerHTML =
      `<button class="pickup-brand${pickupState.brand ? "" : " active"}" data-brand="">全部</button>` +
      top
        .map(
          (b) =>
            `<button class="pickup-brand${pickupState.brand === b.brand ? " active" : ""}" data-brand="${escapeHtml(b.brand)}">${escapeHtml(b.brand)}<b>${b.count}</b></button>`,
        )
        .join("");
    pickupBrandsLoaded = true;
  } catch {
    /* ignore */
  }
}

async function loadPickups(reset) {
  if (reset) {
    pickupState.offset = 0;
    pickupState.loaded = [];
  }
  const params = new URLSearchParams({
    q: pickupState.q,
    brand: pickupState.brand,
    sort: pickupState.sort,
    reviewed: "1",
    source: "official",
    limit: String(pickupState.limit),
    offset: String(pickupState.offset),
  });
  try {
    const res = await fetch(`${PICKUP_ENDPOINT}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("pickup list failed");
    const data = await res.json();
    pickupState.total = data.total || 0;
    pickupState.loaded = pickupState.loaded.concat(data.items || []);
    pickupState.offset += (data.items || []).length;
    renderPickupStats(data);
    renderPickupGrid();
  } catch {
    document.querySelector("#pickupGrid").innerHTML = "";
    document.querySelector("#pickupEmpty").hidden = false;
    document.querySelector("#pickupEmpty").textContent = "取件表加载失败，请稍后重试。";
  }
}

function renderPickupStats(data) {
  const stats = document.querySelector("#pickupStats");
  const filtering = pickupState.q || pickupState.brand;
  const rows = filtering
    ? [
        [data.total ?? 0, "份匹配"],
        [data.allTotal ?? "—", "份总量"],
      ]
    : [
        [data.allTotal ?? data.total ?? pickupState.total, "份取件表"],
        [data.brandCount ?? "—", "个厂牌"],
      ];
  stats.innerHTML = rows
    .map(([n, label]) => `<div class="pickup-stat"><strong>${escapeHtml(String(n))}</strong><span>${label}</span></div>`)
    .join("");
}

function renderPickupGrid() {
  const grid = document.querySelector("#pickupGrid");
  const items = pickupState.loaded;
  document.querySelector("#pickupEmpty").hidden = items.length > 0;
  grid.innerHTML = items
    .map((it) => {
      const img = it.imageUrl
        ? `<img src="${escapeHtml(displayImageUrl(it.imageUrl, 360))}" alt="${escapeHtml(it.name)}" loading="lazy" onerror="this.remove()" />`
        : `<span class="ph">${escapeHtml(it.brand || "MODEL")}</span>`;
      const sourceBadge =
        it.source === "official"
          ? `<span class="pickup-card-source official">官方源</span>`
          : `<span class="pickup-card-source community">社区</span>`;
      return `
      <div class="pickup-card" data-pid="${escapeHtml(it.id)}">
        <div class="pickup-card-img">${img}${it.brand ? `<span class="pickup-card-brand">${escapeHtml(it.brand)}</span>` : ""}${sourceBadge}</div>
        <div class="pickup-card-body">
          <div class="pickup-card-name">${escapeHtml(it.name)}</div>
          <div class="pickup-card-tags">
            <span class="pickup-tag">${it.sectionCount} 部位</span>
            <span class="pickup-tag">${it.partCount} 颗</span>
            ${it.readCount ? `<span class="pickup-tag hot">${it.readCount} 热度</span>` : ""}
          </div>
          <div class="pickup-card-credit">整理人 ${escapeHtml(pickupCurator(it))}</div>
        </div>
      </div>`;
    })
    .join("");
  const more = document.querySelector("#pickupMore");
  more.hidden = pickupState.loaded.length >= pickupState.total;
  window.lucide?.createIcons?.();
}

async function openPickup(id) {
  try {
    const res = await fetch(`${PICKUP_ENDPOINT}/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not found");
    const { item } = await res.json();
    currentPickup = item;
    pickupView = "section";
    document.querySelectorAll("#pickupViewToggle button").forEach((b) => b.classList.toggle("active", b.dataset.pview === "section"));
    // 恢复进度
    pickupCutSet = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(pickupProgressStorageKey(id)) || "[]");
      if (Array.isArray(saved)) pickupCutSet = new Set(saved);
    } catch {
      /* ignore */
    }
    document.querySelector("#pickupName").textContent = item.name;
    const metaBits = [item.brand, item.spec, `${item.sectionCount} 部位`].filter(Boolean);
    document.querySelector("#pickupMeta").textContent = metaBits.join("  ·  ");
    document.querySelector("#pickupCredit").textContent = `整理人 ${pickupCurator(item)}`;
    const editEntryBtn = document.querySelector("#pickupEditEntry");
    if (editEntryBtn) {
      editEntryBtn.hidden = !isAdmin;
      editEntryBtn.onclick = () => { document.querySelector("#pickupModal").hidden = true; pickupEditExisting(id); };
    }
    const catalogBtn = document.querySelector("#pickupCatalogBtn");
    if (catalogBtn) {
      catalogBtn.hidden = !item.catalogId;
      catalogBtn.onclick = item.catalogId
        ? () => {
            document.querySelector("#pickupModal").hidden = true;
            openCatalogDetail(item.catalogId);
          }
        : null;
    }
    resetPickupFeedbackForm();
    renderPickupBoard();
    document.querySelector("#pickupModal").hidden = false;
  } catch {
    showToast("打开取件表失败");
  }
}

function pickupTotals() {
  let total = 0;
  let cut = 0;
  const parts = currentPickup?.parts || {};
  for (const [section, runners] of Object.entries(parts)) {
    for (const [runner, list] of Object.entries(runners || {})) {
      (list || []).forEach((entry, idx) => {
        const { qty } = pickupParseEntry(entry);
        total += qty;
        if (pickupCutSet.has(pickupCutKey(section, runner, idx))) cut += qty;
      });
    }
  }
  return { total, cut };
}

function renderPickupProgress() {
  const { total, cut } = pickupTotals();
  const pct = total ? Math.round((cut / total) * 100) : 0;
  document.querySelector("#pickupProgressFill").style.width = `${pct}%`;
  document.querySelector("#pickupProgressText").textContent = `已剪 ${cut} / ${total} 颗 · ${pct}%`;
}

function renderPickupBoard() {
  const board = document.querySelector("#pickupBoard");
  const parts = currentPickup?.parts || {};
  if (pickupView === "section") {
    board.innerHTML = Object.entries(parts)
      .map(([section, runners]) => {
        let secTotal = 0;
        let secCut = 0;
        const runnerHtml = Object.entries(runners || {})
          .map(([runner, list]) => {
            const chips = (list || [])
              .map((entry, idx) => {
                const { num, qty } = pickupParseEntry(entry);
                const key = pickupCutKey(section, runner, idx);
                const isCut = pickupCutSet.has(key);
                secTotal += qty;
                if (isCut) secCut += qty;
                return `<span class="pickup-chip${isCut ? " cut" : ""}" data-key="${escapeHtml(key)}">${escapeHtml(num)}${qty > 1 ? `<span class="qty">×${qty}</span>` : ""}</span>`;
              })
              .join("");
            return `<div class="pickup-runner"><span class="pickup-runner-label">${escapeHtml(runner)}</span><div class="pickup-chips">${chips}</div></div>`;
          })
          .join("");
        const done = secTotal > 0 && secCut >= secTotal;
        return `
        <div class="pickup-section${done ? " done" : ""}">
          <div class="pickup-section-head"><h4><span class="dot"></span>${escapeHtml(section)}</h4><span class="cnt">${secCut}/${secTotal} 颗</span></div>
          ${runnerHtml}
        </div>`;
      })
      .join("");
  } else {
    // 按版件：把同一版件字母在所有部位里需要的零件汇总到一起，方便一次性剪完一块版件。
    const byRunner = {};
    for (const [section, runners] of Object.entries(parts)) {
      for (const [runner, list] of Object.entries(runners || {})) {
        if (!byRunner[runner]) byRunner[runner] = [];
        (list || []).forEach((entry, idx) => {
          byRunner[runner].push({ section, entry, key: pickupCutKey(section, runner, idx) });
        });
      }
    }
    board.innerHTML = Object.keys(byRunner)
      .sort()
      .map((runner) => {
        let rTotal = 0;
        let rCut = 0;
        const chips = byRunner[runner]
          .map(({ section, entry, key }) => {
            const { num, qty } = pickupParseEntry(entry);
            const isCut = pickupCutSet.has(key);
            rTotal += qty;
            if (isCut) rCut += qty;
            return `<span class="pickup-chip${isCut ? " cut" : ""}" data-key="${escapeHtml(key)}">${escapeHtml(num)}${qty > 1 ? `<span class="qty">×${qty}</span>` : ""}<span class="sec">${escapeHtml(section)}</span></span>`;
          })
          .join("");
        const done = rTotal > 0 && rCut >= rTotal;
        return `
        <div class="pickup-section${done ? " done" : ""}">
          <div class="pickup-section-head"><h4><span class="dot"></span>版件 ${escapeHtml(runner)}</h4><span class="cnt">${rCut}/${rTotal} 颗</span></div>
          <div class="pickup-runner"><div class="pickup-chips">${chips}</div></div>
        </div>`;
    })
    .join("");
  }
  renderPickupProgress();
}

function savePickupProgress() {
  if (!currentPickup) return;
  try {
    localStorage.setItem(pickupProgressStorageKey(currentPickup.id), JSON.stringify([...pickupCutSet]));
  } catch {
    /* ignore */
  }
}

function closePickupModal() {
  document.querySelector("#pickupModal").hidden = true;
  currentPickup = null;
  resetPickupFeedbackForm();
}

function openPickupUploadModal() {
  const modal = document.querySelector("#pickupUploadModal");
  const form = document.querySelector("#pickupUploadForm");
  if (!modal || !form) return;
  form.reset();
  document.querySelector("#pickupUploadFileName").textContent = "选择 Excel 文件";
  document.querySelector("#pickupUploadHint").innerHTML = `<i data-lucide="shield-check"></i> 只发布审核通过的取件表。`;
  modal.hidden = false;
  window.lucide?.createIcons?.();
}

function closePickupUploadModal() {
  const modal = document.querySelector("#pickupUploadModal");
  if (modal) modal.hidden = true;
}

function readPickupUploadFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("请选择填好的 Excel 文件"));
      return;
    }
    if (!/\.xlsx$/i.test(file.name || "")) {
      reject(new Error("请上传 .xlsx 格式的模板文件"));
      return;
    }
    if (file.size > 900 * 1024) {
      reject(new Error("文件过大，请用模板填写后再上传"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
    };
    reader.onerror = () => reject(new Error("读取文件失败，请重试"));
    reader.readAsDataURL(file);
  });
}

async function submitPickupUpload(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const hint = document.querySelector("#pickupUploadHint");
  const fileInput = document.querySelector("#pickupUploadFile");
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (name.length < 2) {
    showToast("请填写套件名称");
    return;
  }
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span>提交中…</span>`;
  }
  if (hint) hint.textContent = "正在解析并上传取件表…";
  try {
    const fileBase64 = await readPickupUploadFile(fileInput?.files?.[0]);
    const response = await fetch(`${PICKUP_ENDPOINT}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        spec: String(data.get("spec") || "").trim(),
        brand: String(data.get("brand") || "").trim(),
        filename: fileInput.files[0].name || "",
        fileBase64,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "提交失败");
    const sub = result.submission || {};
    showToast(`已提交 ${sub.sectionCount || 0} 部位 · ${sub.partCount || 0} 件，等待审核`);
    closePickupUploadModal();
    if (isAdmin) renderAdminOverview();
  } catch (error) {
    const msg = error.message || "提交失败，请稍后重试";
    if (hint) hint.textContent = msg;
    showToast(msg);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
      window.lucide?.createIcons?.();
    }
  }
}

async function submitPickupFeedback(event) {
  event.preventDefault();
  if (!currentPickup) return;
  const form = event.currentTarget;
  const payload = {
    sectionHint: String(new FormData(form).get("sectionHint") || "").trim(),
    message: String(new FormData(form).get("message") || "").trim(),
  };
  if (payload.message.length < 4) {
    showToast("请写一下具体哪里有问题");
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const response = await fetch(`${PICKUP_ENDPOINT}/${encodeURIComponent(currentPickup.id)}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "feedback failed");
    showToast("反馈已提交，管理员后台会看到");
    resetPickupFeedbackForm();
  } catch {
    showToast("反馈提交失败，请稍后重试");
  } finally {
    if (submit) submit.disabled = false;
  }
}

// ---- 取件台事件绑定 ----
document.querySelector("#pickupGrid")?.addEventListener("click", (e) => {
  const card = e.target.closest(".pickup-card");
  if (card) openPickup(card.dataset.pid);
});
document.querySelector("#pickupMore")?.addEventListener("click", () => loadPickups(false));
document.querySelector("#pickupSearch")?.addEventListener("input", (e) => {
  pickupState.q = e.target.value.trim();
  window.clearTimeout(pickupSearchTimer);
  pickupSearchTimer = window.setTimeout(() => loadPickups(true), 240);
});
document.querySelector("#pickupSort")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]");
  if (!btn) return;
  pickupState.sort = btn.dataset.sort;
  document.querySelectorAll("#pickupSort button").forEach((b) => b.classList.toggle("active", b === btn));
  loadPickups(true);
});
document.querySelector("#pickupBrands")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-brand]");
  if (!btn) return;
  pickupState.brand = btn.dataset.brand;
  document.querySelectorAll("#pickupBrands button").forEach((b) => b.classList.toggle("active", b === btn));
  loadPickups(true);
});
document.querySelector("#pickupBoard")?.addEventListener("click", (e) => {
  const chip = e.target.closest(".pickup-chip");
  if (!chip) return;
  const key = chip.dataset.key;
  if (pickupCutSet.has(key)) pickupCutSet.delete(key);
  else pickupCutSet.add(key);
  savePickupProgress();
  renderPickupBoard();
});
document.querySelector("#pickupViewToggle")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-pview]");
  if (!btn) return;
  pickupView = btn.dataset.pview;
  document.querySelectorAll("#pickupViewToggle button").forEach((b) => b.classList.toggle("active", b === btn));
  renderPickupBoard();
});
document.querySelector("#pickupReset")?.addEventListener("click", () => {
  pickupCutSet = new Set();
  savePickupProgress();
  renderPickupBoard();
  showToast("已重置取件进度");
});
document.querySelector("#pickupFeedbackToggle")?.addEventListener("click", () => {
  const form = document.querySelector("#pickupFeedbackForm");
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) document.querySelector("#pickupFeedbackHint")?.focus();
});
document.querySelector("#pickupFeedbackForm")?.addEventListener("submit", submitPickupFeedback);
document.querySelector("#pickupUploadBtn")?.addEventListener("click", openPickupUploadModal);
document.querySelector("#pickupUploadClose")?.addEventListener("click", closePickupUploadModal);
document.querySelector("#pickupUploadModal")?.addEventListener("click", (e) => {
  if (e.target === document.querySelector("#pickupUploadModal")) closePickupUploadModal();
});
document.querySelector("#pickupUploadFile")?.addEventListener("change", (e) => {
  const file = e.currentTarget.files?.[0];
  document.querySelector("#pickupUploadFileName").textContent = file ? file.name : "选择 Excel 文件";
});
document.querySelector("#pickupUploadForm")?.addEventListener("submit", submitPickupUpload);
document.querySelector("#pickupModalClose")?.addEventListener("click", closePickupModal);
document.querySelector("#pickupModal")?.addEventListener("click", (e) => {
  if (e.target === document.querySelector("#pickupModal")) closePickupModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.querySelector("#pickupModal").hidden) closePickupModal();
  if (e.key === "Escape" && document.querySelector("#pickupUploadModal") && !document.querySelector("#pickupUploadModal").hidden) closePickupUploadModal();
});

/* ===================== 取件表 录入/校对 编辑器（管理员） ===================== */
// 预填草稿：メッサー（已用官方说明书校过 BODY，其余部位留空骨架，对照右侧说明书填）。
const PICKUP_MESSER_DRAFT = {
  manualId: "5119",
  name: "HG 1/144 メッサーM01型（ガウマン机）",
  brand: "万代",
  spec: "HG 1/144",
  imageUrl: "https://bandai-hobby.net/images/2815163.jpg",
  sourceUrl: "https://manual.bandai-hobby.net/menus/detail/5119",
  compiler: "玩物不丧志 · 据万代官方说明书整理",
  parts: {
    "① 躯干 BODY": { A: ["1", "2", "3", "4", "15", "17"], B: ["10", "11"], D: ["1", "5"], F: ["6", "7", "9", "10", "12"], G: ["4"] },
    "② 头部 HEAD": { F: [""], EYE: [""] },
    "③ 手臂 ARMS": { "": [""] },
    "④ 腰部 WAIST": { "": [""] },
    "⑤ 腿部 LEGS": { "": [""] },
    "⑥ 背包 BACKPACK": { "": [""] },
    "⑦ 武器 WEAPONS": { A: ["9", "11"], F: ["4"] },
  },
};

let pickupEditId = "";

function pickupOpenEditor(draft, existingId = "") {
  pickupEditId = existingId;
  document.querySelector("#pickupEditTitle").textContent = existingId ? "校对取件表" : "录入 / 校对取件表";
  document.querySelector("#peName").value = draft.name || "";
  document.querySelector("#peBrand").value = draft.brand || "";
  document.querySelector("#peSpec").value = draft.spec || "";
  document.querySelector("#peImage").value = draft.imageUrl || "";
  document.querySelector("#peSourceUrl").value = draft.sourceUrl || "";
  document.querySelector("#peCompiler").value = draft.compiler || "";
  document.querySelector("#peDelete").hidden = !existingId;
  pickupRenderRefImages(draft.manualId || pickupManualIdFromUrl(draft.sourceUrl));
  pickupRenderPartsEditor(draft.parts || {});
  pickupUpdateEditStat();
  document.querySelector("#pickupEditModal").hidden = false;
}

function pickupManualIdFromUrl(url) {
  const m = String(url || "").match(/detail\/(\d+)/);
  return m ? m[1] : "";
}

async function pickupRenderRefImages(manualId) {
  const box = document.querySelector("#pickupRefImgs");
  if (!manualId) {
    box.innerHTML = `<p class="pickup-ref-empty">没有关联的说明书参考图。<br />（官方源条目会显示对应说明书切片）</p>`;
    return;
  }
  const base = `./assets/manuals/${manualId}`;
  box.innerHTML = `<p class="pickup-ref-empty">正在加载说明书参考图…</p>`;
  try {
    const res = await fetch(`${base}/manifest.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("manifest missing");
    const manifest = await res.json();
    const sideLabel = (s) => (s === "L" ? "左页" : s === "R" ? "右页" : s);
    const pageHtml = (manifest.pages || [])
      .map((page) => `
        <figure class="pickup-ref-figure">
          <figcaption>第 ${page.spread ?? page.page} 跨页 · 整页预览</figcaption>
          <img src="${base}/${escapeHtml(page.preview)}" loading="lazy" data-zoom="${base}/${escapeHtml(page.preview)}" onerror="this.closest('figure').remove()" />
        </figure>`)
      .join("");
    // manifest v3：对半切的左/右完整单页（旧版 tiles 兜底兼容）
    const halfList = (manifest.pages || []).flatMap((page) =>
      (page.halves || page.tiles || []).map((h) => ({
        spread: page.spread ?? page.page,
        file: h.file,
        label: h.side ? `左/右单页 · ${sideLabel(h.side)}` : `识别切片 ${h.tile || ""}`,
      }))
    );
    const halfHtml = halfList
      .map((h) => `
        <figure class="pickup-ref-figure tile">
          <figcaption>第 ${h.spread} 跨页 · ${escapeHtml(h.label)}</figcaption>
          <img src="${base}/${escapeHtml(h.file)}" loading="lazy" data-zoom="${base}/${escapeHtml(h.file)}" onerror="this.closest('figure').remove()" />
        </figure>`)
      .join("");
    box.innerHTML = `
      <div class="pickup-ref-group">
        <p class="pickup-ref-label">整页上下文（对开跨页）</p>
        ${pageHtml || '<p class="pickup-ref-empty">manifest 里没有整页预览。</p>'}
      </div>
      <div class="pickup-ref-group">
        <p class="pickup-ref-label">对半切的完整单页（每页一个完整说明书页，对照填件号）</p>
        ${halfHtml || '<p class="pickup-ref-empty">manifest 里没有单页切片。</p>'}
      </div>`;
    return;
  } catch {
    // 兼容旧切片：assets/manuals/<id>/p{1,2}_c{1..6}.png
    const imgs = [];
    for (let p = 1; p <= 2; p++) for (let c = 1; c <= 6; c++) imgs.push(`${base}/p${p}_c${c}.png`);
    box.innerHTML = imgs
      .map((src) => `<img src="${escapeHtml(src)}" loading="lazy" data-zoom="${escapeHtml(src)}" onerror="this.remove()" />`)
      .join("");
  }
}

function pickupRenderPartsEditor(parts) {
  const box = document.querySelector("#pickupEditParts");
  box.innerHTML = "";
  const entries = Object.entries(parts);
  if (!entries.length) entries.push(["", { "": [""] }]);
  entries.forEach(([section, runners]) => box.appendChild(pickupBuildSection(section, runners)));
}

function pickupBuildSection(section, runners) {
  const card = document.createElement("div");
  card.className = "pe-section";
  const head = document.createElement("div");
  head.className = "pe-section-head";
  head.innerHTML = `<input class="pe-section-name" type="text" placeholder="部位名（如 ① 躯干 BODY）" value="${escapeHtml(section || "")}" />
    <button class="pe-icon-btn pe-del-section" type="button" title="删除部位">✕</button>`;
  card.appendChild(head);
  const rows = document.createElement("div");
  rows.className = "pe-runner-rows";
  card.appendChild(rows);
  const entries = Object.entries(runners || {});
  if (!entries.length) entries.push(["", [""]]);
  entries.forEach(([letter, list]) => rows.appendChild(pickupBuildRunnerRow(letter, list)));
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "pe-add-runner";
  addBtn.textContent = "+ 加版件";
  addBtn.addEventListener("click", () => rows.appendChild(pickupBuildRunnerRow("", [""])));
  card.appendChild(addBtn);
  return card;
}

function pickupBuildRunnerRow(letter, list) {
  const row = document.createElement("div");
  row.className = "pe-runner-row";
  const nums = (Array.isArray(list) ? list : []).filter(Boolean).join(", ");
  row.innerHTML = `<input class="pe-letter" type="text" maxlength="3" placeholder="版件" value="${escapeHtml(letter || "")}" />
    <input class="pe-nums" type="text" placeholder="件号，逗号分隔；×2 写 3*2" value="${escapeHtml(nums)}" />
    <button class="pe-icon-btn pe-del-row" type="button" title="删除这行">✕</button>`;
  row.querySelector(".pe-nums").addEventListener("input", pickupUpdateEditStat);
  return row;
}

function pickupCollectEditor() {
  const parts = {};
  document.querySelectorAll("#pickupEditParts .pe-section").forEach((card) => {
    const section = card.querySelector(".pe-section-name").value.trim();
    if (!section) return;
    const runners = {};
    card.querySelectorAll(".pe-runner-row").forEach((row) => {
      const letter = row.querySelector(".pe-letter").value.trim().toUpperCase();
      const nums = row.querySelector(".pe-nums").value.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
      if (letter && nums.length) runners[letter] = nums;
    });
    if (Object.keys(runners).length) parts[section] = runners;
  });
  return {
    id: pickupEditId || undefined,
    name: document.querySelector("#peName").value.trim(),
    brand: document.querySelector("#peBrand").value.trim(),
    spec: document.querySelector("#peSpec").value.trim(),
    imageUrl: document.querySelector("#peImage").value.trim(),
    sourceUrl: document.querySelector("#peSourceUrl").value.trim(),
    compiler: document.querySelector("#peCompiler").value.trim(),
    source: "official",
    parts,
  };
}

function pickupUpdateEditStat() {
  const data = pickupCollectEditor();
  let pieces = 0;
  let sections = 0;
  for (const runners of Object.values(data.parts)) {
    sections += 1;
    for (const list of Object.values(runners)) {
      for (const e of list) {
        const m = String(e).split("*");
        pieces += m.length > 1 ? parseInt(m[1], 10) || 1 : 1;
      }
    }
  }
  document.querySelector("#peStat").textContent = `${sections} 部位 · ${pieces} 颗`;
}

async function pickupSaveEntry() {
  const data = pickupCollectEditor();
  if (!data.name) { showToast("请填名称"); return; }
  if (!Object.keys(data.parts).length) { showToast("至少填一个部位的件号"); return; }
  try {
    const res = await fetch(PICKUP_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("save failed");
    document.querySelector("#pickupEditModal").hidden = true;
    showToast(pickupEditId ? "已更新取件表" : "已保存官方源取件表");
    pickupBrandsLoaded = false;
    await renderPickup();
  } catch {
    showToast("保存失败，请重试");
  }
}

async function pickupEditExisting(id) {
  try {
    const res = await fetch(`${PICKUP_ENDPOINT}/${encodeURIComponent(id)}?edit=1`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const { item } = await res.json();
    pickupOpenEditor({ ...item, manualId: pickupManualIdFromUrl(item.sourceUrl) }, id);
  } catch {
    showToast("加载失败");
  }
}

// ---- 编辑器事件 ----
document.querySelector("#pickupNewBtn")?.addEventListener("click", () => pickupOpenEditor(PICKUP_MESSER_DRAFT, ""));
document.querySelector("#pickupEditClose")?.addEventListener("click", () => (document.querySelector("#pickupEditModal").hidden = true));
document.querySelector("#pickupEditModal")?.addEventListener("click", (e) => {
  if (e.target === document.querySelector("#pickupEditModal")) document.querySelector("#pickupEditModal").hidden = true;
});
document.querySelector("#peAddSection")?.addEventListener("click", () => {
  document.querySelector("#pickupEditParts").appendChild(pickupBuildSection("", { "": [""] }));
});
document.querySelector("#pickupEditParts")?.addEventListener("click", (e) => {
  if (e.target.closest(".pe-del-section")) { e.target.closest(".pe-section").remove(); pickupUpdateEditStat(); }
  else if (e.target.closest(".pe-del-row")) { e.target.closest(".pe-runner-row").remove(); pickupUpdateEditStat(); }
});
document.querySelector("#peSave")?.addEventListener("click", pickupSaveEntry);
document.querySelector("#peDelete")?.addEventListener("click", async () => {
  if (!pickupEditId) return;
  const ok = await confirmDialog("确定删除这条取件表？删除后无法撤销。", { title: "删除取件表", confirmText: "删除", danger: true });
  if (!ok) return;
  await fetch(`${PICKUP_ENDPOINT}/${encodeURIComponent(pickupEditId)}`, { method: "DELETE" });
  document.querySelector("#pickupEditModal").hidden = true;
  showToast("已删除");
  pickupBrandsLoaded = false;
  await renderPickup();
});
// 参考图放大
document.querySelector("#pickupRefImgs")?.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-zoom]");
  if (!img) return;
  document.querySelector("#pickupZoomImg").src = img.dataset.zoom;
  document.querySelector("#pickupZoom").hidden = false;
});
document.querySelector("#pickupZoom")?.addEventListener("click", () => (document.querySelector("#pickupZoom").hidden = true));
// 管理员在详情弹窗里点标题可进入校对（官方源）
