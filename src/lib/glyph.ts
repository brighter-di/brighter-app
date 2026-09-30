// Which mark a strategy draws when it has none of its own. Lives apart from
// the marks themselves so the rule is plain, and testable, on its own.

/** FNV-1a: small, stable, and the same number in every browser and session. */
export function hashId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A strategy's place in the finite set, by its id alone. Adding, retiring or
 * reordering strategies moves nobody's mark; only resizing the set would.
 */
export const generatedMarkIndex = (id: string, count: number) => (count > 0 ? hashId(id) % count : 0);
