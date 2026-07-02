/**
 * C6: Unsupported view types SHALL produce a diagnostic (fail-closed).
 *
 * spec/format.md §10 C6: ビューのリンク義務が充足される
 *
 * Because view type schemas are not yet defined, any view type in `enabled`
 * produces an error diagnostic with code "C6". If no view types are present,
 * C6 is trivially satisfied.
 */

import type { Manifest } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { VIEW_TYPE_NAMES } from "../manifest.ts";

/**
 * Check C6: Detect unsupported view types in the manifest's enabled list.
 *
 * Each view type name found in `manifest.enabled` produces a C6 diagnostic.
 */
export function checkC6(manifest: Manifest): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const name of manifest.enabled) {
    if (VIEW_TYPE_NAMES.has(name)) {
      diagnostics.push({
        level: "error",
        code: "C6",
        elementId: null,
        message: `unsupported view type: "${name}" (view type schemas are not yet defined)`,
        file: "",
        line: 0,
      });
    }
  }

  return diagnostics;
}
