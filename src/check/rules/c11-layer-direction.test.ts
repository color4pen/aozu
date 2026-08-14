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
    permOperations: [],
    targetLines: [],
    malformedPermOperations: [],
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

  it("TC-008: domain (term) → act reference → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "term-order", prefix: "term", displayName: "Order", file: "glossary.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      [{ targetId: "act-approver", file: "glossary.md", line: 3 }]
    );
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
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

  it("T-12: perm → act reference → no C11 diagnostic (views can reference domain)", () => {
    const graph = makeGraph(
      [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
      ],
      [{ targetId: "act-admin", file: "views/permission/deal.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    expect(checkC11(graph, permEnabled)).toHaveLength(0);
  });

  it("T-12: perm → ent reference → no C11 diagnostic (views can reference domain)", () => {
    const graph = makeGraph(
      [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "domain/model.md", line: 1 },
      ],
      [{ targetId: "ent-order", file: "views/permission/deal.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    expect(checkC11(graph, permEnabled)).toHaveLength(0);
  });

  it("T-12: ent → perm reference → C11 diagnostic (domain cannot reference views)", () => {
    const graph = makeGraph(
      [
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "domain/model.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      [{ targetId: "perm-deal", file: "domain/model.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    const diags = checkC11(graph, permEnabled);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.message).toContain("domain");
    expect(diags[0]!.message).toContain("perm");
  });

  it("T-12: mod → perm reference → C11 diagnostic (static cannot reference views)", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "static/modules.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      [{ targetId: "perm-deal", file: "static/modules.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    const diags = checkC11(graph, permEnabled);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.message).toContain("static");
    expect(diags[0]!.message).toContain("perm");
  });

  it("T-12: seq → perm reference → C11 diagnostic (dynamic cannot reference views)", () => {
    const graph = makeGraph(
      [
        { id: "seq-approval", prefix: "seq", displayName: "Approval", file: "dynamic/approval.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      [{ targetId: "perm-deal", file: "dynamic/approval.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    const diags = checkC11(graph, permEnabled);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.message).toContain("dynamic");
    expect(diags[0]!.message).toContain("perm");
  });

  it("T-12: perm → mod reference → no C11 diagnostic (views can reference static)", () => {
    const graph = makeGraph(
      [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "static/modules.md", line: 1 },
      ],
      [{ targetId: "mod-workflow", file: "views/permission/deal.md", line: 3 }]
    );
    const permEnabled = new Set([...ALL_PREFIXES, "perm"]);
    expect(checkC11(graph, permEnabled)).toHaveLength(0);
  });

  it("T-12: perm not in enabledPrefixes → perm references not checked (degeneration)", () => {
    // When permission is not enabled, perm as target is not in enabledPrefixes → C11 skips
    const graph = makeGraph(
      [
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "domain/model.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      [{ targetId: "perm-deal", file: "domain/model.md", line: 3 }]
    );
    // perm NOT in enabledPrefixes (permission not enabled)
    expect(checkC11(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("multiple elements in file: violation in second section is attributed to second element", () => {
    // actors.md: act-sales at line 1, act-bad at line 10
    // Reference at line 15 (inside act-bad's section) → violates C11 (domain→mod)
    // Expected attribution: act-bad, NOT act-sales
    const graph = makeGraph(
      [
        { id: "act-sales", prefix: "act", displayName: "Sales", file: "actors.md", line: 1 },
        { id: "act-bad", prefix: "act", displayName: "Bad Actor", file: "actors.md", line: 10 },
        { id: "mod-sales", prefix: "mod", displayName: "Sales Module", file: "modules.md", line: 1 },
      ],
      [{ targetId: "mod-sales", file: "actors.md", line: 15 }]
    );
    const diags = checkC11(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C11");
    expect(diags[0]!.elementId).toBe("act-bad");
    expect(diags[0]!.message).toContain("act-bad");
  });
});
