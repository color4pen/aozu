/**
 * Tests for op-element implementation: TC-015
 *
 * Covers:
 *   TC Group 6: implementation tracking — op in IMPLEMENTATION_PREFIXES
 *
 * NOTE: Uses the post-implementation ParseResult shape (targetLines /
 * malformedPermOperations). Compile error pre-implementation → RED.
 */

import { describe, expect, it } from "bun:test";
import { computeFrontier, IMPLEMENTATION_PREFIXES } from "./frontier.ts";
import { buildGraph } from "../graph/builder.ts";
import type { ParseResult } from "../parse/types.ts";

function makeGraph(overrides: Partial<ParseResult> = {}) {
  const parsed: ParseResult = {
    elements: [],
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    permOperations: [],
    // Post-implementation fields:
    targetLines: [],
    malformedPermOperations: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

describe("TC-015: op element participates in implementation tracking", () => {
  it("TC-015: IMPLEMENTATION_PREFIXES includes 'op'", () => {
    // After implementation: "op" in IMPLEMENTATION_PREFIXES → true.
    // Pre-implementation: "op" NOT in set → assertion fails → RED.
    expect(IMPLEMENTATION_PREFIXES.has("op")).toBe(true);
  });

  it("TC-015: op element with no stateMap entry appears in designed frontier", () => {
    // After implementation:
    //   - "op" in IMPLEMENTATION_PREFIXES
    //   - "op" in enabledPrefixes (via LAYER_TO_PREFIXES.domain with domain enabled)
    //   - no stateMap entry → state = "designed" → in frontier.designed
    // Pre-implementation: IMPLEMENTATION_PREFIXES check fails → not in designed → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      implementations: [
        {
          paths: ["src/orders/confirm.ts"],
          file: "domain/operations.md",
          line: 2,
        },
      ],
    });

    // enabledPrefixes including op — after implementation this comes from
    // LAYER_TO_PREFIXES.domain when domain is enabled. We pass it explicitly
    // so the test isolates the IMPLEMENTATION_PREFIXES check.
    const enabledPrefixes = new Set([
      "mod",
      "term",
      "ent",
      "inv",
      "act",
      "seq",
      "adr",
      "op", // op should be in domain prefixes after implementation
    ]);

    const frontier = computeFrontier(
      graph,
      {},
      enabledPrefixes,
      new Set(),
      new Map()
    );

    expect(frontier.designed).toContain("op-confirm-order");
  });
});
