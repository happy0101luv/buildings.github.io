(function exposeMiniProgramData(globalScope) {
  "use strict";

  function normalizedText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
  }

  function recordFingerprint(record, type = "collection") {
    if (type === "life") {
      return ["name", "category", "amount", "date", "note"]
        .map((field) => normalizedText(record?.[field]))
        .join("\u001f");
    }
    return [
      record?.name,
      record?.category,
      record?.series,
      record?.status,
      record?.quantity || 1,
      record?.pricePending ? "price-pending" : "price-known",
      record?.price ?? record?.totalPrice ?? 0,
      record?.paid ?? 0,
      record?.soldPrice ?? "",
      record?.date,
      record?.expectedMode,
      record?.expectedDate,
      record?.expectedQuarter,
    ].map(normalizedText).join("\u001f");
  }

  function updatedTime(record) {
    const value = Date.parse(record?.updatedAt || record?.createdAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function fillMissingFields(primary, secondary) {
    const merged = { ...secondary, ...primary };
    for (const [key, value] of Object.entries(secondary || {})) {
      if ((merged[key] === "" || merged[key] == null) && value !== "" && value != null) merged[key] = value;
    }
    return merged;
  }

  function mergeRecords(existingRecords, incomingRecords, type = "collection") {
    const merged = (existingRecords || []).map((record) => ({ ...record }));
    const idIndex = new Map(merged.map((record, index) => [String(record.id), index]));
    const fingerprintIndex = new Map(merged.map((record, index) => [recordFingerprint(record, type), index]));
    const summary = { added: 0, updated: 0, duplicates: 0 };

    for (const incoming of incomingRecords || []) {
      const next = { ...incoming };
      const idKey = String(next.id);
      const fingerprint = recordFingerprint(next, type);
      const existingIndex = idIndex.get(idKey);
      const semanticIndex = fingerprintIndex.get(fingerprint);

      if (existingIndex == null && semanticIndex == null) {
        const index = merged.push(next) - 1;
        idIndex.set(idKey, index);
        fingerprintIndex.set(fingerprint, index);
        summary.added += 1;
        continue;
      }

      const index = existingIndex ?? semanticIndex;
      const current = merged[index];
      if (existingIndex != null && updatedTime(next) > updatedTime(current)) {
        const oldFingerprint = recordFingerprint(current, type);
        merged[index] = fillMissingFields(next, current);
        fingerprintIndex.delete(oldFingerprint);
        fingerprintIndex.set(recordFingerprint(merged[index], type), index);
        summary.updated += 1;
      } else {
        merged[index] = fillMissingFields(current, next);
        summary.duplicates += 1;
      }
      idIndex.set(String(merged[index].id), index);
    }

    return { records: merged, ...summary };
  }

  function normalizeCategoryConfig(source, records, defaults) {
    const result = [];
    const indexByName = new Map();
    const add = (entry, fallbackHidden = false) => {
      const name = String(typeof entry === "string" ? entry : entry?.name || "").trim().replace(/\s+/g, " ");
      const key = normalizedText(name.normalize("NFKC"));
      if (!name || key === normalizedText("全部分类")) return;
      const hidden = typeof entry === "object" && entry !== null ? Boolean(entry.hidden) : fallbackHidden;
      if (indexByName.has(key)) return;
      indexByName.set(key, result.length);
      result.push({ name, hidden });
    };

    (Array.isArray(source) ? source : []).forEach((entry) => add(entry));
    (Array.isArray(defaults) ? defaults : []).forEach((entry) => add(entry));
    (Array.isArray(records) ? records : []).forEach((record) => add(record?.category));
    return result;
  }

  function ensureCategoryConfig(source, requestedName) {
    const categories = normalizeCategoryConfig(source, [], []);
    const name = String(requestedName || "").trim().replace(/\s+/g, " ");
    const key = normalizedText(name.normalize("NFKC"));
    if (!name || key === normalizedText("全部分类")) {
      return { categories, added: false, name: "" };
    }

    const existing = categories.find((category) => normalizedText(category.name.normalize("NFKC")) === key);
    if (existing) return { categories, added: false, name: existing.name };

    categories.push({ name, hidden: false });
    return { categories, added: true, name };
  }

  function moveCategoryConfig(source, requestedIndex, requestedOffset) {
    const categories = normalizeCategoryConfig(source, [], []);
    const from = Number(requestedIndex);
    const offset = Number(requestedOffset);
    const to = from + offset;
    if (!Number.isInteger(from) || !Number.isInteger(offset) || Math.abs(offset) !== 1 || to < 0 || to >= categories.length) {
      return categories;
    }
    [categories[from], categories[to]] = [categories[to], categories[from]];
    return categories;
  }

  function toggleCategoryVisibility(source, requestedIndex) {
    const categories = normalizeCategoryConfig(source, [], []);
    const index = Number(requestedIndex);
    if (!Number.isInteger(index) || index < 0 || index >= categories.length) {
      return { categories, category: null, hidden: false };
    }
    categories[index] = { ...categories[index], hidden: !categories[index].hidden };
    return { categories, category: categories[index], hidden: categories[index].hidden };
  }

  function mergeCategoryConfigs(currentConfig, importedConfig, records, defaults) {
    const current = normalizeCategoryConfig(currentConfig, [], defaults);
    const known = new Set(current.map((entry) => entry.name));
    const imported = normalizeCategoryConfig(importedConfig, records, []);
    return [
      ...current,
      ...imported.filter((entry) => !known.has(entry.name)),
    ];
  }

  function collectionPaidAmount(record) {
    const paid = Number(record?.paid);
    if (Number.isFinite(paid)) return paid;
    const price = Number(record?.price ?? record?.totalPrice ?? 0);
    return ["已入库", "已卖出"].includes(record?.status) && Number.isFinite(price) ? price : 0;
  }

  function collectionDueAmount(record) {
    if (record?.status !== "预定中" || record?.pricePending) return 0;
    const price = Number(record?.price ?? record?.totalPrice ?? 0);
    return Math.max(0, (Number.isFinite(price) ? price : 0) - collectionPaidAmount(record));
  }

  function collectionPreorderStage(record) {
    if (record?.status !== "预定中") return "";
    const explicit = String(record?.preorderStage || "").trim();
    if (["payment", "payment_pending"].includes(explicit)) return "payment";
    if (["arrival", "arrival_pending"].includes(explicit)) return "arrival";
    if (record?.pricePending) return "payment";
    return collectionDueAmount(record) > 0 ? "payment" : "arrival";
  }

  function matchesCollectionStatus(record, statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return true;
    return statuses.some((status) => {
      if (status === "已入库") return record?.status === "已入库";
      if (status === "已卖出") return record?.status === "已卖出";
      if (status === "待补款") return collectionPreorderStage(record) === "payment";
      if (status === "待到货") return collectionPreorderStage(record) === "arrival";
      return false;
    });
  }

  function filterCollectionRecords(records, options = {}) {
    const statuses = Array.isArray(options.statuses) ? options.statuses : [];
    const categories = Array.isArray(options.categories) ? options.categories : [];
    const search = normalizedText(options.search);
    return (Array.isArray(records) ? records : []).filter((record) => {
      const matchesStatus = matchesCollectionStatus(record, statuses);
      const matchesCategory = categories.length === 0 || categories.includes(record?.category);
      const haystack = normalizedText(`${record?.name || ""} ${record?.series || ""} ${record?.category || ""} ${record?.note || ""}`);
      return matchesStatus && matchesCategory && (!search || haystack.includes(search));
    });
  }

  function summarizeCollectionRecords(records) {
    const summary = (Array.isArray(records) ? records : []).reduce((result, record) => {
      const parsedQuantity = Math.floor(Number(record?.quantity || 1));
      const itemQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
      const paid = collectionPaidAmount(record);
      const due = collectionDueAmount(record);
      result.totalCount += itemQuantity;
      result.totalPaid += paid;
      result.totalDue += due;
      if (record?.status === "已卖出") {
        const cost = Number(record?.price ?? record?.totalPrice ?? paid);
        const revenue = Number(record?.soldPrice ?? 0);
        const safeCost = Number.isFinite(cost) ? cost : paid;
        const safeRevenue = Number.isFinite(revenue) ? revenue : 0;
        result.soldCount += itemQuantity;
        result.soldCost += safeCost;
        result.soldRevenue += safeRevenue;
        result.realizedProfit += safeRevenue - safeCost;
      } else {
        result.currentInvestment += paid;
      }
      if (collectionPreorderStage(record) === "payment") result.paymentPendingCount += 1;
      if (collectionPreorderStage(record) === "arrival") result.arrivalPendingCount += 1;
      return result;
    }, {
      totalCount: 0,
      totalPaid: 0,
      totalDue: 0,
      currentInvestment: 0,
      soldCount: 0,
      soldCost: 0,
      soldRevenue: 0,
      realizedProfit: 0,
      paymentPendingCount: 0,
      arrivalPendingCount: 0,
    });
    summary.netInvestment = summary.currentInvestment - summary.realizedProfit;
    return summary;
  }

  function collectionScopeLabel(status, category) {
    const statusLabel = status === "全部" ? "" : String(status || "").trim();
    const categoryLabel = category === "全部分类" ? "" : String(category || "").trim();
    const scope = [statusLabel, categoryLabel].filter(Boolean).join(" · ") || "全部";
    return `${scope}收藏${status === "已卖出" ? "盈亏" : "净投入"}`;
  }

  function currentMonthKey(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }

  function savingsLedgerBalance(transactions) {
    return (Array.isArray(transactions) ? transactions : []).reduce((sum, transaction) => {
      const amount = Number(transaction?.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  function normalizeSavingsData(source) {
    const raw = source && typeof source === "object" ? source : {};
    const legacyCurrentBalance = Number(raw.currentBalance);
    const months = {};
    for (const [month, entry] of Object.entries(raw.months || {})) {
      if (!/^\d{4}-\d{2}$/.test(month) || !entry || typeof entry !== "object") continue;
      const salary = entry.salary === "" || entry.salary == null ? null : Number(entry.salary);
      const actual = entry.actual === "" || entry.actual == null ? null : Number(entry.actual);
      months[month] = {
        salary: Number.isFinite(salary) ? salary : null,
        actual: Number.isFinite(actual) ? actual : null,
        note: String(entry.note || "").trim().slice(0, 60),
        confirmed: typeof entry.confirmed === "boolean" ? entry.confirmed : Number.isFinite(actual),
        confirmedAt: entry.confirmedAt || "",
      };
    }
    const logs = (Array.isArray(raw.logs) ? raw.logs : []).filter((log) => log && typeof log === "object").map((log) => {
      const balanceAfter = Number(log.balanceAfter ?? log.balance);
      const balanceBefore = log.balanceBefore == null ? null : Number(log.balanceBefore);
      return {
        id: String(log.id || `savings-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        type: ["month", "edit", "manual"].includes(log.type) ? log.type : "month",
        month: /^\d{4}-\d{2}$/.test(String(log.month || "")) ? String(log.month) : "",
        title: String(log.title || "储蓄记录"),
        estimated: log.estimated == null || !Number.isFinite(Number(log.estimated)) ? null : Number(log.estimated),
        actual: log.actual == null || !Number.isFinite(Number(log.actual)) ? null : Number(log.actual),
        balance: Number.isFinite(balanceAfter) ? balanceAfter : 0,
        balanceBefore: Number.isFinite(balanceBefore) ? balanceBefore : null,
        balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : 0,
        note: String(log.note || "").trim().slice(0, 60),
        createdAt: log.createdAt || new Date().toISOString(),
      };
    });

    const transactions = [];
    const seenIds = new Set();
    const seenOperations = new Set();
    for (const transaction of Array.isArray(raw.transactions) ? raw.transactions : []) {
      if (!transaction || typeof transaction !== "object") continue;
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const id = String(transaction.id || `transaction-${Date.now()}-${transactions.length}`);
      const operationId = String(transaction.operationId || id);
      if (seenIds.has(id) || seenOperations.has(operationId)) continue;
      seenIds.add(id);
      seenOperations.add(operationId);
      transactions.push({
        id,
        operationId,
        type: ["opening_balance", "monthly_saving", "monthly_adjustment", "manual_increase", "manual_decrease", "reversal"].includes(transaction.type) ? transaction.type : "manual_increase",
        month: /^\d{4}-\d{2}$/.test(String(transaction.month || "")) ? String(transaction.month) : "",
        title: String(transaction.title || "储蓄变动"),
        amount,
        note: String(transaction.note || "").trim().slice(0, 60),
        createdAt: transaction.createdAt || new Date().toISOString(),
      });
    }

    if (!Array.isArray(raw.transactions) && Number.isFinite(legacyCurrentBalance) && legacyCurrentBalance !== 0) {
      transactions.push({
        id: "legacy-opening-balance",
        operationId: "legacy-opening-balance",
        type: "opening_balance",
        month: "",
        title: "期初存款",
        amount: legacyCurrentBalance,
        note: "由原有当前存款自动迁移",
        createdAt: logs[logs.length - 1]?.createdAt || new Date().toISOString(),
      });
    }

    const currentBalance = savingsLedgerBalance(transactions);
    return {
      currentBalance,
      months,
      transactions,
      logs,
    };
  }

  function savingsActualDelta(previousActual, nextActual) {
    const previous = previousActual == null || previousActual === "" ? 0 : Number(previousActual);
    const next = nextActual == null || nextActual === "" ? 0 : Number(nextActual);
    return (Number.isFinite(next) ? next : 0) - (Number.isFinite(previous) ? previous : 0);
  }

  function monthlyExpenseTotal(expenses, month) {
    return (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => {
      if (String(expense?.date || "").slice(0, 7) !== month) return sum;
      const amount = Number(expense?.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  globalScope.MiniProgramData = {
    collectionScopeLabel,
    currentMonthKey,
    filterCollectionRecords,
    collectionPreorderStage,
    ensureCategoryConfig,
    mergeCategoryConfigs,
    mergeRecords,
    monthlyExpenseTotal,
    matchesCollectionStatus,
    moveCategoryConfig,
    normalizeCategoryConfig,
    normalizeSavingsData,
    recordFingerprint,
    summarizeCollectionRecords,
    savingsActualDelta,
    savingsLedgerBalance,
    toggleCategoryVisibility,
  };
})(typeof window === "undefined" ? globalThis : window);
