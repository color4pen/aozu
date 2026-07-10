import { describe, expect, it } from "bun:test";
import { checkC4 } from "./c04-dep-endpoints.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(
  elements: ParseResult["elements"],
  dependencyEdges: ParseResult["dependencyEdges"]
) {
  const parsed: ParseResult = {
    elements,
    references: [],
    dependencyEdges,
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    permOperations: [],
    permTargets: [],
  };
  return buildGraph(parsed);
}

describe("checkC4: dependency edge endpoints", () => {
  it("both endpoints are mod → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 },
      ],
      [{ from: "mod-cli", to: "mod-parse", file: "dependencies.md", line: 1 }]
    );
    expect(checkC4(graph)).toHaveLength(0);
  });

  it("from endpoint with non-mod prefix → C4 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      [{ from: "ent-order", to: "mod-cli", file: "dependencies.md", line: 1 }]
    );
    const diags = checkC4(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C4");
    expect(diags[0]!.elementId).toBe("ent-order");
  });

  it("to endpoint with non-mod prefix → C4 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
      ],
      [{ from: "mod-cli", to: "ent-order", file: "dependencies.md", line: 1 }]
    );
    const diags = checkC4(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C4");
    expect(diags[0]!.elementId).toBe("ent-order");
  });

  it("TC-038: unresolved from endpoint → C4 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      [{ from: "mod-missing", to: "mod-cli", file: "dependencies.md", line: 1 }]
    );
    const diags = checkC4(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C4");
    expect(diags[0]!.elementId).toBe("mod-missing");
  });

  it("unresolved to endpoint → C4 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      [{ from: "mod-cli", to: "mod-missing", file: "dependencies.md", line: 1 }]
    );
    const diags = checkC4(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C4");
    expect(diags[0]!.elementId).toBe("mod-missing");
  });

  it("no dependency edges → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      []
    );
    expect(checkC4(graph)).toHaveLength(0);
  });
});
