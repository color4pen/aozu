/**
 * C3: All references SHALL resolve to existing elements of enabled types.
 *
 * spec/format.md §10 C3: すべての `[[id]]` が有効な型の実在要素に解決される
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix } from "../../graph/index.ts";

/**
 * Check C3: Verify that all [[id]] references resolve to existing elements of enabled types.
 *
 * Skips:
 * - References whose target ID's prefix is not in enabledPrefixes (disabled type).
 * - References whose source element's prefix is not in enabledPrefixes (disabled layer's obligations).
 */
export function checkC3(graph: Graph, enabledPrefixes: Set<string>): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const ref of graph.references.all) {
    const targetPrefix = extractPrefix(ref.targetId);

    // Skip if target type is not enabled
    if (!enabledPrefixes.has(targetPrefix)) {
      continue;
    }

    // Determine source element (find the element declared in the same file as this reference)
    // We need to find the prefix of the source file's element.
    // The source file may contain elements; if any have a prefix not in enabledPrefixes, skip.
    // We use a heuristic: find any element in the reference's file. If the file's element
    // prefix is not enabled, skip the reference.
    const sourceElementInFile = graph.rawElements.find((el) => el.file === ref.file);
    if (sourceElementInFile) {
      const sourcePrefix = extractPrefix(sourceElementInFile.id);
      if (!enabledPrefixes.has(sourcePrefix)) {
        continue;
      }
    }

    // Check if target resolves
    if (!graph.elements.has(ref.targetId)) {
      diagnostics.push({
        level: "error",
        code: "C3",
        elementId: ref.targetId,
        message: `unresolved reference "[[${ref.targetId}]]"`,
        file: ref.file,
        line: ref.line,
      });
    }
  }

  return diagnostics;
}
