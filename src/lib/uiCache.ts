// Small persistent cache for data that should remain visible while React Query
// refreshes it. Every entry is isolated by its full query key, versioned, and
// short-lived so an old browser snapshot never becomes a second source of truth.

export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Enumeration, when available, lets a full storage make room. */
  readonly length?: number;
  key?(index: number): string | null;
}

interface Stored<T> {
  version: 1;
  savedAt: number;
  data: T;
}

export interface Cached<T> {
  data: T;
  savedAt: number;
}

interface CacheAccess {
  storage?: CacheStorage;
  now?: number;
  /** Series that are only ever extended with new days may live longer than a snapshot. */
  maxAgeMs?: number;
}

export type CacheValidator<T> = (value: unknown) => value is T;

const PREFIX = "brighter:ui:v1:";
export const UI_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRY_BYTES = 1_000_000;

function browserStorage(): CacheStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function storageKey(queryKey: readonly unknown[]): string {
  return `${PREFIX}${JSON.stringify(queryKey)}`;
}

function remove(storage: CacheStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* private mode / disabled storage */
  }
}

export function readUiCache<T>(queryKey: readonly unknown[], validate: CacheValidator<T>, access: CacheAccess = {}): Cached<T> | undefined {
  const storage = access.storage ?? browserStorage();
  if (!storage) return undefined;
  const key = storageKey(queryKey);
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<Stored<unknown>>;
    const now = access.now ?? Date.now();
    if (value.version !== 1 || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) || now - value.savedAt > (access.maxAgeMs ?? UI_CACHE_MAX_AGE_MS) || !validate(value.data)) {
      remove(storage, key);
      return undefined;
    }
    return { data: value.data, savedAt: value.savedAt };
  } catch {
    remove(storage, key);
    return undefined;
  }
}

export function writeUiCache<T>(queryKey: readonly unknown[], data: T, access: CacheAccess = {}): void {
  const storage = access.storage ?? browserStorage();
  if (!storage) return;
  try {
    const raw = JSON.stringify({ version: 1, savedAt: access.now ?? Date.now(), data } satisfies Stored<T>);
    if (raw.length > MAX_ENTRY_BYTES) return;
    const key = storageKey(queryKey);
    for (;;) {
      try {
        storage.setItem(key, raw);
        return;
      } catch {
        // Full: drop the oldest entry of ours and try again.
        if (!evictOldest(storage, key)) return;
      }
    }
  } catch {
    /* private mode / non-serialisable response */
  }
}

function evictOldest(storage: CacheStorage, keep: string): boolean {
  if (typeof storage.length !== "number" || !storage.key) return false;
  let oldest: { key: string; savedAt: number } | undefined;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX) || key === keep) continue;
    let savedAt = 0;
    try {
      savedAt = Number((JSON.parse(storage.getItem(key) ?? "") as Partial<Stored<unknown>>).savedAt) || 0;
    } catch {
      /* corrupt entries go first */
    }
    if (!oldest || savedAt < oldest.savedAt) oldest = { key, savedAt };
  }
  if (!oldest) return false;
  remove(storage, oldest.key);
  return true;
}
