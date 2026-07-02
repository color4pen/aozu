/**
 * Declaration extractor (spec/format.md §5).
 *
 * Extracts:
 *   - Heading elements: `## Display {#id}` or `### Display {#id}` (h2/h3 only)
 *   - Document elements: frontmatter `id:` field (display name from first `# Heading`)
 *
 * Validates extracted IDs using id.ts and emits diagnostics for violations.
 */

import type { Diagnostic, Element } from "./types.ts";
import { extractPrefix, validateId } from "./id.ts";
import { parseFrontmatter } from "./frontmatter.ts";

/** Pattern for heading elements: `## Display Name {#id}` (h2 or h3). */
const HEADING_ELEMENT_RE = /^(#{2,3}) (.+) \{#([^}]+)\}$/;

/** Pattern for the document-level title: `# Title` (h1, no `{#id}`). */
const H1_TITLE_RE = /^# (.+)$/;

export interface DeclarationResult {
  elements: Element[];
  diagnostics: Diagnostic[];
}

/**
 * Extract element declarations from file content.
 *
 * Skips code fences for heading detection (a heading inside a code block is not a
 * real heading). Frontmatter is also parsed for document-element declarations.
 *
 * @param content  Raw file content.
 * @param filePath Used for Element.file and diagnostic positions.
 */
export function extractDeclarations(
  content: string,
  filePath: string
): DeclarationResult {
  const lines = content.split("\n");
  const elements: Element[] = [];
  const diagnostics: Diagnostic[] = [];

  // --- Frontmatter pass ---
  const fm = parseFrontmatter(content, filePath);
  diagnostics.push(...fm.diagnostics);

  const idField = fm.record["id"];
  if (typeof idField === "string" && idField !== "") {
    const id = idField.trim();
    // Display name: first `# Heading` in the file (may be in body or before frontmatter end)
    const displayName = findH1Title(lines);
    const lineNumber = findFrontmatterIdLine(lines);

    const validation = validateId(id);
    if (!validation.valid) {
      diagnostics.push({
        severity: "error",
        message: `invalid ID in frontmatter: ${validation.reason}`,
        file: filePath,
        line: lineNumber,
      });
    }

    elements.push({
      id,
      prefix: extractPrefix(id),
      displayName,
      file: filePath,
      line: lineNumber,
    });
  }

  // --- Body pass: heading elements ---
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1; // 1-based

    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const match = HEADING_ELEMENT_RE.exec(line);
    if (!match) continue;

    // match[1] = hashes, match[2] = display name, match[3] = id
    const id = match[3]!.trim();
    const displayName = match[2]!.trim();

    const validation = validateId(id);
    if (!validation.valid) {
      diagnostics.push({
        severity: "error",
        message: `invalid ID in heading "${line}": ${validation.reason}`,
        file: filePath,
        line: lineNumber,
      });
    }

    elements.push({
      id,
      prefix: extractPrefix(id),
      displayName,
      file: filePath,
      line: lineNumber,
    });
  }

  return { elements, diagnostics };
}

/** Find the display name from the first `# Title` line in the file. */
function findH1Title(lines: string[]): string {
  for (const line of lines) {
    const m = H1_TITLE_RE.exec(line);
    if (m) return m[1]!.trim();
  }
  return "";
}

/** Find the 1-based line number of `id:` in frontmatter. */
function findFrontmatterIdLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (/^id:\s/.test(lines[i]!)) return i + 1;
  }
  return 1;
}
