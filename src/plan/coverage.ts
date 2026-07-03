/**
 * Coverage verification for the plan module (T-02).
 *
 * Pure function that verifies whether all elements in a plan group are:
 *   (a) Cited in the draft document
 *   (b) Present in the element graph
 *   (c) In "designed" state (not yet requested or implemented)
 *   (d) Not part of a cross-group reference without an after: constraint
 *
 * mod-plan -> mod-graph (Graph type) and mod-plan -> mod-state (StateMap type)
 * are both permitted dependencies.
 */

import type { Graph } from "../graph/types.ts";
import type { StateMap } from "../state/types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single diagnostic entry from coverage verification. */
export interface CoverageDiagnostic {
  level: "error" | "warning";
  code: string;
  elementId: string;
  message: string;
}

/** Result of a coverage verification pass. */
export interface CoverageResult {
  /** True if all checks passed (no errors). Warnings do not affect pass. */
  pass: boolean;
  /** Fatal issues that block transition. */
  errors: CoverageDiagnostic[];
  /** Non-fatal issues worth noting (do not block transition). */
  warnings: CoverageDiagnostic[];
}

/**
 * Group graph structure: maps groups to their elements and tracks after: order
 * constraints between groups.
 *
 * Constructed by the coverage handler from the parsed graph and passed here
 * as a pure-function parameter so this module stays free of I/O.
 */
export interface GroupGraph {
  /** Map from group ID to the set of element IDs belonging to that group. */
  groupElements: Map<string, Set<string>>;
  /**
   * Set of after: edges in "grp-a->grp-b" format.
   *
   * An edge "A->B" means group B must come after group A in implementation
   * order (group A is a prerequisite of group B).
   */
  afterEdges: Set<string>;
}

// ---------------------------------------------------------------------------
// verifyCoverage
// ---------------------------------------------------------------------------

/**
 * Verify that a plan group's elements are all covered by the draft document.
 *
 * Checks:
 *   (a) Coverage: every element ID appears in draftRefs
 *   (b) Existence: every element ID resolves in the graph
 *   (c) State: every element is "designed" (no requested/implemented)
 *   (d) Cross-group references: elements referencing another group without
 *       an after: constraint produce a warning (not an error)
 *
 * @param groupElementIds  IDs of elements belonging to the target plan group.
 * @param draftRefs        Set of [[id]] references extracted from the draft.
 * @param graph            Element graph from the design directory.
 * @param stateMap         Current state map (from state.json).
 * @param groupGraph       Group membership and after: edge data (all groups).
 */
export function verifyCoverage(
  groupElementIds: string[],
  draftRefs: Set<string>,
  graph: Graph,
  stateMap: StateMap,
  groupGraph: GroupGraph
): CoverageResult {
  const errors: CoverageDiagnostic[] = [];
  const warnings: CoverageDiagnostic[] = [];

  for (const id of groupElementIds) {
    // (a) Coverage check: must be cited in the draft
    if (!draftRefs.has(id)) {
      errors.push({
        level: "error",
        code: "NOT_COVERED",
        elementId: id,
        message: `element "${id}" is not cited in the draft document`,
      });
    }

    // (b) Existence check: must exist in the graph
    if (!graph.elements.has(id)) {
      errors.push({
        level: "error",
        code: "NOT_FOUND",
        elementId: id,
        message: `element "${id}" does not exist in the design graph`,
      });
    }

    // (c) State check: must be "designed" (absent from stateMap counts as designed)
    const entry = stateMap[id];
    if (entry !== undefined && entry.state !== "designed") {
      errors.push({
        level: "error",
        code: "WRONG_STATE",
        elementId: id,
        message: `element "${id}" is already in state "${entry.state}" (request: ${entry.request ?? "unknown"}) — ADR-0018-4: an element can only belong to one request at a time`,
      });
    }
  }

  // (d) Cross-group reference warning
  // Find which group owns our groupElementIds
  const targetGroupId = findTargetGroupId(groupElementIds, groupGraph);
  if (targetGroupId !== undefined) {
    // Build reverse map: elementId → groupId
    const elementToGroup = new Map<string, string>();
    for (const [groupId, elementSet] of groupGraph.groupElements) {
      for (const elemId of elementSet) {
        elementToGroup.set(elemId, groupId);
      }
    }

    // Deduplicate warnings per (sourceElement, targetGroup) pair
    const warnedPairs = new Set<string>();

    for (const elemId of groupElementIds) {
      const elem = graph.elements.get(elemId);
      if (!elem) continue;

      // Get all references from this element's file
      const refs = graph.references.bySource.get(elem.file) ?? [];
      for (const ref of refs) {
        const refGroupId = elementToGroup.get(ref.targetId);
        if (refGroupId === undefined || refGroupId === targetGroupId) {
          // Not a cross-group reference
          continue;
        }

        // Cross-group reference found — check for after: edges in either direction
        const fwdEdge = `${targetGroupId}->${refGroupId}`;
        const revEdge = `${refGroupId}->${targetGroupId}`;
        if (groupGraph.afterEdges.has(fwdEdge) || groupGraph.afterEdges.has(revEdge)) {
          // after: constraint exists — no warning needed
          continue;
        }

        const pairKey = `${elemId}:${refGroupId}`;
        if (!warnedPairs.has(pairKey)) {
          warnedPairs.add(pairKey);
          warnings.push({
            level: "warning",
            code: "CROSS_GROUP_NO_ORDER",
            elementId: elemId,
            message: `element "${elemId}" references "${ref.targetId}" in group "${refGroupId}" but no after: constraint links the two groups`,
          });
        }
      }
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Find the group ID that owns the given element IDs.
 *
 * Returns the first group found that contains at least one of the given IDs,
 * or undefined if none is found.
 */
function findTargetGroupId(
  elementIds: string[],
  groupGraph: GroupGraph
): string | undefined {
  for (const [groupId, elementSet] of groupGraph.groupElements) {
    if (elementIds.some((id) => elementSet.has(id))) {
      return groupId;
    }
  }
  return undefined;
}
