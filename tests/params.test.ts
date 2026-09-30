import { strict as assert } from "node:assert";
import { test } from "node:test";
import { coerceParams, paramsSearch } from "../src/lib/params.ts";
import type { Template } from "../src/api/client.ts";

const published = (value = 0): Template => ({ publishedAt: "2026-09-13T00:00:00Z", params: [{ key: "threshold", min: -2, max: 2, step: 0.1, default: value }] }) as Template;
for (const [input, expected] of [["-.05", -.1], [".05", .1], ["-.15", -.1], [".3", .3]] as const) {
  test(`published threshold ${input} snaps like the backend`, () => assert.equal(coerceParams(published(), () => input).threshold, expected));
}
test("published grids are anchored at their actual rule default", () => {
  assert.equal(coerceParams(published(.05), () => "0").threshold, -.05);
});
test("a high precision default remains identical to the published rule", () => {
  const value = Number("0.12345678901234567");
  assert.equal(coerceParams(published(value), () => String(value)).threshold, value);
  assert.equal(paramsSearch(published(value), {threshold: value}), "");
});
test("missing and invalid query values select defaults and bounds are enforced", () => {
  for (const input of [undefined, "", "NaN", "Infinity"]) assert.equal(coerceParams(published(.1), () => input).threshold, .1);
  assert.equal(coerceParams(published(), () => "100").threshold, 2);
  assert.equal(coerceParams(published(), () => "-100").threshold, -2);
});
test("built-in grids retain the existing zero anchor", () => {
  const t = { params: [{key: "lookback", min: 21, max: 252, step: 7, default: 63}] } as Template;
  assert.equal(coerceParams(t, () => "66.5").lookback, 70);
});
