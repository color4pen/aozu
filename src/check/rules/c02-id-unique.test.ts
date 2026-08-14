import { describe, expect, it } from "bun:test";
import { checkC2 } from "./c02-id-unique.ts";
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

describe("checkC2: ID uniqueness", () => {
  it("unique IDs → no diagnostics", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "a.md", line: 1 },
      { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "a.md", line: 5 },
    ]);
    expect(checkC2(graph)).toHaveLength(0);
  });

  it("duplicate ID → C2 diagnostic for 2nd declaration", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI v1", file: "a.md", line: 1 },
      { id: "mod-cli", prefix: "mod", displayName: "CLI v2", file: "b.md", line: 3 },
    ]);
    const diags = checkC2(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C2");
    expect(diags[0]!.elementId).toBe("mod-cli");
    expect(diags[0]!.file).toBe("b.md");
    expect(diags[0]!.line).toBe(3);
    expect(diags[0]!.level).toBe("error");
  });

  it("triple duplicate → two C2 diagnostics", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI v1", file: "a.md", line: 1 },
      { id: "mod-cli", prefix: "mod", displayName: "CLI v2", file: "b.md", line: 1 },
      { id: "mod-cli", prefix: "mod", displayName: "CLI v3", file: "c.md", line: 1 },
    ]);
    expect(checkC2(graph)).toHaveLength(2);
  });

  it("empty graph → no diagnostics", () => {
    expect(checkC2(makeGraph([]))).toHaveLength(0);
  });

  it("C2 message mentions first declaration location", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", displayName: "CLI v1", file: "a.md", line: 10 },
      { id: "mod-cli", prefix: "mod", displayName: "CLI v2", file: "b.md", line: 2 },
    ]);
    const diag = checkC2(graph)[0]!;
    expect(diag.message).toContain("a.md");
    expect(diag.message).toContain("10");
  });
});
