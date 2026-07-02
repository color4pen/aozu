import { describe, expect, it } from "bun:test";
import { extractStructuredLines } from "./structured-lines.ts";

describe("extractStructuredLines", () => {
  it("extracts 責務: value", () => {
    const content = "## CLI {#mod-cli}\n責務: コマンド解釈";
    const result = extractStructuredLines(content, "modules.md");
    expect(result.responsibilities).toHaveLength(1);
    expect(result.responsibilities[0]!.value).toBe("コマンド解釈");
    expect(result.responsibilities[0]!.line).toBe(2);
  });

  it("extracts 実装: comma-separated paths", () => {
    const content = "実装: src/cli/, src/core/";
    const result = extractStructuredLines(content, "modules.md");
    expect(result.implementations).toHaveLength(1);
    expect(result.implementations[0]!.paths).toEqual(["src/cli/", "src/core/"]);
  });

  it("extracts dependency edge from `- [[a]] -> [[b]]`", () => {
    const content = "- [[mod-cli]] -> [[mod-parse]]";
    const result = extractStructuredLines(content, "dependencies.md");
    expect(result.dependencyEdges).toHaveLength(1);
    const edge = result.dependencyEdges[0]!;
    expect(edge.from).toBe("mod-cli");
    expect(edge.to).toBe("mod-parse");
    expect(edge.file).toBe("dependencies.md");
    expect(edge.line).toBe(1);
  });

  it("extracts multiple dependency edges", () => {
    const content = [
      "- [[mod-cli]] -> [[mod-parse]]",
      "- [[mod-cli]] -> [[mod-graph]]",
      "- [[mod-check]] -> [[mod-graph]]",
    ].join("\n");
    const result = extractStructuredLines(content, "dependencies.md");
    expect(result.dependencyEdges).toHaveLength(3);
  });

  it("extracts actor IDs from ## 登場要素 section", () => {
    const content = [
      "## 登場要素",
      "- [[mod-cli]]",
      "- [[mod-parse]]",
      "- [[mod-graph]]",
      "",
      "## 流れ",
      "some text",
    ].join("\n");
    const result = extractStructuredLines(content, "closure-check.md");
    const ids = result.actorIds.map((a) => a.id);
    expect(ids).toContain("mod-cli");
    expect(ids).toContain("mod-parse");
    expect(ids).toContain("mod-graph");
    expect(result.actorIds).toHaveLength(3);
  });

  it("stops actor section at next ## heading", () => {
    const content = [
      "## 登場要素",
      "- [[mod-cli]]",
      "## 流れ",
      "- [[mod-parse]]",
    ].join("\n");
    const result = extractStructuredLines(content, "test.md");
    // Only mod-cli should be in actorIds; mod-parse is in 流れ section
    const ids = result.actorIds.map((a) => a.id);
    expect(ids).toContain("mod-cli");
    expect(ids).not.toContain("mod-parse");
  });

  it("extracts elements: line IDs", () => {
    const content = "- elements: [[ent-order]], [[inv-3]]";
    const result = extractStructuredLines(content, "plan.md");
    const ids = result.elementItems.map((e) => e.id);
    expect(ids).toContain("ent-order");
    expect(ids).toContain("inv-3");
  });

  it("returns empty result for plain content", () => {
    const content = "# Plain heading\n\nJust some text.";
    const result = extractStructuredLines(content, "test.md");
    expect(result.dependencyEdges).toHaveLength(0);
    expect(result.actorIds).toHaveLength(0);
    expect(result.responsibilities).toHaveLength(0);
    expect(result.implementations).toHaveLength(0);
    expect(result.elementItems).toHaveLength(0);
  });
});
