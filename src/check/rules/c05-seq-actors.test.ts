import { describe, expect, it } from "bun:test";
import { checkC5 } from "./c05-seq-actors.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(
  elements: ParseResult["elements"],
  actorIds: ParseResult["actorIds"]
) {
  const parsed: ParseResult = {
    elements,
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds,
    elementItems: [],
    implementations: [],
  };
  return buildGraph(parsed);
}

describe("checkC5: seq actor lists", () => {
  it("seq with mod-only actors → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "seq-order-intake", prefix: "seq", displayName: "Order Intake", file: "seq.md", line: 1 }],
      [
        { id: "mod-cli", file: "seq.md", line: 5 },
        { id: "mod-parse", file: "seq.md", line: 6 },
      ]
    );
    expect(checkC5(graph)).toHaveLength(0);
  });

  it("TC-012: seq with empty actor list → C5 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "seq-order-intake", prefix: "seq", displayName: "Order Intake", file: "seq.md", line: 1 }],
      []  // no actors
    );
    const diags = checkC5(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C5");
    expect(diags[0]!.elementId).toBe("seq-order-intake");
    expect(diags[0]!.level).toBe("error");
  });

  it("seq with non-mod actor → C5 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "seq-order-intake", prefix: "seq", displayName: "Order Intake", file: "seq.md", line: 1 }],
      [
        { id: "mod-cli", file: "seq.md", line: 5 },
        { id: "ent-order", file: "seq.md", line: 6 },
      ]
    );
    const diags = checkC5(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C5");
    expect(diags[0]!.elementId).toBe("seq-order-intake");
    expect(diags[0]!.message).toContain("ent-order");
  });

  it("no seq elements → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      []
    );
    expect(checkC5(graph)).toHaveLength(0);
  });

  it("multiple seq elements with mixed issues → reports each", () => {
    const graph = makeGraph(
      [
        { id: "seq-a", prefix: "seq", displayName: "Seq A", file: "a.md", line: 1 },
        { id: "seq-b", prefix: "seq", displayName: "Seq B", file: "b.md", line: 1 },
      ],
      [
        { id: "mod-cli", file: "a.md", line: 5 },
        // b.md has no actors
      ]
    );
    const diags = checkC5(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.elementId).toBe("seq-b");
  });
});
