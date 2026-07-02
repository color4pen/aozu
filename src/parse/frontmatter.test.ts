import { describe, expect, it } from "bun:test";
import { parseFrontmatter } from "./frontmatter.ts";

describe("parseFrontmatter", () => {
  it("parses a simple flat frontmatter", () => {
    const content = `---
id: seq-closure-check
status: open
---
# Body`;
    const result = parseFrontmatter(content, "test.md");
    expect(result.record["id"]).toBe("seq-closure-check");
    expect(result.record["status"]).toBe("open");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.bodyStart).toBe(4);
  });

  it("converts comma-separated value to string array", () => {
    const content = `---
enabled: static, domain, dynamic
---`;
    const result = parseFrontmatter(content, "test.md");
    expect(result.record["enabled"]).toEqual(["static", "domain", "dynamic"]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("returns empty record when no frontmatter", () => {
    const content = `# Just a heading

Some content.`;
    const result = parseFrontmatter(content, "test.md");
    expect(result.record).toEqual({});
    expect(result.diagnostics).toHaveLength(0);
    expect(result.bodyStart).toBe(0);
  });

  it("reports diagnostic for indented (non-flat) line", () => {
    const content = `---
key:
  nested: value
---`;
    const result = parseFrontmatter(content, "test.md");
    // Either the key line or the indented line triggers a diagnostic
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.file).toBe("test.md");
    expect(result.diagnostics[0]!.severity).toBe("error");
  });

  it("handles unclosed frontmatter gracefully", () => {
    const content = `---
id: foo-bar
`;
    const result = parseFrontmatter(content, "test.md");
    // Should still parse what it can
    expect(result.record["id"]).toBe("foo-bar");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("reports position (file + line) in diagnostics", () => {
    const content = `---
key:
  bad: indent
---`;
    const result = parseFrontmatter(content, "path/to/file.md");
    expect(result.diagnostics[0]!.file).toBe("path/to/file.md");
    expect(typeof result.diagnostics[0]!.line).toBe("number");
    expect(result.diagnostics[0]!.line).toBeGreaterThan(0);
  });

  it("parses format-version correctly", () => {
    const content = `---
format-version: 0
enabled: static, domain, dynamic
---`;
    const result = parseFrontmatter(content, "manifest.md");
    expect(result.record["format-version"]).toBe("0");
    expect(result.record["enabled"]).toEqual(["static", "domain", "dynamic"]);
  });
});
