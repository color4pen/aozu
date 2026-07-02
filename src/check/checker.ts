/**
 * Checker: aggregates all closure check rules and applies graceful degradation.
 *
 * `runCheck` evaluates all applicable rules based on manifest-enabled layers
 * and returns the full list of diagnostics (does not fail-fast).
 */

import type { Graph } from "../graph/types.ts";
import type { Manifest } from "../graph/types.ts";
import type { CheckDiagnostic } from "./types.ts";
import { getEnabledLayers, getEnabledPrefixes, isLayerEnabled } from "./manifest.ts";
import { checkC1 } from "./rules/c01-id-grammar.ts";
import { checkC2 } from "./rules/c02-id-unique.ts";
import { checkC3 } from "./rules/c03-ref-resolved.ts";
import { checkC4 } from "./rules/c04-dep-endpoints.ts";
import { checkC5 } from "./rules/c05-seq-actors.ts";
import { checkC6 } from "./rules/c06-view-links.ts";
import { checkC7 } from "./rules/c07-manifest-prerequisites.ts";
import { checkC8 } from "./rules/c08-state-keys.ts";
import { checkC9 } from "./rules/c09-adr-topics.ts";
import { checkC10 } from "./rules/c10-plan-elements.ts";
import { checkC11 } from "./rules/c11-layer-direction.ts";

/**
 * Run all applicable closure check rules.
 *
 * Graceful degradation:
 * - C1, C2, C7 are always evaluated.
 * - C3 is always evaluated (but skips disabled-type references internally).
 * - C4 is evaluated only when static is enabled.
 * - C5 is evaluated only when dynamic is enabled.
 * - C6 is always evaluated (fail-closed for view types).
 * - C8, C9, C10 are evaluated only when loop is enabled.
 * - C11 is evaluated for enabled layers only (internally filters by enabledPrefixes).
 *
 * @param graph      The graph to check.
 * @param manifest   The parsed manifest (enabled list).
 * @param stateKeys  Keys from state.json, for C8. Pass empty array if not available.
 */
export function runCheck(
  graph: Graph,
  manifest: Manifest,
  stateKeys: string[] = []
): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];
  const enabledPrefixes = getEnabledPrefixes(manifest);

  // C1: ID grammar — always
  diagnostics.push(...checkC1(graph));

  // C2: ID uniqueness — always
  diagnostics.push(...checkC2(graph));

  // C3: Reference resolution — always (skips disabled types internally)
  diagnostics.push(...checkC3(graph, enabledPrefixes));

  // C4: Dependency edge endpoints — static enabled
  if (isLayerEnabled("static", manifest)) {
    diagnostics.push(...checkC4(graph));
  }

  // C5: Seq actor lists — dynamic enabled
  if (isLayerEnabled("dynamic", manifest)) {
    diagnostics.push(...checkC5(graph));
  }

  // C6: View type fail-closed — always
  diagnostics.push(...checkC6(manifest));

  // C7: Manifest prerequisites — always
  diagnostics.push(...checkC7(manifest));

  // C8, C9, C10: Loop-only rules
  if (isLayerEnabled("loop", manifest)) {
    diagnostics.push(...checkC8(graph, stateKeys));
    diagnostics.push(...checkC9(graph));
    diagnostics.push(...checkC10(graph));
  }

  // C11: Layer direction — for enabled layers (internal filtering)
  diagnostics.push(...checkC11(graph, enabledPrefixes));

  return diagnostics;
}
