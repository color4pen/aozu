import { describe, expect, it } from "bun:test";
import {
  extractReferences,
  extractRefsFromLine,
  stripInlineCode,
} from "./references.ts";

describe("stripInlineCode", () => {
  it("removes inline code span", () => {
    expect(stripInlineCode("see `[[mod-parse]]` here")).toBe("see  here");
  });

  it("preserves text outside backticks", () => {
    expect(stripInlineCode("refer to [[mod-cli]]")).toBe("refer to [[mod-cli]]");
  });

  it("removes multiple inline code spans", () => {
    expect(stripInlineCode("`a` and `b`")).toBe(" and ");
  });
});

describe("extractRefsFromLine", () => {
  it("extracts a single reference", () => {
    expect(extractRefsFromLine("see [[mod-parse]]")).toEqual(["mod-parse"]);
  });

  it("TC-021: multiple [[id]] references on the same line are all extracted", () => {
    const refs = extractRefsFromLine("[[mod-cli]] calls [[mod-parse]] via [[mod-graph]]");
    expect(refs).toEqual(["mod-cli", "mod-parse", "mod-graph"]);
  });

  it("ignores reference in inline code", () => {
    expect(extractRefsFromLine("use `[[mod-parse]]` syntax")).toEqual([]);
  });

  it("TC-022: inline code and normal reference coexist correctly on the same line", () => {
    const refs = extractRefsFromLine("see `[[mod-parse]]` and [[mod-cli]]");
    expect(refs).toEqual(["mod-cli"]);
  });
});

describe("extractReferences", () => {
  it("extracts references from normal content", () => {
    const content = "See [[mod-parse]] for details.\n[[mod-cli]] handles it.";
    const refs = extractReferences(content, "test.md");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ targetId: "mod-parse", file: "test.md", line: 1 });
    expect(refs[1]).toEqual({ targetId: "mod-cli", file: "test.md", line: 2 });
  });

  it("TC-006: code fence exclusion suppresses [[id]] extraction", () => {
    const content = [
      "Normal [[mod-cli]] reference.",
      "```",
      "[[mod-parse]] inside fence",
      "```",
      "After fence [[mod-graph]]",
    ].join("\n");
    const refs = extractReferences(content, "test.md");
    const ids = refs.map((r) => r.targetId);
    expect(ids).toContain("mod-cli");
    expect(ids).toContain("mod-graph");
    expect(ids).not.toContain("mod-parse");
  });

  it("excludes inline code references", () => {
    const content = "Grammar is `[[id]]` syntax.\nSee [[mod-cli]] for real.";
    const refs = extractReferences(content, "test.md");
    const ids = refs.map((r) => r.targetId);
    expect(ids).not.toContain("id");
    expect(ids).toContain("mod-cli");
  });

  it("toggles code fence with language specifier", () => {
    const content = [
      "```markdown",
      "[[mod-parse]] is in a fence",
      "```",
      "[[mod-cli]] is outside",
    ].join("\n");
    const refs = extractReferences(content, "test.md");
    const ids = refs.map((r) => r.targetId);
    expect(ids).not.toContain("mod-parse");
    expect(ids).toContain("mod-cli");
  });

  it("attaches file and 1-based line numbers", () => {
    const content = "line1\n[[mod-cli]]\nline3";
    const refs = extractReferences(content, "my/file.md");
    expect(refs[0]!.file).toBe("my/file.md");
    expect(refs[0]!.line).toBe(2);
  });

  it("handles multiple references on one line with inline code mixed", () => {
    const content = "`[[mod-parse]]` is syntax; [[mod-cli]] is a real ref.";
    const refs = extractReferences(content, "test.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.targetId).toBe("mod-cli");
  });
});
