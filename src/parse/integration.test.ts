/**
 * Integration test: parse all `design/` documents and verify extraction counts
 * match tools/check.sh output (宣言 26 要素 / 参照 16 種).
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readMarkdownFiles } from "../fs/reader.ts";
import { parseFiles } from "./parser.ts";

const DESIGN_DIR = join(import.meta.dir, "../../design");

describe("design/ integration", () => {
  it("TC-001: extracts exactly 26 declared elements", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    expect(result.elements).toHaveLength(26);
  });

  it("TC-033: exact 26-element ID regression list matches expected IDs", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const ids = result.elements.map((e) => e.id).sort();

    const expected = [
      "ent-artifact",
      "ent-element",
      "ent-manifest",
      "ent-reference",
      "ent-state-entry",
      "inv-deterministic-verdict",
      "inv-fail-closed-deps",
      "inv-immutable-id",
      "inv-single-reference-grammar",
      "inv-tool-writes-state",
      "mod-check",
      "mod-cli",
      "mod-diff",
      "mod-export",
      "mod-fsread",
      "mod-gitread",
      "mod-graph",
      "mod-parse",
      "mod-plan",
      "mod-prompt",
      "mod-state",
      "seq-closure-check",
      "seq-rules-export",
      "term-closure",
      "term-degradation",
      "term-frontier",
    ].sort();

    expect(ids).toEqual(expected);
  });

  it("TC-004: extracts exactly 16 unique reference target IDs", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const uniqueTargets = [...new Set(result.references.map((r) => r.targetId))].sort();
    expect(uniqueTargets).toHaveLength(16);
  });

  it("TC-034: exact 16 reference target ID regression list matches expected IDs", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const uniqueTargets = [...new Set(result.references.map((r) => r.targetId))].sort();

    const expected = [
      "ent-artifact",
      "ent-element",
      "ent-reference",
      "ent-state-entry",
      "mod-check",
      "mod-cli",
      "mod-diff",
      "mod-export",
      "mod-fsread",
      "mod-gitread",
      "mod-graph",
      "mod-parse",
      "mod-plan",
      "mod-prompt",
      "mod-state",
      "term-closure",
    ].sort();

    expect(uniqueTargets).toEqual(expected);
  });

  it("TC-005: inline code exclusion validated against invariants.md fixture", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);

    // invariants.md contains `[[id]]` in inline code — it must not appear in references
    const invariantsRefs = result.references.filter((r) =>
      r.file.includes("invariants.md")
    );
    const ids = invariantsRefs.map((r) => r.targetId);
    // The only real references in invariants.md are ent-element, ent-reference, ent-state-entry
    // The `[[id]]` in `` `[[id]]` `` must NOT appear
    expect(ids).not.toContain("id");
  });

  it("TC-007 TC-035: design/static/dependencies.md yields exactly 18 dependency edges", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const depsEdges = result.dependencyEdges.filter((e) =>
      e.file.includes("dependencies.md")
    );
    expect(depsEdges).toHaveLength(18);
  });
});
