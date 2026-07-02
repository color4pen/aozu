/**
 * Integration test: parse all `design/` documents and verify extraction counts
 * match tools/check.sh output (宣言 25 要素 / 参照 15 種).
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readMarkdownFiles } from "../fs/reader.ts";
import { parseFiles } from "./parser.ts";

const DESIGN_DIR = join(import.meta.dir, "../../design");

describe("design/ integration", () => {
  it("extracts exactly 25 declared elements", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    expect(result.elements).toHaveLength(25);
  });

  it("matches the expected 25 element IDs", async () => {
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

  it("extracts exactly 15 unique reference target IDs", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const uniqueTargets = [...new Set(result.references.map((r) => r.targetId))].sort();
    expect(uniqueTargets).toHaveLength(15);
  });

  it("matches the expected 15 unique reference target IDs", async () => {
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

  it("does not include inline-code [[id]] from design/domain/invariants.md as references", async () => {
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

  it("extracts exactly 16 dependency edges from design/static/dependencies.md", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    const depsEdges = result.dependencyEdges.filter((e) =>
      e.file.includes("dependencies.md")
    );
    expect(depsEdges).toHaveLength(16);
  });
});
