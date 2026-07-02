import { describe, expect, it } from "bun:test";
import { checkC9 } from "./c09-adr-topics.ts";
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
  };
  return buildGraph(parsed);
}

describe("checkC9: ADR topic references", () => {
  it("adr with top reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "adr-0001-decision", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 },
        { id: "top-problem", prefix: "top", displayName: "Problem", file: "topics/problem.md", line: 1 },
      ],
      [{ targetId: "top-problem", file: "adr/0001.md", line: 3 }]
    );
    expect(checkC9(graph)).toHaveLength(0);
  });

  it("adr without topic reference → C9 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "adr-0001-decision", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 }],
      []
    );
    const diags = checkC9(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C9");
    expect(diags[0]!.elementId).toBe("adr-0001-decision");
    expect(diags[0]!.level).toBe("error");
  });

  it("adr with only non-top references → C9 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "adr-0001-decision", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 }],
      [{ targetId: "mod-cli", file: "adr/0001.md", line: 5 }]
    );
    expect(checkC9(graph)).toHaveLength(1);
  });

  it("no adr elements → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      []
    );
    expect(checkC9(graph)).toHaveLength(0);
  });

  it("multiple adr elements, one missing topic → only one diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "adr-0001-ok", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 },
        { id: "adr-0002-bad", prefix: "adr", displayName: "ADR 0002", file: "adr/0002.md", line: 1 },
      ],
      [{ targetId: "top-problem", file: "adr/0001.md", line: 3 }]
    );
    const diags = checkC9(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.elementId).toBe("adr-0002-bad");
  });
});
