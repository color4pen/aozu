import { describe, expect, it } from "bun:test";
import { checkC3 } from "./c03-ref-resolved.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(
  elements: ParseResult["elements"],
  references: ParseResult["references"]
) {
  const parsed: ParseResult = {
    elements,
    references,
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
  };
  return buildGraph(parsed);
}

const ALL_PREFIXES = new Set(["mod", "term", "ent", "inv", "act", "seq", "top", "plan", "grp", "adr"]);
const STATIC_ONLY = new Set(["mod", "adr"]);

describe("checkC3: reference resolution", () => {
  it("all references resolved → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 },
      ],
      [{ targetId: "mod-parse", file: "modules.md", line: 3 }]
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("unresolved reference → C3 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      [{ targetId: "mod-nonexistent", file: "modules.md", line: 3 }]
    );
    const diags = checkC3(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.elementId).toBe("mod-nonexistent");
    expect(diags[0]!.level).toBe("error");
  });

  it("reference to disabled-type element → no C3 diagnostic", () => {
    // seq-foo is declared but dynamic is not enabled
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-foo", prefix: "seq", displayName: "Foo", file: "foo.md", line: 1 },
      ],
      [{ targetId: "seq-foo", file: "modules.md", line: 3 }]
    );
    // Only static enabled → seq prefix is not in enabledPrefixes
    expect(checkC3(graph, STATIC_ONLY)).toHaveLength(0);
  });

  it("reference from disabled-layer element → no C3 diagnostic", () => {
    // seq-foo refers to mod-nonexistent, but seq layer is disabled
    const graph = makeGraph(
      [
        { id: "seq-foo", prefix: "seq", displayName: "Foo", file: "foo.md", line: 1 },
      ],
      [{ targetId: "mod-nonexistent", file: "foo.md", line: 5 }]
    );
    // Only static + adr enabled, so seq elements' obligations are not evaluated
    expect(checkC3(graph, STATIC_ONLY)).toHaveLength(0);
  });

  it("empty references → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      []
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("unresolved act reference → C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        // act-approver is NOT declared
      ],
      [{ targetId: "act-nonexistent", file: "modules.md", line: 3 }]
    );
    const diags = checkC3(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.elementId).toBe("act-nonexistent");
    expect(diags[0]!.level).toBe("error");
  });

  it("resolved act reference → no C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      [{ targetId: "act-approver", file: "modules.md", line: 3 }]
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });
});
