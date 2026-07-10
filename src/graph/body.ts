/**
 * Element body extraction (mod-graph).
 *
 * Extracts the Markdown body text of a design element from the raw file content.
 *
 * Two element categories (spec/format.md §5):
 *   - Heading elements (mod / term / ent / inv / act / grp): body is the content
 *     from the line after the `## Heading {#id}` declaration up to (but not
 *     including) the next same-level `##` heading in the same file, or end of file.
 *     h3 sub-headings within the body are part of the body (spec/format.md §5:
 *     "見出しから次の同レベル見出しまでが要素の本文").
 *   - Document elements (seq / top / plan / adr): body is the entire file content
 *     after the closing `---` of the frontmatter block (frontmatter excluded).
 */

import type { Graph } from "./types.ts";
import type { FileInput } from "../parse/types.ts";

// ---------------------------------------------------------------------------
// Heading vs. document element classification
// ---------------------------------------------------------------------------

/** Prefixes that use the heading element format (`## Name {#id}`). */
const HEADING_PREFIXES = new Set(["mod", "term", "ent", "inv", "act", "grp"]);

/** Prefixes that use the document element format (frontmatter `id:` key). */
const DOCUMENT_PREFIXES = new Set(["seq", "top", "plan", "adr"]);

/** Pattern that extracts the level of a heading declaration line (h2 or h3, spec §5). */
const DECL_HEADING_RE = /^(#{2,3}) /;

/** Pattern that extracts the level of any heading line (boundary scan). */
const ANY_HEADING_RE = /^(#{1,6}) /;

// ---------------------------------------------------------------------------
// Body extraction
// ---------------------------------------------------------------------------

/**
 * Extract the body text of a single element.
 *
 * @param elementId  ID of the element to extract.
 * @param graph      Graph built from parseFiles.
 * @param files      Raw file inputs (must include the file that declares the element).
 * @returns          Body text, or `null` if the element is not found or its file
 *                   is not in `files`.
 */
export function extractElementBody(
  elementId: string,
  graph: Graph,
  files: FileInput[]
): string | null {
  const el = graph.elements.get(elementId);
  if (!el) return null;

  const fileInput = files.find((f) => f.path === el.file);
  if (!fileInput) return null;

  const lines = fileInput.content.split("\n");

  if (DOCUMENT_PREFIXES.has(el.prefix)) {
    // Document element: return content after the frontmatter closing `---`
    return extractAfterFrontmatter(lines);
  }

  if (HEADING_PREFIXES.has(el.prefix)) {
    // Heading element: from the line after the declaration to the next heading
    // of the same or higher level (spec §5 「見出しから次の同レベル見出しまで」—
    // an h2-declared element keeps its h3 sub-headings in the body; an
    // h3-declared element ends at the next h3 sibling or at a parent h2).
    // Headings inside code fences are literal text, not boundaries (same
    // line-oriented fence toggling as reference extraction, spec §6).
    const headingIdx = el.line - 1; // 0-based
    const declMatch = DECL_HEADING_RE.exec(lines[headingIdx] ?? "");
    const declLevel = declMatch ? declMatch[1]!.length : 2;
    let endIdx = lines.length;
    let inCodeFence = false;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trimStart().startsWith("```")) {
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence) continue;
      const m = ANY_HEADING_RE.exec(line);
      if (m && m[1]!.length <= declLevel) {
        endIdx = i;
        break;
      }
    }
    return lines.slice(headingIdx + 1, endIdx).join("\n");
  }

  return null;
}

/**
 * Extract bodies for multiple elements at once.
 *
 * @param ids    Element IDs to look up.
 * @param graph  Graph containing element declarations.
 * @param files  Raw file inputs.
 * @returns      Map from element ID to body text (missing / null entries are omitted).
 */
export function extractAllBodies(
  ids: string[],
  graph: Graph,
  files: FileInput[]
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of ids) {
    const body = extractElementBody(id, graph, files);
    if (body !== null) {
      result.set(id, body);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Element range extraction (attribution-rule boundary — used for hash computation)
// ---------------------------------------------------------------------------

/**
 * Extract the full text range of a single element using the attribution-rule boundary.
 *
 * This differs from `extractElementBody` in two important ways:
 *
 *   1. **Heading elements**: the range INCLUDES the declaration line (e.g.
 *      `## 受注 {#ent-order}`), whereas `extractElementBody` starts from the
 *      line AFTER the declaration.  The boundary is the line immediately before
 *      the next element declaration in the same file (by any prefix, any level) —
 *      i.e. the same rule as `findOwningElement`.  By contrast, `extractElementBody`
 *      uses heading-level boundaries (next same-or-higher-level heading).
 *
 *   2. **Document elements**: the range is the ENTIRE file content, frontmatter
 *      included.  `extractElementBody` strips the frontmatter preamble.
 *
 * Using the attribution-rule boundary here (instead of heading-level boundary)
 * ensures that mark and check compute hashes over the same region regardless of
 * heading structure, and that the region matches what `findOwningElement` attributes
 * to each element.  Using a different boundary would create silent hash mismatches
 * whenever a new element is introduced mid-file.
 *
 * @param elementId  ID of the element to extract.
 * @param graph      Graph built from parseFiles.
 * @param files      Raw file inputs (must include the file that declares the element).
 * @returns          Range text, or `null` if the element is not found or its file
 *                   is not in `files`.
 */
export function extractElementRange(
  elementId: string,
  graph: Graph,
  files: FileInput[]
): string | null {
  const el = graph.elements.get(elementId);
  if (!el) return null;

  const fileInput = files.find((f) => f.path === el.file);
  if (!fileInput) return null;

  const lines = fileInput.content.split("\n");

  if (DOCUMENT_PREFIXES.has(el.prefix)) {
    // Document element: return the entire file content (frontmatter included).
    return fileInput.content;
  }

  if (HEADING_PREFIXES.has(el.prefix)) {
    // Heading element: from the declaration line (0-based: el.line - 1) to the
    // line immediately before the next element declaration in the same file.
    // "Next element" = smallest el.line > this element's line, across ALL
    // elements in the same file (not just same-level headings).
    const startIdx = el.line - 1; // 0-based

    // Find the next element declaration in the same file
    let nextLine: number | undefined;
    for (const other of graph.elements.values()) {
      if (other.file !== el.file) continue;
      if (other.line <= el.line) continue;
      if (DOCUMENT_PREFIXES.has(other.prefix)) continue; // document elements live in their own file
      if (nextLine === undefined || other.line < nextLine) {
        nextLine = other.line;
      }
    }

    // endIdx (exclusive): line before the next element declaration, or EOF
    const endIdx = nextLine !== undefined ? nextLine - 1 : lines.length;

    return lines.slice(startIdx, endIdx).join("\n");
  }

  return null;
}

/**
 * Compute the SHA-256 hex hash of a single element's body range.
 *
 * Uses `extractElementRange` to obtain the range text, then computes the hash.
 * Normalization is intentionally absent — even whitespace-only changes produce
 * a different hash (fail-closed, ADR-0018 補記 1).
 *
 * The same function is used by mark and check so that the two sides always
 * compute hashes over the identical text region (prevents structural drift
 * between the recording and checking contexts).
 *
 * @param elementId  ID of the element.
 * @param graph      Graph built from parseFiles.
 * @param files      Raw file inputs.
 * @returns          64-character lowercase hex string, or `null` if the range
 *                   could not be resolved.
 */
export function computeElementHash(
  elementId: string,
  graph: Graph,
  files: FileInput[]
): string | null {
  const range = extractElementRange(elementId, graph, files);
  if (range === null) return null;

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(range);
  return hasher.digest("hex");
}

/**
 * Compute hashes for multiple elements at once.
 *
 * @param ids    Element IDs to hash.
 * @param graph  Graph built from parseFiles.
 * @param files  Raw file inputs.
 * @returns      Map from element ID to SHA-256 hex hash (null results are omitted).
 */
export function computeAllHashes(
  ids: string[],
  graph: Graph,
  files: FileInput[]
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of ids) {
    const hash = computeElementHash(id, graph, files);
    if (hash !== null) {
      result.set(id, hash);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the file content that follows the frontmatter closing `---`.
 *
 * If there is no frontmatter (first line is not `---`), returns the entire content.
 * If the frontmatter is never closed, returns an empty string.
 */
function extractAfterFrontmatter(lines: string[]): string {
  if (lines[0]?.trim() !== "---") {
    // No frontmatter — return whole file
    return lines.join("\n");
  }

  // Find closing `---`
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      // Lines after the closing delimiter
      return lines.slice(i + 1).join("\n");
    }
  }

  // Unclosed frontmatter — no body
  return "";
}
