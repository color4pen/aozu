/**
 * C11: Cross-layer references SHALL follow the allowed direction.
 *
 * spec/format.md §10 C11:
 * - domain (term/ent/inv/act): may only reference domain elements
 * - static (mod): may reference static and domain elements
 * - dynamic (seq): may reference dynamic, static, and domain elements
 * - views (perm/uc/scr/api/dat/flow/evt/ext/dpl): may reference views, static, domain, and dynamic elements
 * - loop (top/plan/grp) and adr: no restriction
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix } from "../../graph/index.ts";
import { LAYER_MAP } from "../manifest.ts";
import { findOwningElement } from "../attribution.ts";

/**
 * Allowed reference target prefixes per source layer.
 * Unlisted layers (loop, adr) have no restriction.
 */
const LAYER_ALLOWED_TARGET_PREFIXES: Record<string, Set<string>> = {
  domain: new Set(["term", "ent", "inv", "act", "op"]),
  static: new Set(["mod", "term", "ent", "inv", "act", "op"]),
  dynamic: new Set(["seq", "mod", "term", "ent", "inv", "act", "op"]),
  // views may reference views (self) + static + domain + dynamic (spec §10 C11, ADR-0023 D6)
  views: new Set(["uc", "scr", "api", "dat", "flow", "evt", "ext", "perm", "dpl", "mod", "term", "ent", "inv", "act", "op", "seq"]),
};

/**
 * Check C11: Verify cross-layer reference direction.
 *
 * Only evaluates references from elements whose prefix is in enabledPrefixes.
 * References from disabled layers are skipped.
 */
export function checkC11(graph: Graph, enabledPrefixes: Set<string>): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const ref of graph.references.all) {
    const targetPrefix = extractPrefix(ref.targetId);

    // Find the source element owning this reference (nearest preceding declaration in the same file)
    const sourceElement = findOwningElement(graph.rawElements, ref.file, ref.line);
    if (!sourceElement) continue;

    const sourcePrefix = extractPrefix(sourceElement.id);

    // Skip references from disabled layers
    if (!enabledPrefixes.has(sourcePrefix)) continue;

    // Determine the source layer
    const sourceLayer = LAYER_MAP[sourcePrefix];
    if (!sourceLayer) continue;

    // Get the allowed target prefixes for this source layer
    const allowedTargets = LAYER_ALLOWED_TARGET_PREFIXES[sourceLayer];
    if (!allowedTargets) {
      // No restriction for loop, adr
      continue;
    }

    // Skip if target type is not enabled (C3 handles resolution; C11 only checks direction)
    if (!enabledPrefixes.has(targetPrefix)) continue;

    if (!allowedTargets.has(targetPrefix)) {
      diagnostics.push({
        level: "error",
        code: "C11",
        elementId: sourceElement.id,
        message: `${sourceLayer} element "${sourceElement.id}" references "${ref.targetId}" (${targetPrefix}), which is not allowed from layer "${sourceLayer}"`,
        file: ref.file,
        line: ref.line,
      });
    }
  }

  return diagnostics;
}
