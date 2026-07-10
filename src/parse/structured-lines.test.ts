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

// ---------------------------------------------------------------------------
// T-10: perm operation lines and target lines
// ---------------------------------------------------------------------------

describe("extractStructuredLines: perm operation lines and target lines", () => {
  it("parses operation line with multiple actorIds", () => {
    const content = "- create: [[act-admin]], [[act-manager]]";
    const result = extractStructuredLines(content, "test.md");
    expect(result.permOperations).toHaveLength(1);
    expect(result.permOperations[0]!.operation).toBe("create");
    expect(result.permOperations[0]!.actorIds).toEqual(["act-admin", "act-manager"]);
    expect(result.permOperations[0]!.file).toBe("test.md");
    expect(result.permOperations[0]!.line).toBe(1);
  });

  it("parses operation line with single actorId", () => {
    const content = "- list: [[act-admin]]";
    const result = extractStructuredLines(content, "test.md");
    expect(result.permOperations).toHaveLength(1);
    expect(result.permOperations[0]!.operation).toBe("list");
    expect(result.permOperations[0]!.actorIds).toEqual(["act-admin"]);
  });

  it("parses target line (対象:)", () => {
    const content = "対象: [[ent-deal]]";
    const result = extractStructuredLines(content, "test.md");
    expect(result.permTargets).toHaveLength(1);
    expect(result.permTargets[0]!.targetId).toBe("ent-deal");
    expect(result.permTargets[0]!.file).toBe("test.md");
    expect(result.permTargets[0]!.line).toBe(1);
  });

  it("ignores operation lines inside code fence", () => {
    const content = [
      "```",
      "- create: [[act-admin]]",
      "```",
    ].join("\n");
    const result = extractStructuredLines(content, "test.md");
    expect(result.permOperations).toHaveLength(0);
  });

  it("ignores target lines inside code fence", () => {
    const content = [
      "```",
      "対象: [[ent-deal]]",
      "```",
    ].join("\n");
    const result = extractStructuredLines(content, "test.md");
    expect(result.permTargets).toHaveLength(0);
  });

  it("plain bullet point is not recognized as operation line", () => {
    const content = "- some text without brackets";
    const result = extractStructuredLines(content, "test.md");
    expect(result.permOperations).toHaveLength(0);
  });

  it("operation line with colon in operation token is not recognized", () => {
    // A line like `- foo:bar: [[act-admin]]` — the operation cannot contain `:`
    // so this should not match the operation line pattern
    // (the regex requires `[^\s:]+` before the first `:`)
    // Actually `foo` would be the operation and `bar: [[act-admin]]` the rest
    // but `bar: [[act-admin]]` doesn't start with `[[`, so no match
    const content = "- foo:bar: [[act-admin]]";
    const result = extractStructuredLines(content, "test.md");
    // operation `foo` with rest `bar: [[act-admin]]` — doesn't start with [[
    // so this is NOT matched as an operation line
    expect(result.permOperations).toHaveLength(0);
  });

  it("parses multiple operation lines for a perm element", () => {
    const content = [
      "## Deal Permissions {#perm-deal}",
      "対象: [[ent-deal]]",
      "",
      "- list: [[act-admin]], [[act-manager]], [[act-member]], [[act-finance]]",
      "- create: [[act-admin]], [[act-manager]]",
    ].join("\n");
    const result = extractStructuredLines(content, "perm.md");
    expect(result.permOperations).toHaveLength(2);
    expect(result.permOperations[0]!.operation).toBe("list");
    expect(result.permOperations[0]!.actorIds).toEqual(["act-admin", "act-manager", "act-member", "act-finance"]);
    expect(result.permOperations[1]!.operation).toBe("create");
    expect(result.permOperations[1]!.actorIds).toEqual(["act-admin", "act-manager"]);
    expect(result.permTargets).toHaveLength(1);
    expect(result.permTargets[0]!.targetId).toBe("ent-deal");
  });

  it("existing structured lines (dep edge) are still recognized alongside perm lines", () => {
    const content = [
      "- [[mod-cli]] -> [[mod-parse]]",
      "- create: [[act-admin]]",
    ].join("\n");
    const result = extractStructuredLines(content, "test.md");
    expect(result.dependencyEdges).toHaveLength(1);
    expect(result.dependencyEdges[0]!.from).toBe("mod-cli");
    expect(result.permOperations).toHaveLength(1);
    expect(result.permOperations[0]!.operation).toBe("create");
  });
});
