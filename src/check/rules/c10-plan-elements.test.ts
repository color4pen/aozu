import { describe, expect, it } from "bun:test";
import { checkC10 } from "./c10-plan-elements.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(
  elements: ParseResult["elements"],
  references: ParseResult["references"],
  elementItems: ParseResult["elementItems"]
) {
  const parsed: ParseResult = {
    elements,
    references,
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems,
    implementations: [],
    permOperations: [],
    targetLines: [],
    malformedPermOperations: [],
  };
  return buildGraph(parsed);
}

describe("checkC10: plan element and grp references", () => {
  it("all elements and after-refs resolve → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
        { id: "grp-order-model", prefix: "grp", displayName: "Order Model", file: "plans/rework.md", line: 3 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "domain/model.md", line: 1 },
      ],
      [],  // no grp-after references
      [{ id: "ent-order", file: "plans/rework.md", line: 4 }]
    );
    expect(checkC10(graph)).toHaveLength(0);
  });

  it("TC-020: unresolved element in elements: line → C10 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
      ],
      [],
      [{ id: "ent-nonexistent", file: "plans/rework.md", line: 5 }]
    );
    const diags = checkC10(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C10");
    expect(diags[0]!.elementId).toBe("ent-nonexistent");
    expect(diags[0]!.level).toBe("error");
  });

  it("unresolved grp in after → C10 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
        { id: "grp-order-model", prefix: "grp", displayName: "Order Model", file: "plans/rework.md", line: 3 },
      ],
      [{ targetId: "grp-missing", file: "plans/rework.md", line: 8 }],
      []
    );
    const diags = checkC10(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C10");
    expect(diags[0]!.elementId).toBe("grp-missing");
  });

  it("non-grp references in plan file are not checked by C10", () => {
    const graph = makeGraph(
      [
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
      ],
      [{ targetId: "mod-cli", file: "plans/rework.md", line: 8 }],
      []
    );
    // mod-cli is not declared, but C10 only checks grp refs
    expect(checkC10(graph)).toHaveLength(0);
  });

  it("empty graph → no diagnostics", () => {
    const graph = makeGraph([], [], []);
    expect(checkC10(graph)).toHaveLength(0);
  });
});
