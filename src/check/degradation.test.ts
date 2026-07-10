/**
 * Graceful degradation tests.
 *
 * Verifies that rules for disabled layers are not evaluated, and that
 * view type fail-closed behavior works correctly.
 */

import { describe, expect, it } from "bun:test";
import { runCheck } from "./checker.ts";
import { buildGraph } from "../graph/builder.ts";
import type { ParseResult } from "../parse/types.ts";
import type { Manifest } from "../graph/types.ts";

function makeGraph(overrides: Partial<ParseResult> = {}) {
  const parsed: ParseResult = {
    elements: [],
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    permOperations: [],
    permTargets: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

// ---------------------------------------------------------------------------
// T-19: Graceful degradation — enabled: static only
// ---------------------------------------------------------------------------

describe("T-19: degradation — enabled: static only", () => {
  it("C5 (seq actors) is not evaluated when dynamic is disabled", () => {
    // A seq element with no actors would trigger C5 if dynamic were enabled
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
      ],
      actorIds: [], // empty actors for seq-order
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C5");
  });

  it("C8 (state keys) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    // stale key would trigger C8 if loop were enabled
    const diags = runCheck(graph, manifest(["static"]), ["ent-deleted"]);
    expect(diags.map((d) => d.code)).not.toContain("C8");
  });

  it("C9 (adr topics) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "adr-0001-x", prefix: "adr", displayName: "ADR", file: "adr/0001.md", line: 1 },
      ],
      references: [], // no top references → would trigger C9 if loop enabled
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C9");
  });

  it("C10 (plan elements) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
      ],
      elementItems: [
        { id: "ent-nonexistent", file: "plans/rework.md", line: 5 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C10");
  });

  it("C4 (dependency edges) IS evaluated when static is enabled", () => {
    // Non-mod endpoint triggers C4
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
      ],
      dependencyEdges: [
        { from: "ent-order", to: "mod-cli", file: "dependencies.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain"]));
    expect(diags.some((d) => d.code === "C4")).toBe(true);
  });

  it("C3 does not flag domain references when domain is disabled", () => {
    // mod-cli references term-closure, but domain is not enabled
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        // term-closure is declared but domain is disabled
        { id: "term-closure", prefix: "term", displayName: "Closure", file: "glossary.md", line: 1 },
      ],
      references: [
        // Reference from enabled (mod) to disabled (term) — should be skipped
        { targetId: "term-closure", file: "modules.md", line: 3 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    // term prefix not in enabled prefixes → no C3 for that reference
    expect(diags.map((d) => d.code)).not.toContain("C3");
  });

  it("C11 does not flag references from disabled-layer elements", () => {
    // seq-order references mod-cli — seq is disabled layer
    const graph = makeGraph({
      elements: [
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      references: [
        { targetId: "mod-cli", file: "dynamic/order.md", line: 5 },
      ],
    });
    // Only static enabled → seq elements' references not checked
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C11");
  });

  it("static-only fixture with only mod/adr elements → no diagnostics", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 },
      ],
      dependencyEdges: [
        { from: "mod-cli", to: "mod-parse", file: "dependencies.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// act degradation tests
// ---------------------------------------------------------------------------

describe("act degradation — domain disabled", () => {
  it("act reference with domain disabled → no C3 diagnostic", () => {
    // mod-workflow references act-approver, but domain is not enabled
    const graph = makeGraph({
      elements: [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      references: [
        // Reference from enabled (mod) to disabled (act) — should be skipped
        { targetId: "act-approver", file: "modules.md", line: 3 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    // act prefix not in enabled prefixes → no C3 for that reference
    expect(diags.map((d) => d.code)).not.toContain("C3");
  });

  it("act actor in seq with domain disabled → no C5 diagnostic for act prefix", () => {
    // seq element has act in actor list, but dynamic (and domain) are disabled
    // C5 itself is not evaluated when dynamic is disabled
    const graph = makeGraph({
      elements: [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "seq-approval", prefix: "seq", displayName: "Approval", file: "dynamic/approval.md", line: 1 },
      ],
      actorIds: [
        { id: "act-approver", file: "dynamic/approval.md", line: 5 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C5");
  });
});

// ---------------------------------------------------------------------------
// T-12: perm degeneration — permission not enabled
// ---------------------------------------------------------------------------

describe("T-12: perm degeneration — permission not enabled", () => {
  it("perm declaration in design with permission not enabled → no diagnostics (縮退)", () => {
    // perm-deal is declared but permission is not in enabled list
    // C3 should skip perm references (known but disabled type)
    // C6 should not fire for permission (not in enabled)
    // C11 should skip perm as target (not in enabledPrefixes)
    const graph = makeGraph({
      elements: [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      references: [
        // A reference to perm-deal from within the perm file itself — should be skipped
        { targetId: "perm-deal", file: "views/permission/deal.md", line: 5 },
      ],
      permOperations: [
        { operation: "create", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    // enabled: static, domain — no permission
    const diags = runCheck(graph, manifest(["static", "domain"]));
    // No C6, C3, C11 diagnostics about perm
    const permDiags = diags.filter(
      (d) => d.elementId?.startsWith("perm") || d.message.includes("perm")
    );
    expect(permDiags).toHaveLength(0);
  });

  it("permission not enabled → C6 does not trigger for permission type", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-empty", prefix: "perm", displayName: "Empty", file: "views/permission/empty.md", line: 1 },
      ],
      // No operation lines — would trigger C6 non-empty if permission were enabled
    });
    // permission NOT in enabled → C6 should not fire for permission
    const diags = runCheck(graph, manifest(["static", "domain"]));
    expect(diags.filter((d) => d.code === "C6")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-20: View type fail-closed
// ---------------------------------------------------------------------------

describe("T-20: view type fail-closed", () => {
  it("enabled: static, domain, use-case → C6 diagnostic for use-case", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain", "use-case"]));
    const c6 = diags.filter((d) => d.code === "C6");
    expect(c6).toHaveLength(1);
    expect(c6[0]!.message).toContain("unsupported view type");
    expect(c6[0]!.message).toContain("use-case");
  });

  it("multiple view types → one C6 per type", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "use-case", "screen"]));
    const c6 = diags.filter((d) => d.code === "C6");
    expect(c6).toHaveLength(2);
  });

  it("no view types → no C6 diagnostic", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain", "dynamic"]));
    expect(diags.some((d) => d.code === "C6")).toBe(false);
  });
});
