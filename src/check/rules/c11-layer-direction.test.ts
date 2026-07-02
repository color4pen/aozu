import { describe, expect, it } from "bun:test";
import { checkC11 } from "./c11-layer-direction.ts";
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
const STATIC_DOMAIN = new Set(["mod", "term", "ent", "inv", "act", "adr"]);
const STATIC_ONLY = new Set(["mod", "adr"]);

describe("checkC11: cross-layer reference direction", () => {
  it("domain → domain reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "term-order", prefix: "term", displayName: "Order", file: "glossary.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order Ent", file: "model.md", line: 1 },
      ],
      [{ targetId: "term-order", file: "model.md", line: 3 }]
    );
    expect(checkC11(graph, STATIC_DOMAIN)).toHaveLength(0);
  });

  it("domain → mod reference → C11 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "term-order", prefix: "term", displayName: "Order", file: "glossary.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      [{ targetId: "mod-cli", file: "glossary.md", line: 3 }]
    );
    const diags = checkC11(graph, STATIC_DOMAIN);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("domain");
    expect(diags[0]!.message).toContain("mod");
  });

  it("static → domain reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "mod-check", prefix: "mod", displayName: "Check", file: "modules.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
      ],
      [{ targetId: "ent-order", file: "modules.md", line: 3 }]
    );
    expect(checkC11(graph, STATIC_DOMAIN)).toHaveLength(0);
  });

  it("TC-048: static → seq reference → C11 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
      ],
      [{ targetId: "seq-order", file: "modules.md", line: 3 }]
    );
    const diags = checkC11(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
  });

  it("dynamic → static/domain reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "seq-order-intake", prefix: "seq", displayName: "Order Intake", file: "dynamic/order.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "term-order", prefix: "term", displayName: "Order", file: "glossary.md", line: 1 },
      ],
      [
        { targetId: "mod-cli", file: "dynamic/order.md", line: 5 },
        { targetId: "term-order", file: "dynamic/order.md", line: 6 },
      ]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("adr → any reference → no diagnostics (no restriction)", () => {
    const graph = makeGraph(
      [
        { id: "adr-0001-decision", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
      ],
      [
        { targetId: "mod-cli", file: "adr/0001.md", line: 3 },
        { targetId: "seq-order", file: "adr/0001.md", line: 4 },
      ]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("disabled layer references are not checked", () => {
    // seq references mod — normally ok, but seq is not in enabledPrefixes
    const graph = makeGraph(
      [
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      [{ targetId: "mod-cli", file: "dynamic/order.md", line: 5 }]
    );
    // Only static enabled; seq references are skipped
    expect(checkC11(graph, STATIC_ONLY)).toHaveLength(0);
  });

  it("loop → any reference → no diagnostics (no restriction)", () => {
    const graph = makeGraph(
      [
        { id: "top-issue", prefix: "top", displayName: "Issue", file: "topics/issue.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
      ],
      [
        { targetId: "mod-cli", file: "topics/issue.md", line: 3 },
        { targetId: "seq-order", file: "topics/issue.md", line: 4 },
      ]
    );
    const loopPrefixes = new Set(["mod", "term", "ent", "inv", "act", "seq", "top", "plan", "grp", "adr"]);
    expect(checkC11(graph, loopPrefixes)).toHaveLength(0);
  });

  it("domain (act) → domain (term) reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
        { id: "term-order", prefix: "term", displayName: "Order", file: "glossary.md", line: 1 },
      ],
      [{ targetId: "term-order", file: "actors.md", line: 3 }]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("domain (act) → mod reference → C11 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      [{ targetId: "mod-cli", file: "actors.md", line: 3 }]
    );
    const diags = checkC11(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("domain");
    expect(diags[0]!.message).toContain("mod");
  });

  it("static (mod) → act reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      [{ targetId: "act-approver", file: "modules.md", line: 3 }]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("dynamic (seq) → act reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "seq-approval-flow", prefix: "seq", displayName: "Approval Flow", file: "dynamic/approval.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      [{ targetId: "act-approver", file: "dynamic/approval.md", line: 5 }]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });
});
