import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../mini program/data-utils.js");
const { monthlyExpenseTotal, normalizeSavingsData, savingsActualDelta } = globalThis.MiniProgramData;

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
  assert.equal(Object.hasOwn(normalized.months, "invalid"), false);
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
});
