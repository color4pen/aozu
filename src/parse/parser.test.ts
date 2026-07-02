import { describe, expect, it } from "bun:test";
import { parseFiles } from "./parser.ts";
import type { FileInput } from "./types.ts";

describe("parseFiles", () => {
  it("returns empty result for empty input", () => {
    const result = parseFiles([]);
    expect(result.elements).toHaveLength(0);
    expect(result.references).toHaveLength(0);
    expect(result.dependencyEdges).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.frontmatters.size).toBe(0);
  });

  it("TC-011: parser API accepts in-memory input without file I/O", () => {
    const file: FileInput = {
      path: "test/modules.md",
      content: [
        "## CLI {#mod-cli}",
        "責務: コマンド解釈",
        "実装: src/cli/",
        "",
        "See [[mod-parse]] for parsing.",
      ].join("\n"),
    };
    const result = parseFiles([file]);
    expect(result.elements.map((e) => e.id)).toContain("mod-cli");
    expect(result.references.map((r) => r.targetId)).toContain("mod-parse");
    expect(result.frontmatters.has("test/modules.md")).toBe(true);
  });

  it("TC-030: multiple file parse results are correctly merged into a single ParseResult", () => {
    const files: FileInput[] = [
      {
        path: "a.md",
        content: "## Element A {#mod-cli}\n[[ent-element]]",
      },
      {
        path: "b.md",
        content: "## Element B {#mod-parse}\n[[mod-cli]]",
      },
    ];
    const result = parseFiles(files);
    const ids = result.elements.map((e) => e.id);
    expect(ids).toContain("mod-cli");
    expect(ids).toContain("mod-parse");
    const refIds = result.references.map((r) => r.targetId);
    expect(refIds).toContain("ent-element");
    expect(refIds).toContain("mod-cli");
  });

  it("parses frontmatter document element", () => {
    const file: FileInput = {
      path: "seq.md",
      content: "---\nid: seq-closure-check\n---\n# 閉包検証",
    };
    const result = parseFiles([file]);
    expect(result.elements[0]!.id).toBe("seq-closure-check");
    expect(result.elements[0]!.displayName).toBe("閉包検証");
  });

  it("parses dependency edges", () => {
    const file: FileInput = {
      path: "deps.md",
      content: "- [[mod-cli]] -> [[mod-parse]]\n- [[mod-check]] -> [[mod-graph]]",
    };
    const result = parseFiles([file]);
    expect(result.dependencyEdges).toHaveLength(2);
    expect(result.dependencyEdges[0]!.from).toBe("mod-cli");
    expect(result.dependencyEdges[0]!.to).toBe("mod-parse");
  });

  it("collects diagnostics from all files", () => {
    const files: FileInput[] = [
      {
        path: "a.md",
        content: "## Bad ID {#Mod-Parse}\n",
      },
      {
        path: "b.md",
        content: "---\nid: BAD-ID\n---\n",
      },
    ];
    const result = parseFiles(files);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
