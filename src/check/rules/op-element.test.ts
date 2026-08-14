/**
 * Tests for op-element implementation: TC-001 through TC-014
 *
 * Covers:
 *   TC Group 1: op prefix recognition (C1 / C3 / C11)
 *   TC Group 2: op target line — multiple references
 *   TC Group 3: perm target line — single-reference constraint
 *   TC Group 4: perm operation line — op reference
 *   TC Group 5: fail-closed — malformed operation lines
 *
 * NOTE: This file uses the post-implementation ParseResult shape
 * (targetLines / malformedPermOperations instead of permTargets).
 * It will fail to compile until the implementation adds those fields.
 */

import { describe, expect, it } from "bun:test";
import { buildGraph } from "../../graph/builder.ts";
import { parseFiles } from "../../parse/parser.ts";
import { runCheck } from "../index.ts";
import type { ParseResult } from "../../parse/types.ts";
import type { Manifest } from "../../graph/types.ts";

// ---------------------------------------------------------------------------
// Shared helper — uses the post-implementation ParseResult shape.
// Pre-implementation: fails to compile (targetLines / malformedPermOperations
// do not yet exist in ParseResult) → whole file is RED.
// ---------------------------------------------------------------------------

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
    // Post-implementation fields (replace permTargets):
    targetLines: [],
    malformedPermOperations: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

// ---------------------------------------------------------------------------
// TC Group 1: op prefix recognition (C1 / C3 / C11 / layer machinery)
// ---------------------------------------------------------------------------

describe("TC-001: op heading element declaration passes check", () => {
  it("TC-001: op heading element declaration exits 0 with no C1/C2/C3 diagnostics", () => {
    // After implementation: op is in KNOWN_PREFIXES → C1 passes.
    // Pre-implementation: op not in KNOWN_PREFIXES → C1 fires → diags > 0 → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    expect(diags).toHaveLength(0);
  });
});

describe("TC-002: op reference from domain element resolves without C11 violation", () => {
  it("TC-002: ent → op cross-reference in domain passes (domain→domain allowed)", () => {
    // After implementation: op in LAYER_MAP as domain → op is domain → domain→domain allowed.
    // Pre-implementation: op not in LAYER_MAP → C1 fires, C11 skips op source → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "ent-order",
          prefix: "ent",
          displayName: "Order",
          file: "domain/model.md",
          line: 1,
        },
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      references: [
        // ent-order body references [[op-confirm-order]]
        { targetId: "op-confirm-order", file: "domain/model.md", line: 3 },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    expect(diags).toHaveLength(0);
  });
});

describe("TC-003: op reference to static-layer element violates C11", () => {
  it("TC-003: op element referencing mod (static) triggers C11 error", () => {
    // After implementation: op is in domain layer → domain→static forbidden → C11 fires.
    // Pre-implementation: op not in LAYER_MAP → C11 skips → no C11 error → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "mod-cli",
          prefix: "mod",
          displayName: "CLI",
          file: "static/modules.md",
          line: 1,
        },
      ],
      references: [
        // op element body references [[mod-cli]] (domain → static: forbidden)
        { targetId: "mod-cli", file: "domain/operations.md", line: 3 },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    const c11Diags = diags.filter((d) => d.code === "C11");
    expect(c11Diags).toHaveLength(1);
    expect(c11Diags[0]!.elementId).toBe("op-confirm-order");
  });
});

describe("TC-004: unresolved op reference triggers C3", () => {
  it("TC-004: [[op-nonexistent]] reference exits 1 with C3 error", () => {
    // Whether op is a known prefix or not, C3 fires for an unresolved reference.
    // After implementation the message is "unresolved reference", pre-impl may say
    // "unknown prefix" — either way C3 fires, so this test is valid pre- and post-impl.
    const graph = makeGraph({
      elements: [
        {
          id: "ent-order",
          prefix: "ent",
          displayName: "Order",
          file: "domain/model.md",
          line: 1,
        },
      ],
      references: [
        // Reference to non-existent op element
        { targetId: "op-nonexistent", file: "domain/model.md", line: 3 },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    expect(diags.some((d) => d.code === "C3" && d.elementId === "op-nonexistent")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC Group 2: op target line — multiple references
// ---------------------------------------------------------------------------

describe("TC-005: op target line with multiple references passes check", () => {
  it("TC-005: 対象: with two ent references on an op element exits 0", () => {
    // After implementation: op recognized as domain → C1/C11 pass.
    // Pre-implementation: C1 fires for op-manage-order → diags > 0 → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "op-manage-order",
          prefix: "op",
          displayName: "受注管理",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "ent-order",
          prefix: "ent",
          displayName: "Order",
          file: "domain/model.md",
          line: 1,
        },
        {
          id: "ent-customer",
          prefix: "ent",
          displayName: "Customer",
          file: "domain/model.md",
          line: 5,
        },
      ],
      references: [
        // References from 対象: [[ent-order]], [[ent-customer]]
        { targetId: "ent-order", file: "domain/operations.md", line: 2 },
        { targetId: "ent-customer", file: "domain/operations.md", line: 2 },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    expect(diags).toHaveLength(0);
  });
});

describe("TC-006: op target line with unresolved reference triggers C3", () => {
  it("TC-006: 対象: with unresolved reference triggers C3 for ent-nonexistent", () => {
    // C3 fires for the unresolved reference regardless of op recognition state.
    const graph = makeGraph({
      elements: [
        {
          id: "op-manage-order",
          prefix: "op",
          displayName: "受注管理",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "ent-order",
          prefix: "ent",
          displayName: "Order",
          file: "domain/model.md",
          line: 1,
        },
        // ent-nonexistent is NOT declared
      ],
      references: [
        { targetId: "ent-order", file: "domain/operations.md", line: 2 },
        { targetId: "ent-nonexistent", file: "domain/operations.md", line: 2 },
      ],
    });
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain"] };
    const diags = runCheck(graph, manifest, []);
    expect(diags.some((d) => d.code === "C3" && d.elementId === "ent-nonexistent")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC Group 3: perm target line — single-reference constraint
// (Uses parseFiles to exercise the full parse → check pipeline.)
// ---------------------------------------------------------------------------

describe("TC-007: perm target line with single reference passes C6", () => {
  it("TC-007: 対象: [[ent-deal]] (single reference) on perm exits 0", () => {
    // A perm with a single-reference 対象: line and a valid operation line should pass.
    // After implementation: single ref → no C6 target error.
    // Pre-implementation: no target validation → also no error (positive/regression test).
    const files = [
      {
        path: "domain/model.md",
        content: "## 案件 {#ent-deal}\n",
      },
      {
        path: "domain/actors.md",
        content: "## 管理者 {#act-admin}\n",
      },
      {
        path: "domain/operations.md",
        content: "## 案件作成 {#op-create-deal}\n",
      },
      {
        path: "views/permission/deal.md",
        content: [
          "## 案件許可 {#perm-deal}",
          "対象: [[ent-deal]]",
          "",
          "- [[op-create-deal]]: [[act-admin]]",
        ].join("\n"),
      },
    ];
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    // No C6 diagnostic about the target line
    const targetC6 = diags.filter(
      (d) => d.code === "C6" && d.message.toLowerCase().includes("target")
    );
    expect(targetC6).toHaveLength(0);
  });
});

describe("TC-008: perm target line with multiple references triggers C6 error", () => {
  it("TC-008: 対象: [[ent-a]], [[ent-b]] (multiple references) on perm triggers C6", () => {
    // After implementation: multiple references → C6 error with line number.
    // Pre-implementation: 対象: line not matched by PERM_TARGET_LINE_RE → ignored → no error → RED.
    const files = [
      {
        path: "domain/model.md",
        content: "## A {#ent-a}\n\n## B {#ent-b}\n",
      },
      {
        path: "domain/actors.md",
        content: "## 管理者 {#act-admin}\n",
      },
      {
        path: "domain/operations.md",
        content: "## 案件作成 {#op-create-deal}\n",
      },
      {
        path: "views/permission/deal.md",
        content: [
          "## 案件許可 {#perm-deal}",
          "対象: [[ent-a]], [[ent-b]]",
          "",
          "- [[op-create-deal]]: [[act-admin]]",
        ].join("\n"),
      },
    ];
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    const c6Diags = diags.filter((d) => d.code === "C6");
    // Expect at least one C6 error related to the target line
    expect(
      c6Diags.some(
        (d) => d.message.includes("target") || d.message.includes("perm-deal")
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC Group 4: perm operation line — op reference
// ---------------------------------------------------------------------------

describe("TC-009: valid operation line with op and act references passes C6", () => {
  it("TC-009: - [[op-create-deal]]: [[act-admin]] with both elements existing → no C6 error", () => {
    // After implementation: op resolved, act resolved → C6 passes.
    // Pre-implementation: C6 only checks act prefix → also passes (positive/regression test).
    const graph = makeGraph({
      elements: [
        {
          id: "perm-deal",
          prefix: "perm",
          displayName: "Deal Permissions",
          file: "views/permission/deal.md",
          line: 1,
        },
        {
          id: "op-create-deal",
          prefix: "op",
          displayName: "Create Deal",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "act-admin",
          prefix: "act",
          displayName: "Admin",
          file: "domain/actors.md",
          line: 1,
        },
      ],
      permOperations: [
        {
          operation: "op-create-deal",
          actorIds: ["act-admin"],
          file: "views/permission/deal.md",
          line: 3,
        },
      ],
    });
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    // No C6 errors (ignore C1 for op prefix pre-impl)
    const c6Diags = diags.filter((d) => d.code === "C6");
    expect(c6Diags).toHaveLength(0);
  });
});

describe("TC-010: unresolved op reference in operation line triggers C6 error", () => {
  it("TC-010: - [[op-nonexistent]]: [[act-admin]] → C6 error for unresolved op", () => {
    // After implementation: C6 checks if op-nonexistent exists → not found → C6 error.
    // Pre-implementation: C6 doesn't check op existence → no error → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "perm-deal",
          prefix: "perm",
          displayName: "Deal Permissions",
          file: "views/permission/deal.md",
          line: 1,
        },
        {
          id: "act-admin",
          prefix: "act",
          displayName: "Admin",
          file: "domain/actors.md",
          line: 1,
        },
        // op-nonexistent is NOT declared
      ],
      permOperations: [
        {
          operation: "op-nonexistent",
          actorIds: ["act-admin"],
          file: "views/permission/deal.md",
          line: 3,
        },
      ],
    });
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    const c6Diags = diags.filter((d) => d.code === "C6" && d.elementId === "perm-deal");
    expect(
      c6Diags.some(
        (d) => d.message.includes("unresolved") || d.message.includes("op-nonexistent")
      )
    ).toBe(true);
  });
});

describe("TC-011: non-op prefix in operation line triggers C6 error", () => {
  it("TC-011: - [[ent-order]]: [[act-admin]] (ent is not op) → C6 error", () => {
    // After implementation: C6 checks op prefix → ent-order has prefix ent → C6 error.
    // Pre-implementation: C6 doesn't check operation prefix → no error → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "perm-deal",
          prefix: "perm",
          displayName: "Deal Permissions",
          file: "views/permission/deal.md",
          line: 1,
        },
        {
          id: "ent-order",
          prefix: "ent",
          displayName: "Order",
          file: "domain/model.md",
          line: 1,
        },
        {
          id: "act-admin",
          prefix: "act",
          displayName: "Admin",
          file: "domain/actors.md",
          line: 1,
        },
      ],
      permOperations: [
        {
          operation: "ent-order",
          actorIds: ["act-admin"],
          file: "views/permission/deal.md",
          line: 3,
        },
      ],
    });
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    const c6Diags = diags.filter((d) => d.code === "C6" && d.elementId === "perm-deal");
    expect(
      c6Diags.some(
        (d) =>
          d.message.includes("not an op") ||
          d.message.includes("ent-order") ||
          d.message.includes("operation reference")
      )
    ).toBe(true);
  });
});

describe("TC-012: duplicate op reference within same perm triggers exactly one C6 error", () => {
  it("TC-012: two op-create-deal lines in perm-deal → exactly 1 C6 error, no other errors", () => {
    // After implementation: C1 passes for op-create-deal (op is valid prefix).
    //   C6 fires exactly 1 duplicate error. Total diags = 1.
    // Pre-implementation: C1 fires for op-create-deal + C6 fires duplicate → total > 1 → RED.
    const graph = makeGraph({
      elements: [
        {
          id: "perm-deal",
          prefix: "perm",
          displayName: "Deal Permissions",
          file: "views/permission/deal.md",
          line: 1,
        },
        {
          id: "op-create-deal",
          prefix: "op",
          displayName: "Create Deal",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "act-admin",
          prefix: "act",
          displayName: "Admin",
          file: "domain/actors.md",
          line: 1,
        },
      ],
      permOperations: [
        {
          operation: "op-create-deal",
          actorIds: ["act-admin"],
          file: "views/permission/deal.md",
          line: 3,
        },
        {
          operation: "op-create-deal",
          actorIds: ["act-admin"],
          file: "views/permission/deal.md",
          line: 4,
        },
      ],
    });
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    // Exactly 1 diagnostic total, and it must be C6
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C6");
    expect(diags[0]!.message).toMatch(/duplicate/);
  });
});

// ---------------------------------------------------------------------------
// TC Group 5: fail-closed — malformed operation lines
// (Uses parseFiles to exercise parser → structured-lines → C6 pipeline.)
// ---------------------------------------------------------------------------

describe("TC-013: free-token operation line triggers C6 error", () => {
  it("TC-013: - create: [[act-admin]] (free token, not [[op-id]]) → C6 error", () => {
    // After implementation: parser puts this in malformedPermOperations → C6 fires.
    // Pre-implementation: parser puts in permOperations with operation="create" → C6 passes (valid act) → RED.
    const files = [
      {
        path: "domain/actors.md",
        content: "## 管理者 {#act-admin}\n",
      },
      {
        path: "views/permission/deal.md",
        content: [
          "## 案件許可 {#perm-deal}",
          "",
          "- create: [[act-admin]]",
        ].join("\n"),
      },
    ];
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    const c6Diags = diags.filter((d) => d.code === "C6");
    expect(c6Diags.length).toBeGreaterThan(0);
  });
});

describe("TC-014: perm with only malformed lines produces exactly two C6 errors", () => {
  it("TC-014: perm with only `- create: [[act-admin]]` → malformed error + non-empty error", () => {
    // After implementation: 2 C6 errors (malformed line + non-empty obligation).
    // Pre-implementation: 0 C6 errors (old parser sees valid operation) → RED.
    const files = [
      {
        path: "domain/actors.md",
        content: "## 管理者 {#act-admin}\n",
      },
      {
        path: "views/permission/deal.md",
        content: [
          "## 案件許可 {#perm-deal}",
          "",
          "- create: [[act-admin]]",
        ].join("\n"),
      },
    ];
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const manifest: Manifest = {
      formatVersion: "0",
      enabled: ["static", "domain", "permission"],
    };
    const diags = runCheck(graph, manifest, []);
    const c6Diags = diags.filter((d) => d.code === "C6");
    expect(c6Diags).toHaveLength(2);
  });
});
