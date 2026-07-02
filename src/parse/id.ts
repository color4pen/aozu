/**
 * ID grammar validation (spec/format.md §4).
 *
 * id    = prefix "-" slug
 * slug  = [a-z0-9]+ ("-" [a-z0-9]+)*
 *
 * Known prefixes from the type table in §4.
 */

export const KNOWN_PREFIXES = new Set([
  "mod",
  "term",
  "ent",
  "inv",
  "act",
  "seq",
  "top",
  "plan",
  "grp",
  "adr",
  "uc",
  "scr",
  "api",
  "dat",
  "flow",
  "evt",
  "ext",
  "perm",
  "dpl",
]);

/** Slug pattern: one or more `[a-z0-9]` segments separated by `-`. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface IdValidationResult {
  valid: boolean;
  /** Reason string when invalid; undefined when valid. */
  reason?: string;
}

/**
 * Validate an ID string against the strict profile grammar.
 *
 * Returns `{ valid: true }` if the ID is well-formed and uses a known prefix.
 * Returns `{ valid: false, reason }` otherwise.
 */
export function validateId(id: string): IdValidationResult {
  // Must contain at least one '-'
  const dashIndex = id.indexOf("-");
  if (dashIndex < 1) {
    return { valid: false, reason: `no prefix separator: "${id}"` };
  }

  const prefix = id.slice(0, dashIndex);
  const slug = id.slice(dashIndex + 1);

  // Prefix must be a known prefix (all-lowercase, no digits required by known list)
  if (!KNOWN_PREFIXES.has(prefix)) {
    return { valid: false, reason: `unknown prefix: "${prefix}"` };
  }

  // Slug must match the slug grammar
  if (!SLUG_RE.test(slug)) {
    return { valid: false, reason: `invalid slug: "${slug}"` };
  }

  // The whole ID must be all-lowercase + digits + hyphens (no uppercase, no underscores, etc.)
  if (!/^[a-z0-9-]+$/.test(id)) {
    return { valid: false, reason: `ID contains invalid characters: "${id}"` };
  }

  return { valid: true };
}

/**
 * Extract the prefix portion of a raw ID string.
 * Returns the text before the first '-', or the whole string if no '-' present.
 */
export function extractPrefix(id: string): string {
  const dashIndex = id.indexOf("-");
  return dashIndex >= 0 ? id.slice(0, dashIndex) : id;
}
