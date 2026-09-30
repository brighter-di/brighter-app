// Whether a strategy can hold a leveraged or inverse fund. These compound
// daily: the landing page's chart leaves them out entirely, because one 3x
// curve dwarfs every other line, and the strategy list hides them until asked.
//
// The backend decides this the same way — internal/tokens.LeveragedKind, also
// case-insensitive — and returns it on a card as `leveraged`. This is for the
// places that read /v1/templates, where the asset's kind is what is on hand.
//
// The kind is the only marker, and it comes from Ondo's registry, which types
// all five of today's geared funds as "Equity ETF". They read as leveraged
// only because the backend's curated list overrides them, so a geared fund
// added upstream and not curated would slip through here too. Adding one to
// that list is what fixes it, on both sides at once.

/** Just enough of an Asset to judge it. */
export interface KindedAsset {
  kind: string;
}

export const isLeveragedKind = (kind: string): boolean => /leveraged|inverse/i.test(kind);

export const isLeveraged = (asset: KindedAsset): boolean => isLeveragedKind(asset.kind);

export const holdsLeveraged = (assets: readonly KindedAsset[]): boolean => assets.some(isLeveraged);
