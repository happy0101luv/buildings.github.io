import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../mini program/data-utils.js");
const { collectionScopeLabel, filterCollectionRecords, mergeCategoryConfigs, mergeRecords, normalizeCategoryConfig, summarizeCollectionRecords } = globalThis.MiniProgramData;

function collection(overrides = {}) {
  return {
    id: "same-id",
    name: "RX-78 高达",
    category: "高达模型",
    series: "BANDAI / MG",
    status: "已入库",
    quantity: 1,
    price: 300,
    paid: 300,
    date: "2026-08-01",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("cross-device collection import adds missing rows and skips duplicates", () => {
  const local = [collection()];
  const incoming = [
    collection(),
    collection({ id: "new-id", name: "沙扎比", price: 680, paid: 680 }),
  ];
  const result = mergeRecords(local, incoming, "collection");
  assert.equal(result.records.length, 2);
  assert.deepEqual({ added: result.added, updated: result.updated, duplicates: result.duplicates }, { added: 1, updated: 0, duplicates: 1 });
});

test("same record id keeps the newest device edit without double counting", () => {
  const result = mergeRecords(
    [collection({ note: "本机旧备注" })],
    [collection({ category: "经典高达", note: "A 设备新备注", updatedAt: "2026-09-01T00:00:00.000Z" })],
    "collection",
  );
  assert.equal(result.records.length, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.records[0].category, "经典高达");
  assert.equal(result.records[0].note, "A 设备新备注");
});

test("identical legacy rows with different ids are recognized by content", () => {
  const legacy = collection({ id: "legacy-a", price: undefined, totalPrice: 300 });
  const current = collection({ id: "current-b" });
  const result = mergeRecords([current], [legacy], "collection");
  assert.equal(result.records.length, 1);
  assert.equal(result.duplicates, 1);
});

test("imported and record-derived categories are retained in the manager", () => {
  const config = mergeCategoryConfigs(
    [{ name: "高达模型", hidden: true }, { name: "兵人/人偶", hidden: false }],
    [{ name: "雕像", hidden: false }],
    [collection({ category: "特摄" })],
    ["高达模型", "机娘", "兵人/人偶", "变形金刚", "其他"],
  );
  assert.equal(config[0].name, "高达模型");
  assert.equal(config[0].hidden, true);
  assert.ok(config.some((item) => item.name === "雕像"));
  assert.ok(config.some((item) => item.name === "特摄"));
});

test("saved category order and visibility survive normalization", () => {
  const config = normalizeCategoryConfig(
    [{ name: "变形金刚", hidden: false }, { name: "高达模型", hidden: true }],
    [],
    ["高达模型", "机娘", "兵人/人偶", "变形金刚", "其他"],
  );
  assert.deepEqual(config.slice(0, 2), [
    { name: "变形金刚", hidden: false },
    { name: "高达模型", hidden: true },
  ]);
});

test("one status and one category combine into an intersection", () => {
  const records = [
    collection({ id: "stored-gundam", name: "自由高达", category: "高达模型", price: 500, paid: 500 }),
    collection({ id: "due-gundam", name: "沙扎比", category: "高达模型", status: "预定中", price: 900, paid: 200 }),
    collection({ id: "arrival-figure", name: "蝙蝠侠", category: "兵人/人偶", status: "预定中", price: 600, paid: 600, preorderStage: "arrival" }),
  ];

  const single = filterCollectionRecords(records, { statuses: ["待补款"], categories: [] });
  assert.deepEqual(single.map((item) => item.id), ["due-gundam"]);

  const combined = filterCollectionRecords(records, {
    statuses: ["待补款"],
    categories: ["高达模型"],
  });
  assert.deepEqual(combined.map((item) => item.id), ["due-gundam"]);
});

test("investment values are summarized from the combined row filters", () => {
  const records = [
    collection({ id: "due", status: "预定中", quantity: 2, price: 900, paid: 200 }),
    collection({ id: "arrival", category: "兵人/人偶", status: "预定中", price: 600, paid: 600, preorderStage: "arrival" }),
  ];
  assert.deepEqual(summarizeCollectionRecords(records), {
    totalCount: 3,
    totalPaid: 800,
    totalDue: 700,
    paymentPendingCount: 1,
    arrivalPendingCount: 1,
  });
});

test("investment pill follows default, single-row, and combined selections", () => {
  assert.equal(collectionScopeLabel("全部", "全部分类"), "全部收藏投入");
  assert.equal(collectionScopeLabel("待补款", "全部分类"), "待补款收藏投入");
  assert.equal(collectionScopeLabel("全部", "高达模型"), "高达模型收藏投入");
  assert.equal(collectionScopeLabel("待补款", "高达模型"), "待补款 · 高达模型收藏投入");
});

test("empty collection state clears search and resets both filter rows", async () => {
  const source = await readFile(new URL("../mini program/app.js", import.meta.url), "utf8");
  assert.match(source, /id=\"clearCollectionFilters\"/);
  assert.match(source, /state\.collectionSearch = \"\";\s+state\.collectionSearchDraft = \"\";\s+state\.collectionStatus = \"全部\";\s+state\.collectionCategory = \"全部分类\";/);
});
