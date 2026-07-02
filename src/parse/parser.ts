/**
 * Main parser (public API).
 *
 * `parseFiles` is a pure function: input is a list of (path, content) pairs,
 * output is a `ParseResult`. File I/O is the caller's responsibility.
 */

import type { FileInput, ParseResult } from "./types.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { extractDeclarations } from "./declarations.ts";
import { extractReferences } from "./references.ts";
import { extractStructuredLines } from "./structured-lines.ts";

/**
 * Parse an array of file inputs and return aggregated results.
 *
 * Processing per file:
 *   1. Parse frontmatter (key-value record + diagnostics)
 *   2. Extract element declarations (heading + document elements)
 *   3. Extract `[[id]]` references (code fence / inline code excluded)
 *   4. Extract structured lines (dependency edges, 登場要素, 責務:, etc.)
 */
export function parseFiles(files: FileInput[]): ParseResult {
  const result: ParseResult = {
    elements: [],
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
  };

  for (const file of files) {
    // 1. Frontmatter
    const fm = parseFrontmatter(file.content, file.path);
    result.frontmatters.set(file.path, fm.record);
    result.diagnostics.push(...fm.diagnostics);

    // 2. Declarations
    const decls = extractDeclarations(file.content, file.path);
    result.elements.push(...decls.elements);
    // Diagnostics from declarations include frontmatter diagnostics again — deduplicate
    // by only pushing declaration-specific ones (id validation errors):
    for (const d of decls.diagnostics) {
      // Avoid double-reporting frontmatter diagnostics already added above
      const alreadyAdded = result.diagnostics.some(
        (x) => x.file === d.file && x.line === d.line && x.message === d.message
      );
      if (!alreadyAdded) {
        result.diagnostics.push(d);
      }
    }

    // 3. References
    const refs = extractReferences(file.content, file.path);
    result.references.push(...refs);

    // 4. Structured lines
    const structured = extractStructuredLines(file.content, file.path);
    result.dependencyEdges.push(...structured.dependencyEdges);
  }

  return result;
}
