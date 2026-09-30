import { strict as assert } from "node:assert";
import { test } from "node:test";
import { holdsLeveraged, isLeveragedKind } from "../src/lib/leverage.ts";

// The five funds the backend's curated registry marks, and the kinds the rest
// of Ondo's universe actually carries.
const LEVERAGED = ["Leveraged ETF", "Inverse ETF"];
const ORDINARY = ["Common Stock", "Equity ETF", "Bond ETF", "Commodity ETF", "ADR", "Crypto ETF", "Preferred Stock", "Currency", "Closed-End Fund"];

test("the geared kinds are the only geared kinds", () => {
  for (const kind of LEVERAGED) assert.equal(isLeveragedKind(kind), true, kind);
  for (const kind of ORDINARY) assert.equal(isLeveragedKind(kind), false, kind);
});

test("a strategy is geared if any one of its holdings is", () => {
  const plain = [{ kind: "Common Stock" }, { kind: "Equity ETF" }];
  assert.equal(holdsLeveraged(plain), false);
  assert.equal(holdsLeveraged([...plain, { kind: "Inverse ETF" }]), true);
  assert.equal(holdsLeveraged([]), false);
});

test("capitalisation cannot change the answer, on either side of the API", () => {
  for (const kind of ["leveraged etf", "LEVERAGED ETF", "Inverse Equity ETF", "inverse etf"]) {
    assert.equal(isLeveragedKind(kind), true, kind);
  }
});
