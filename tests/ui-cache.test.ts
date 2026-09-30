import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readUiCache, UI_CACHE_MAX_AGE_MS, writeUiCache, type CacheStorage } from "../src/lib/uiCache.ts";

class MemoryStorage implements CacheStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const isRows = (value: unknown): value is { id: string }[] =>
  Array.isArray(value) && value.every((row) => !!row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string");

test("UI query snapshots survive reloads and stay isolated by full query key", () => {
  const storage = new MemoryStorage();
  writeUiCache(["portfolios", "0xaaa"], [{ id: "first" }], { storage, now: 100 });
  writeUiCache(["portfolios", "0xbbb"], [{ id: "second" }], { storage, now: 200 });

  assert.deepEqual(readUiCache(["portfolios", "0xaaa"], isRows, { storage, now: 300 }), { data: [{ id: "first" }], savedAt: 100 });
  assert.deepEqual(readUiCache(["portfolios", "0xbbb"], isRows, { storage, now: 300 }), { data: [{ id: "second" }], savedAt: 200 });
});

test("a full storage drops the oldest entries to make room", () => {
  class TinyStorage extends MemoryStorage {
    get length() { return this.values.size; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    setItem(key: string, value: string) {
      if (!this.values.has(key) && this.values.size >= 2) throw new Error("QuotaExceededError");
      super.setItem(key, value);
    }
  }
  const storage = new TinyStorage();
  writeUiCache(["a"], [{ id: "a" }], { storage, now: 1 });
  writeUiCache(["b"], [{ id: "b" }], { storage, now: 2 });
  writeUiCache(["c"], [{ id: "c" }], { storage, now: 3 });
  assert.equal(readUiCache(["a"], isRows, { storage, now: 4 }), undefined);
  assert.deepEqual(readUiCache(["c"], isRows, { storage, now: 4 })?.data, [{ id: "c" }]);
  assert.equal(readUiCache(["c"], isRows, { storage, now: 4 + UI_CACHE_MAX_AGE_MS, maxAgeMs: 2 * UI_CACHE_MAX_AGE_MS })?.savedAt, 3);
});

test("expired, corrupt, and structurally invalid snapshots are discarded", () => {
  const storage = new MemoryStorage();
  const key = ["positions", "portfolio-1"] as const;
  writeUiCache(key, [{ id: "old" }], { storage, now: 10 });
  assert.equal(readUiCache(key, isRows, { storage, now: 10 + UI_CACHE_MAX_AGE_MS + 1 }), undefined);
  assert.equal(storage.values.size, 0);

  storage.values.set('brighter:ui:v1:["positions","portfolio-1"]', "not json");
  assert.equal(readUiCache(key, isRows, { storage, now: 20 }), undefined);
  assert.equal(storage.values.size, 0);

  writeUiCache(key, { unexpected: true }, { storage, now: 30 });
  assert.equal(readUiCache(key, isRows, { storage, now: 31 }), undefined);
  assert.equal(storage.values.size, 0);
});
