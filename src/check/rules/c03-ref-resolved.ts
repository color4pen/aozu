/**
 * C3: All references SHALL resolve to existing elements of enabled types.
 *
 * spec/format.md §10 C3: すべての `[[id]]` が有効な型の実在要素に解決される
 *
 * Degenerate skip rule (spec/format.md §10 C3):
 * - References whose target prefix is KNOWN but not in enabledPrefixes → skip (disabled type)
 * - References whose target prefix is UNKNOWN (not in KNOWN_PREFIXES) → always evaluate (fail-closed)
 * - References from a source element whose prefix is KNOWN but not in enabledPrefixes → skip
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix, KNOWN_PREFIXES } from "../../graph/index.ts";
import { findOwningElement } from "../attribution.ts";

/**
 * Check C3: Verify that all [[id]] references resolve to existing elements of enabled types.
 *
 * Skips:
 * - References whose target ID's prefix is KNOWN but not in enabledPrefixes (disabled type).
 * - References from a source element whose prefix is KNOWN but not in enabledPrefixes.
 *
 * Does NOT skip:
 * - References with an unknown prefix (fail-closed: unknown prefix is always an error).
 */
export function checkC3(graph: Graph, enabledPrefixes: Set<string>): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const ref of graph.references.all) {
    const targetPrefix = extractPrefix(ref.targetId);

    // Known but disabled target type → skip (degenerate/縮退)
    // Unknown prefix → fall through (fail-closed)
    if (KNOWN_PREFIXES.has(targetPrefix) && !enabledPrefixes.has(targetPrefix)) {
      continue;
    }

    // Determine source element using line-aware attribution
    const sourceElement = findOwningElement(graph.rawElements, ref.file, ref.line);
    if (sourceElement) {
      const sourcePrefix = extractPrefix(sourceElement.id);
      // Known but disabled source layer → skip (degenerate/縮退)
      if (KNOWN_PREFIXES.has(sourcePrefix) && !enabledPrefixes.has(sourcePrefix)) {
        continue;
      }
    }

    // Check if target resolves
    if (!graph.elements.has(ref.targetId)) {
      const isUnknownPrefix = !KNOWN_PREFIXES.has(targetPrefix);
      diagnostics.push({
        level: "error",
        code: "C3",
        elementId: ref.targetId,
        message: isUnknownPrefix
          ? `unresolved reference "[[${ref.targetId}]]" (unknown prefix "${targetPrefix}")`
          : `unresolved reference "[[${ref.targetId}]]"`,
        file: ref.file,
        line: ref.line,
      });
    }
  }

  return diagnostics;
}
