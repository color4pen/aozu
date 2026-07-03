/**
 * Design frontier computation for the plan module.
 *
 * Moved here from src/cli/commands/status.ts so that mod-plan can use it
 * without creating a mod-plan -> mod-cli dependency (which is forbidden).
 *
 * mod-plan -> mod-graph and mod-plan -> mod-state are both permitted.
 * The caller (mod-cli) resolves enabledPrefixes from the manifest and passes
 * it as a Set<string>, removing any need for mod-plan -> mod-check.
 */

import type { Graph } from "../graph/types.ts";
import type { StateMap } from "../state/types.ts";
import type { ParseResult } from "../graph/index.ts";

// ---------------------------------------------------------------------------
// Frontier types
// ---------------------------------------------------------------------------

export interface Frontier {
  /** open topics (top elements with status: open). */
  openTopics: Array<{ id: string; source?: string }>;
  /** Designed elements (no stateMap entry or state === "designed"), implementation prefixes only. */
  designed: string[];
  /** Requested elements (state === "requested"), with request slug. */
  requested: Array<{ id: string; request: string }>;
}

// ---------------------------------------------------------------------------
// Prefixes counted as "implementation" elements for the designed frontier
// ---------------------------------------------------------------------------

/**
 * Set of element prefixes that represent implementation units.
 * Covers all core-layer element types (static / domain / dynamic), including
 * `act` — actors are first-class domain elements (ADR-0015) and participate in
 * the designed → requested → implemented state machine like any other element
 * (ADR-0005 "全設計要素").
 * Loop meta-elements (top, plan, grp) and ADRs are excluded from the
 * "designed" frontier since they are planning/decision artifacts, not
 * implementation targets.
 */
export const IMPLEMENTATION_PREFIXES = new Set(["mod", "term", "ent", "inv", "act", "seq"]);

// ---------------------------------------------------------------------------
// Frontier computation (pure function)
// ---------------------------------------------------------------------------

/**
 * Compute the three design frontiers from graph, state, enabled prefixes, and frontmatters.
 *
 * @param graph            The element graph built from parseFiles.
 * @param stateMap         Contents of state.json (empty if file absent).
 * @param enabledPrefixes  Set of element prefixes that are active (from getEnabledPrefixes).
 * @param frontmatters     Frontmatter records keyed by file path (from parseFiles).
 */
export function computeFrontier(
  graph: Graph,
  stateMap: StateMap,
  enabledPrefixes: Set<string>,
  frontmatters: ParseResult["frontmatters"]
): Frontier {
  // (a) Open topics: top elements whose frontmatter status === "open"
  //
  // NOTE (pre-ADR-0018 semantics, intentionally retained in this change):
  // ADR-0018-3 replaces the frontmatter `status` field with a computed rule —
  // "a top cited by any ADR's `topics:` frontmatter is addressed". Migrating
  // this computation (and the scaffold topic template) is scoped to the
  // coverage/mark request (adr/0018 Consequences, docs/open-questions.md 論点 12).
  // plan/derive only consume `frontier.designed`, so this branch does not
  // affect them.
  const openTopics: Frontier["openTopics"] = [];
  for (const [id, el] of graph.elements) {
    if (el.prefix !== "top") continue;
    const fm = frontmatters.get(el.file);
    const status = typeof fm?.["status"] === "string" ? fm["status"] : undefined;
    if (status === "open") {
      const source = typeof fm?.["source"] === "string" ? fm["source"] : undefined;
      openTopics.push(source !== undefined ? { id, source } : { id });
    }
  }

  // (b) Designed: implementation elements not in stateMap or with state === "designed"
  const designed: string[] = [];
  for (const [id, el] of graph.elements) {
    if (!IMPLEMENTATION_PREFIXES.has(el.prefix)) continue;
    if (!enabledPrefixes.has(el.prefix)) continue;
    const entry = stateMap[id];
    const state = entry?.state ?? "designed";
    if (state === "designed") {
      designed.push(id);
    }
  }

  // (c) Requested: stateMap entries with state === "requested"
  const requested: Frontier["requested"] = [];
  for (const [id, entry] of Object.entries(stateMap)) {
    if (entry.state !== "requested") continue;
    // Only include IDs that exist in the graph
    if (!graph.elements.has(id)) continue;
    requested.push({ id, request: entry.request ?? "" });
  }

  return { openTopics, designed, requested };
}
