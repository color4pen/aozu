/**
 * C10: Plan elements and groups SHALL reference existing elements (loop only).
 *
 * spec/format.md §10 C10: plan の elements がすべて実在し、after の grp が実在する
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix } from "../../graph/index.ts";

/**
 * Check C10: Verify plan element references and grp after-references.
 *
 * - `elementItems` from plan `elements:` lines must resolve to existing elements.
 * - References from plan files with prefix `grp` (after: grp references) must resolve.
 */
export function checkC10(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  // Collect plan files from plan elements
  const planFiles = new Set<string>(
    graph.rawElements
      .filter((el) => el.prefix === "plan" || el.prefix === "grp")
      .map((el) => el.file)
  );

  // Check elementItems: each ID from `elements:` lines must resolve
  for (const item of graph.elementItems) {
    if (!graph.elements.has(item.id)) {
      diagnostics.push({
        level: "error",
        code: "C10",
        elementId: item.id,
        message: `plan elements: reference "[[${item.id}]]" does not resolve to any element`,
        file: item.file,
        line: item.line,
      });
    }
  }

  // Check grp references in plan files (after: [[grp-*]])
  for (const ref of graph.references.all) {
    if (!planFiles.has(ref.file)) continue;
    if (extractPrefix(ref.targetId) !== "grp") continue;
    if (!graph.elements.has(ref.targetId)) {
      diagnostics.push({
        level: "error",
        code: "C10",
        elementId: ref.targetId,
        message: `plan after: reference "[[${ref.targetId}]]" does not resolve to any grp element`,
        file: ref.file,
        line: ref.line,
      });
    }
  }

  return diagnostics;
}
