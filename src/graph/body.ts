/**
 * Element body extraction (mod-graph).
 *
 * Extracts the Markdown body text of a design element from the raw file content.
 *
 * Two element categories (spec/format.md §5):
 *   - Heading elements (mod / term / ent / inv / act / grp): body is the content
 *     from the line after the `## Heading {#id}` declaration up to (but not
 *     including) the next `##` or `###` heading in the same file, or end of file.
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

/** Pattern that marks the start of a new heading element (h2 or h3). */
const HEADING_ELEMENT_RE = /^#{2,3} /;

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
    const headingIdx = el.line - 1; // 0-based
    let endIdx = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (HEADING_ELEMENT_RE.test(lines[i]!)) {
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
