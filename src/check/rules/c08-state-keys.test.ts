import { describe, expect, it } from "bun:test";
import { checkC8 } from "./c08-state-keys.ts";
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
    implementations: [],
    permOperations: [],
    targetLines: [],
    malformedPermOperations: [],
  };
  return buildGraph(parsed);
}

describe("checkC8: state.json key validation", () => {
  it("all state keys exist → no diagnostics", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
    ]);
    expect(checkC8(graph, ["mod-cli", "ent-order"])).toHaveLength(0);
  });

  it("TC-017: stale state key → C8 diagnostic", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
    ]);
    const diags = checkC8(graph, ["mod-cli", "ent-deleted"]);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C8");
    expect(diags[0]!.elementId).toBe("ent-deleted");
    expect(diags[0]!.level).toBe("error");
  });

  it("empty stateKeys → no diagnostics", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
    ]);
    expect(checkC8(graph, [])).toHaveLength(0);
  });

  it("multiple stale keys → multiple C8 diagnostics", () => {
    const graph = makeGraph([]);
    const diags = checkC8(graph, ["mod-deleted", "ent-deleted"]);
    expect(diags).toHaveLength(2);
  });
});
