import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  activeFilterCount, applyFilters, clearFilters, DEFAULT_FILTERS, isFiltered, parseFilters, toggle,
  type CatalogueFilters,
} from "../src/lib/catalogueFilters.ts";

const parse = (search: string) => parseFilters(new URLSearchParams(search));
const write = (f: CatalogueFilters, search = "") => applyFilters(new URLSearchParams(search), f).toString();

test("a bare /strategies is the default view", () => {
  assert.deepEqual(parse(""), DEFAULT_FILTERS);
  assert.equal(isFiltered(DEFAULT_FILTERS), false);
  assert.equal(activeFilterCount(DEFAULT_FILTERS), 0);
});

test("defaults are left out of the URL, so the clean link stays clean", () => {
  assert.equal(write(DEFAULT_FILTERS), "");
  assert.equal(write({ ...DEFAULT_FILTERS, period: "5y" }), "period=5y");
  assert.equal(write({ ...DEFAULT_FILTERS, beatsBenchmark: true }), "beats=1");
  assert.equal(write({ ...DEFAULT_FILTERS, leveraged: true }), "leveraged=1");
});

test("filters survive a round trip through the URL", () => {
  const filters: CatalogueFilters = {
    period: "5y", sort: "newest", assets: ["NVDA", "AAPL"],
    cadence: ["weekly", "daily"], beatsBenchmark: true, leveraged: true,
  };
  assert.deepEqual(parse(write(filters)), {
    ...filters,
    assets: ["AAPL", "NVDA"],   // canonical
    cadence: ["daily", "weekly"],
  });
});

test("lists are canonical, so the same filters are always the same request", () => {
  assert.equal(write({ ...DEFAULT_FILTERS, assets: ["NVDA", "AAPL"] }), write({ ...DEFAULT_FILTERS, assets: ["AAPL", "NVDA"] }));
  assert.deepEqual(parse("assets=NVDA,AAPL,NVDA").assets, ["AAPL", "NVDA"]);
  assert.deepEqual(parse("assets=nvda").assets, ["NVDA"]);
});

test("a hand-edited URL cannot produce a request the API would reject", () => {
  // 10y is a real backtest range, but the backend does not keep it warm for
  // every strategy, so the list may not ask for it.
  assert.equal(parse("period=10y").period, "1y");
  assert.equal(parse("period=2y").period, "1y");
  assert.equal(parse("period=3y").period, "3y");
  assert.equal(parse("sort=cheapest").sort, "return");
  assert.deepEqual(parse("cadence=fortnightly,daily").cadence, ["daily"]);
  assert.deepEqual(parse("assets=,,").assets, []);
  assert.equal(parse("beats=yes").beatsBenchmark, false);
});

test("keys this page does not own are left alone", () => {
  assert.match(write({ ...DEFAULT_FILTERS, period: "5y" }, "ref=twitter"), /ref=twitter/);
});

test("clearing keeps the period and the order the reader chose", () => {
  const filters: CatalogueFilters = { ...DEFAULT_FILTERS, period: "5y", sort: "newest", assets: ["NVDA"], beatsBenchmark: true };
  assert.deepEqual(clearFilters(filters), { ...DEFAULT_FILTERS, period: "5y", sort: "newest" });
});

test("the count is what is narrowing the list, not the period or the order", () => {
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, period: "5y", sort: "newest" }), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, assets: ["NVDA", "AAPL"], cadence: ["daily"], beatsBenchmark: true }), 4);
});

test("toggling adds then removes", () => {
  assert.deepEqual(toggle<string>([], "NVDA"), ["NVDA"]);
  assert.deepEqual(toggle(["NVDA", "AAPL"], "NVDA"), ["AAPL"]);
});
