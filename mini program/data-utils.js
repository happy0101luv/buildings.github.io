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
    return (Array.isArray(records) ? records : []).reduce((summary, record) => {
      const parsedQuantity = Math.floor(Number(record?.quantity || 1));
      const itemQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
      const due = collectionDueAmount(record);
      summary.totalCount += itemQuantity;
      summary.totalPaid += collectionPaidAmount(record);
      summary.totalDue += due;
      if (collectionPreorderStage(record) === "payment") summary.paymentPendingCount += 1;
      if (collectionPreorderStage(record) === "arrival") summary.arrivalPendingCount += 1;
      return summary;
    }, { totalCount: 0, totalPaid: 0, totalDue: 0, paymentPendingCount: 0, arrivalPendingCount: 0 });
  }

  function collectionScopeLabel(status, category) {
    const statusLabel = status === "全部" ? "" : String(status || "").trim();
    const categoryLabel = category === "全部分类" ? "" : String(category || "").trim();
    return `${[statusLabel, categoryLabel].filter(Boolean).join(" · ") || "全部"}收藏投入`;
  }

  globalScope.MiniProgramData = {
    collectionScopeLabel,
    filterCollectionRecords,
    collectionPreorderStage,
    ensureCategoryConfig,
    mergeCategoryConfigs,
    mergeRecords,
    matchesCollectionStatus,
    moveCategoryConfig,
    normalizeCategoryConfig,
    recordFingerprint,
    summarizeCollectionRecords,
    toggleCategoryVisibility,
  };
})(typeof window === "undefined" ? globalThis : window);
