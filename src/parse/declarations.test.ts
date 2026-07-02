import { describe, expect, it } from "bun:test";
import { extractDeclarations } from "./declarations.ts";

describe("extractDeclarations", () => {
  it("TC-002: extracts h2 heading element", () => {
    const content = "## パーサ {#mod-parse}\n責務: strict プロファイルのパース";
    const result = extractDeclarations(content, "modules.md");
    expect(result.elements).toHaveLength(1);
    const el = result.elements[0]!;
    expect(el.id).toBe("mod-parse");
    expect(el.prefix).toBe("mod");
    expect(el.displayName).toBe("パーサ");
    expect(el.file).toBe("modules.md");
    expect(el.line).toBe(1);
  });

  it("TC-024: h3 heading (###) is extracted as an element declaration", () => {
    const content = "## Parent {#mod-parent}\n### Child {#inv-foo}\n";
    const result = extractDeclarations(content, "test.md");
    const ids = result.elements.map((e) => e.id);
    expect(ids).toContain("mod-parent");
    expect(ids).toContain("inv-foo");
  });

  it("TC-025: h1 heading (#) is NOT extracted as an element declaration", () => {
    const content = "# Title {#mod-title}\n## Sub {#mod-sub}";
    const result = extractDeclarations(content, "test.md");
    const ids = result.elements.map((e) => e.id);
    expect(ids).not.toContain("mod-title");
    expect(ids).toContain("mod-sub");
  });

  it("TC-003: document element extraction via frontmatter id field", () => {
    const content = `---
id: seq-closure-check
---
# 閉包検証の流れ`;
    const result = extractDeclarations(content, "closure-check.md");
    expect(result.elements).toHaveLength(1);
    const el = result.elements[0]!;
    expect(el.id).toBe("seq-closure-check");
    expect(el.prefix).toBe("seq");
    expect(el.displayName).toBe("閉包検証の流れ");
  });

  it("TC-026: invalid ID in heading yields element record AND diagnostic (no exception)", () => {
    const content = "## Foo {#Mod-Parse}\n";
    const result = extractDeclarations(content, "test.md");
    // Element is still emitted but diagnostic is added
    expect(result.elements).toHaveLength(1);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.severity).toBe("error");
    expect(result.diagnostics[0]!.line).toBe(1);
    expect(result.diagnostics[0]!.file).toBe("test.md");
  });

  it("reports diagnostic for invalid ID (underscore) in heading", () => {
    const content = "## Foo {#mod_parse}\n";
    const result = extractDeclarations(content, "test.md");
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("returns empty when no declarations", () => {
    const content = "# Just a title\n\nSome content.";
    const result = extractDeclarations(content, "test.md");
    expect(result.elements).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does not extract heading elements inside code fences", () => {
    const content = [
      "## Real {#mod-real}",
      "```",
      "## Fake {#mod-fake}",
      "```",
    ].join("\n");
    const result = extractDeclarations(content, "test.md");
    const ids = result.elements.map((e) => e.id);
    expect(ids).toContain("mod-real");
    expect(ids).not.toContain("mod-fake");
  });

  it("extracts display name from h1 for document element", () => {
    const content = `---
id: adr-0001-test
---
# My Decision Title`;
    const result = extractDeclarations(content, "adr.md");
    expect(result.elements[0]!.displayName).toBe("My Decision Title");
  });
});
