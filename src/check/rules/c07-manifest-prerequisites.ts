/**
 * C7: Manifest enabled combination SHALL satisfy type prerequisites.
 *
 * spec/format.md §10 C7: manifest の enabled 組み合わせが型の前提関係を満たす
 */

import type { Manifest } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { LAYER_PREREQUISITES, LAYER_ENABLED_NAMES, VIEW_TYPE_NAMES } from "../manifest.ts";

/**
 * Check C7: Verify that enabled types satisfy their prerequisite relationships.
 *
 * Examples:
 * - loop requires static
 * - dynamic requires static
 * - domain requires static
 */
export function checkC7(manifest: Manifest): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];
  const enabledSet = new Set(manifest.enabled);

  for (const name of manifest.enabled) {
    // Only check names that have prerequisites defined
    const prerequisites = LAYER_PREREQUISITES[name];
    if (!prerequisites) continue;

    for (const prereq of prerequisites) {
      if (!enabledSet.has(prereq)) {
        diagnostics.push({
          level: "error",
          code: "C7",
          elementId: null,
          message: `"${name}" requires "${prereq}" to be enabled`,
          file: "",
          line: 0,
        });
      }
    }
  }

  return diagnostics;
}
