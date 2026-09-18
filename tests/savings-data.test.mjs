import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../mini program/data-utils.js");
const { monthlyExpenseTotal, normalizeSavingsData, savingsActualDelta, savingsLedgerBalance } = globalThis.MiniProgramData;

test("selected month expenses are summed for the savings estimate", () => {
  assert.equal(monthlyExpenseTotal([
    { date: "2026-09-02", amount: 120.5 },
    { date: "2026-09-19", amount: 300 },
    { date: "2026-08-31", amount: 999 },
  ], "2026-09"), 420.5);
});

test("editing actual savings applies only the difference", () => {
  assert.equal(savingsActualDelta(null, 10000), 10000);
  assert.equal(savingsActualDelta(10000, 9200), -800);
  assert.equal(savingsActualDelta(9200, 9200), 0);
});

test("savings records retain confirmation and optional notes", () => {
  const normalized = normalizeSavingsData({
    currentBalance: "128600",
    months: {
      "2026-09": { salary: "18920", actual: "10000", note: "  奖金另存  ", confirmed: true },
      invalid: { salary: 1 },
    },
    logs: [],
  });
  assert.equal(normalized.currentBalance, 128600);
  assert.deepEqual(normalized.months["2026-09"], {
    salary: 18920,
    actual: 10000,
    note: "奖金另存",
    confirmed: true,
    confirmedAt: "",
  });
  assert.equal(normalized.transactions.length, 1);
  assert.equal(normalized.transactions[0].type, "opening_balance");
  assert.equal(normalized.transactions[0].amount, 128600);
  assert.equal(Object.hasOwn(normalized.months, "invalid"), false);
});

test("ledger transactions are the source of truth and duplicate operations are ignored", () => {
  const normalized = normalizeSavingsData({
    currentBalance: 999999,
    months: {},
    logs: [],
    transactions: [
      { id: "opening", operationId: "opening", type: "opening_balance", amount: 100000 },
      { id: "month", operationId: "month", type: "monthly_saving", amount: 10000, month: "2026-09" },
      { id: "edit", operationId: "edit", type: "monthly_adjustment", amount: -200, month: "2026-09" },
      { id: "duplicate", operationId: "edit", type: "monthly_adjustment", amount: -200, month: "2026-09" },
    ],
  });
  assert.equal(normalized.transactions.length, 3);
  assert.equal(normalized.currentBalance, 109800);
  assert.equal(savingsLedgerBalance(normalized.transactions), 109800);
});

test("savings navigation and locked editing UI are wired into the mini program", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../mini program/index.html", import.meta.url), "utf8"),
    readFile(new URL("../mini program/app.js", import.meta.url), "utf8"),
    readFile(new URL("../mini program/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-route="collection"[\s\S]*data-route="savings"[\s\S]*data-route="profile"/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, 1fr\)/);
  assert.match(source, /id="savingsNote"/);
  assert.match(source, /id="savingsEditDialog"/);
  assert.match(source, /\$\{profileSavingsCard\(\)\}[\s\S]*收藏画像/);
  assert.match(source, /log\.note \? `<div class="savings-log-note">/);
  assert.match(source, /data-savings-record-view="ledger"/);
  assert.match(source, /data-savings-record-view="log"/);
  assert.match(source, /state\.savings\.transactions\.push/);
  assert.match(css, /\.savings-record-tabs/);
  assert.match(css, /\.savings-transaction-item/);
});
