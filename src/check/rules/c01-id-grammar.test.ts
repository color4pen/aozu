import { describe, expect, it } from "bun:test";
import { checkC1 } from "./c01-id-grammar.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(elements: ParseResult["elements"]) {
  const parsed: ParseResult = {
    elements,
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
  };
  return buildGraph(parsed);
}

describe("checkC1: ID grammar", () => {
  it("valid IDs only → no diagnostics", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 5 },
    ]);
    expect(checkC1(graph)).toHaveLength(0);
  });

  it("uppercase ID → C1 diagnostic", () => {
    const graph = makeGraph([
      { id: "Mod-Parse", prefix: "Mod", displayName: "Parser", file: "modules.md", line: 1 },
    ]);
    const diags = checkC1(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C1");
    expect(diags[0]!.elementId).toBe("Mod-Parse");
    expect(diags[0]!.level).toBe("error");
  });

  it("unknown prefix → C1 diagnostic", () => {
    const graph = makeGraph([
      { id: "xyz-thing", prefix: "xyz", displayName: "Thing", file: "test.md", line: 1 },
    ]);
    const diags = checkC1(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C1");
  });

  it("ID without separator → C1 diagnostic", () => {
    const graph = makeGraph([
      { id: "nodash", prefix: "nodash", displayName: "NoDash", file: "test.md", line: 1 },
    ]);
    const diags = checkC1(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C1");
  });

  it("multiple invalid IDs → multiple C1 diagnostics", () => {
    const graph = makeGraph([
      { id: "Mod-Parse", prefix: "Mod", displayName: "A", file: "a.md", line: 1 },
      { id: "xyz-thing", prefix: "xyz", displayName: "B", file: "b.md", line: 1 },
    ]);
    expect(checkC1(graph)).toHaveLength(2);
  });

  it("empty graph → no diagnostics", () => {
    const graph = makeGraph([]);
    expect(checkC1(graph)).toHaveLength(0);
  });
});
