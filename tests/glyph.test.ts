import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generatedMarkIndex, hashId } from "../src/lib/glyph.ts";

const COUNT = 12;
// The three strategies published from Studio, as the API lists them today.
const published = [
  "studio-94aa87c2ca5503ad3a8acc33",
  "studio-f1aba5c614c51d396c6f8001",
  "studio-c867b10e516f236ba3fa7691",
];

test("a strategy's mark is nailed to its id, not to the order strategies are listed in", () => {
  for (const id of published) {
    const first = generatedMarkIndex(id, COUNT);
    assert.equal(generatedMarkIndex(id, COUNT), first);
    assert.ok(Number.isInteger(first) && first >= 0 && first < COUNT);
  }
  // Adding or retiring strategies changes neither of these.
  assert.deepEqual(published.map((id) => generatedMarkIndex(id, COUNT)), [4, 3, 11]);
});

test("the hash is the same number everywhere, so two browsers draw one strategy alike", () => {
  assert.equal(hashId(""), 2166136261);
  assert.equal(hashId("studio-94aa87c2ca5503ad3a8acc33"), 2456134828);
  assert.equal(hashId("mag7-rank"), 3056370962);
});

test("ids of the shape Studio mints spread evenly over the set", () => {
  const buckets = new Array<number>(COUNT).fill(0);
  const total = 2400;
  for (let index = 0; index < total; index += 1) {
    buckets[generatedMarkIndex(`studio-${index.toString(16).padStart(24, "0")}`, COUNT)] += 1;
  }
  const even = total / COUNT;
  // No mark may be starved or crowded: a tenth either side of an even share.
  assert.ok(Math.min(...buckets) > even * 0.9, `starved bucket: ${buckets.join(" ")}`);
  assert.ok(Math.max(...buckets) < even * 1.1, `crowded bucket: ${buckets.join(" ")}`);
});

test("an empty set never divides by zero", () => {
  assert.equal(generatedMarkIndex("studio-anything", 0), 0);
});
