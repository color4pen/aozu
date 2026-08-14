/**
 * Tests for op-element implementation: TC-016, TC-025, TC-026
 *
 * Covers:
 *   TC Group 7: export permissions — op ID keys (TC-016)
 *   TC Group 10: generatePermissions behavior with targetLines (TC-025, TC-026)
 *
 * TC-016 uses the full parseFiles → buildGraph → generatePermissions pipeline
 * so that the key difference (brackets vs no brackets in operation key) is
 * observable. Pre-implementation: key is "[[op-create-deal]]" → RED.
 *
 * TC-025 and TC-026 verify that generatePermissions still emits the correct
 * target field after the permTargets → targetLines refactoring.
 */

import { describe, expect, it } from "bun:test";
import { parseFiles } from "../parse/parser.ts";
import { buildGraph } from "../graph/builder.ts";
import { generatePermissions } from "./permissions.ts";

// ---------------------------------------------------------------------------
// TC Group 7: export permissions — op ID keys
// ---------------------------------------------------------------------------

describe("TC-016: export permissions outputs op ID keys in lexicographic order", () => {
  it("TC-016: operations keys are op IDs (not brackets-wrapped tokens), sorted lexicographically", () => {
    // After implementation: PERM_OPERATION_LINE_RE matches [[op-id]] and strips brackets.
    //   operation field = "op-create-deal" → generatePermissions key = "op-create-deal".
    // Pre-implementation: PERM_OPERATION_LINE_RE captures "[[op-create-deal]]" (with brackets).
    //   key = "[[op-create-deal]]" ≠ "op-create-deal" → RED.
    const files = [
      {
        path: "domain/operations.md",
        content: [
          "## 案件作成 {#op-create-deal}",
          "",
          "## 案件リスト {#op-list-deals}",
        ].join("\n"),
      },
      {
        path: "domain/actors.md",
        content: "## 管理者 {#act-admin}\n",
      },
      {
        path: "views/permission/deal.md",
        content: [
          "## 案件許可 {#perm-deal}",
          "",
          "- [[op-create-deal]]: [[act-admin]]",
          "- [[op-list-deals]]: [[act-admin]]",
        ].join("\n"),
      },
    ];

    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);

    expect(output.permissions).toHaveLength(1);
    const keys = Object.keys(output.permissions[0].operations);
    // Lexicographic order: op-create-deal < op-list-deals
    expect(keys).toEqual(["op-create-deal", "op-list-deals"]);
  });
});

// ---------------------------------------------------------------------------
// TC Group 10 (should): generatePermissions target field behavior
// ---------------------------------------------------------------------------

describe("TC-025: generatePermissions omits target field when perm has no 対象: line", () => {
  it("TC-025: perm with no 対象: line → target field absent from output", () => {
    // Regression test: after permTargets → targetLines refactoring, generatePermissions
    // should still omit the target field when no 対象: line is present.
    const files = [
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
          "",
          "- [[op-create-deal]]: [[act-admin]]",
        ].join("\n"),
      },
    ];

    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);

    expect(output.permissions).toHaveLength(1);
    expect("target" in output.permissions[0]).toBe(false);
  });
});

describe("TC-026: generatePermissions includes target field when perm has single 対象: line", () => {
  it("TC-026: 対象: [[ent-deal]] on perm → target: 'ent-deal' in output", () => {
    // Regression test: after permTargets → targetLines refactoring, generatePermissions
    // should still include the target field from a single 対象: line.
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
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);

    expect(output.permissions[0].target).toBe("ent-deal");
  });
});
