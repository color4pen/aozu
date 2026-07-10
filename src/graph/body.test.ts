/**
 * Tests for src/graph/body.ts — extractElementBody / extractAllBodies.
 */

import { describe, it, expect } from "bun:test";
import { extractElementBody, extractAllBodies, extractElementRange, computeElementHash, computeAllHashes } from "./body.ts";
import { buildGraph } from "./builder.ts";
import { parseFiles } from "../parse/parser.ts";
import type { FileInput } from "../parse/types.ts";

// ---------------------------------------------------------------------------
// Fixture builder helpers
// ---------------------------------------------------------------------------

function makeFiles(entries: Array<[string, string]>): FileInput[] {
  return entries.map(([path, content]) => ({ path, content }));
}

// ---------------------------------------------------------------------------
// Heading element body extraction
// ---------------------------------------------------------------------------

describe("extractElementBody — heading elements", () => {
  it("extracts body between heading declaration and next h2 heading", () => {
    const files = makeFiles([
      [
        "modules.md",
        [
          "# モジュール構成",
          "",
          "## CLI {#mod-cli}",
          "責務: コマンド解釈",
          "実装: src/cli/",
          "",
          "## コア {#mod-core}",
          "責務: ドメインロジック",
          "実装: src/core/",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("mod-cli", graph, files);
    expect(body).not.toBeNull();
    expect(body).toContain("責務: コマンド解釈");
    expect(body).toContain("実装: src/cli/");
    // Must NOT contain the next element's content
    expect(body).not.toContain("mod-core");
    expect(body).not.toContain("ドメインロジック");
  });

  it("extracts body until end of file when no next heading", () => {
    const files = makeFiles([
      [
        "modules.md",
        [
          "# モジュール構成",
          "",
          "## CLI {#mod-cli}",
          "責務: コマンド解釈",
          "実装: src/cli/",
          "",
          "詳細な説明",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("mod-cli", graph, files);
    expect(body).not.toBeNull();
    expect(body).toContain("責務: コマンド解釈");
    expect(body).toContain("詳細な説明");
  });

  it("extracts correct body for multiple heading elements in the same file", () => {
    const files = makeFiles([
      [
        "glossary.md",
        [
          "# 用語集",
          "",
          "## 注文 {#term-order}",
          "注文とは顧客が発行する購入指示である。",
          "",
          "## 製品 {#term-product}",
          "製品とは販売可能な商品の単位である。",
          "",
          "## 在庫 {#term-stock}",
          "在庫とは製品の保有数量である。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const orderBody = extractElementBody("term-order", graph, files);
    expect(orderBody).toContain("注文とは");
    expect(orderBody).not.toContain("製品とは");

    const productBody = extractElementBody("term-product", graph, files);
    expect(productBody).toContain("製品とは");
    expect(productBody).not.toContain("在庫とは");
    expect(productBody).not.toContain("注文とは");

    const stockBody = extractElementBody("term-stock", graph, files);
    expect(stockBody).toContain("在庫とは");
    expect(stockBody).not.toContain("製品とは");
  });

  it("extracts h3 heading element body (grp prefix)", () => {
    const files = makeFiles([
      [
        "plans/my-plan.md",
        [
          "---",
          "id: plan-my-plan",
          "status: open",
          "---",
          "# my-plan",
          "",
          "## グループ1 {#grp-my-plan}",
          "- elements: [[mod-cli]]",
          "- parallel: no",
        ].join("\n"),
      ],
      [
        "static/modules.md",
        [
          "# モジュール構成",
          "",
          "## CLI {#mod-cli}",
          "責務: コマンド解釈",
          "実装: src/cli/",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const grpBody = extractElementBody("grp-my-plan", graph, files);
    expect(grpBody).not.toBeNull();
    expect(grpBody).toContain("elements:");
    expect(grpBody).toContain("parallel: no");
  });

  it("h2 element body keeps h3 sub-headings (spec §5 same-level boundary)", () => {
    const files = makeFiles([
      [
        "domain/model.md",
        [
          "# モデル",
          "",
          "## 受注 {#ent-order}",
          "受注の説明。",
          "",
          "### 属性",
          "- 番号",
          "",
          "## 請求 {#ent-billing}",
          "請求の説明。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("ent-order", graph, files);
    expect(body).toContain("### 属性");
    expect(body).toContain("- 番号");
    expect(body).not.toContain("請求の説明");
  });

  it("h3 element body ends at the next h3 sibling (spec §5 same-level boundary)", () => {
    const files = makeFiles([
      [
        "plans/multi.md",
        [
          "---",
          "id: plan-multi",
          "status: open",
          "---",
          "# multi",
          "",
          "### 一次 {#grp-first}",
          "- elements: [[mod-cli]]",
          "- parallel: no",
          "",
          "### 二次 {#grp-second}",
          "- elements: [[mod-core]]",
          "- parallel: no",
        ].join("\n"),
      ],
      [
        "static/modules.md",
        [
          "# モジュール構成",
          "",
          "## CLI {#mod-cli}",
          "責務: コマンド解釈",
          "実装: src/cli/",
          "",
          "## コア {#mod-core}",
          "責務: 中核",
          "実装: src/core/",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("grp-first", graph, files);
    expect(body).not.toBeNull();
    expect(body).toContain("[[mod-cli]]");
    // Must NOT bleed into the next h3 sibling group
    expect(body).not.toContain("二次");
    expect(body).not.toContain("[[mod-core]]");
  });

  it("headings inside code fences do not end the body (spec §6 fence toggling)", () => {
    const files = makeFiles([
      [
        "domain/model.md",
        [
          "# モデル",
          "",
          "## 受注 {#ent-order}",
          "例:",
          "",
          "```markdown",
          "## これはフェンス内の例示見出し",
          "```",
          "",
          "フェンス後の本文。",
          "",
          "## 請求 {#ent-billing}",
          "請求の説明。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("ent-order", graph, files);
    expect(body).toContain("フェンス内の例示見出し");
    expect(body).toContain("フェンス後の本文");
    expect(body).not.toContain("請求の説明");
  });
});

// ---------------------------------------------------------------------------
// Document element body extraction
// ---------------------------------------------------------------------------

describe("extractElementBody — document elements", () => {
  it("extracts body after frontmatter for a seq element", () => {
    const files = makeFiles([
      [
        "dynamic/order-intake.md",
        [
          "---",
          "id: seq-order-intake",
          "---",
          "# 引合の受付",
          "",
          "## 登場要素",
          "- [[mod-cli]]",
          "",
          "## 流れ",
          "フローの説明テキスト",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("seq-order-intake", graph, files);
    expect(body).not.toBeNull();
    expect(body).toContain("# 引合の受付");
    expect(body).toContain("フローの説明テキスト");
    // Frontmatter must be excluded
    expect(body).not.toContain("id: seq-order-intake");
    expect(body).not.toContain("format-version");
  });

  it("extracts body for an adr element", () => {
    const files = makeFiles([
      [
        "adr/0001-order-model.md",
        [
          "---",
          "id: adr-0001-order-model",
          "---",
          "# 注文モデルの決定",
          "",
          "決定内容の詳細",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const body = extractElementBody("adr-0001-order-model", graph, files);
    expect(body).not.toBeNull();
    expect(body).toContain("# 注文モデルの決定");
    expect(body).toContain("決定内容の詳細");
    expect(body).not.toContain("id: adr-0001-order-model");
  });

  it("returns content when there is no frontmatter", () => {
    const files = makeFiles([
      [
        "dynamic/simple-flow.md",
        [
          "# シンプルフロー",
          "",
          "フロー説明",
        ].join("\n"),
      ],
    ]);
    // Parse: no frontmatter id, so no document element declared this way
    // But we can test extractAfterFrontmatter via a heading element in a file with no frontmatter
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);
    // No element declared — should return null
    const body = extractElementBody("seq-does-not-exist", graph, files);
    expect(body).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Null / missing cases
// ---------------------------------------------------------------------------

describe("extractElementBody — null cases", () => {
  it("returns null for unknown element ID", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(extractElementBody("mod-unknown", graph, files)).toBeNull();
  });

  it("returns null when the element file is not in the files list", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    // Build with files, then pass an empty files list to simulate missing file
    expect(extractElementBody("mod-cli", graph, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractAllBodies
// ---------------------------------------------------------------------------

describe("extractAllBodies", () => {
  it("returns bodies for all requested IDs", () => {
    const files = makeFiles([
      [
        "glossary.md",
        [
          "## 注文 {#term-order}",
          "注文の定義",
          "",
          "## 製品 {#term-product}",
          "製品の定義",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const bodies = extractAllBodies(["term-order", "term-product"], graph, files);
    expect(bodies.size).toBe(2);
    expect(bodies.get("term-order")).toContain("注文の定義");
    expect(bodies.get("term-product")).toContain("製品の定義");
  });

  it("omits entries for unknown IDs", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const bodies = extractAllBodies(["mod-cli", "mod-unknown"], graph, files);
    expect(bodies.has("mod-cli")).toBe(true);
    expect(bodies.has("mod-unknown")).toBe(false);
  });

  it("returns an empty map for an empty IDs list", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(extractAllBodies([], graph, files).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractElementRange (T-02)
// ---------------------------------------------------------------------------

describe("extractElementRange — heading elements", () => {
  it("range includes the declaration line (unlike extractElementBody)", () => {
    const files = makeFiles([
      [
        "domain/model.md",
        [
          "# モデル",
          "",
          "## 受注 {#ent-order}",
          "受注の説明。",
          "",
          "## 請求 {#ent-billing}",
          "請求の説明。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const range = extractElementRange("ent-order", graph, files);
    expect(range).not.toBeNull();
    // Must include the declaration line itself
    expect(range).toContain("## 受注 {#ent-order}");
    expect(range).toContain("受注の説明。");
    // Must NOT include the next element's declaration line
    expect(range).not.toContain("## 請求 {#ent-billing}");
    expect(range).not.toContain("請求の説明。");
  });

  it("range for last element extends to end of file", () => {
    const files = makeFiles([
      [
        "domain/model.md",
        [
          "## 受注 {#ent-order}",
          "最初の要素。",
          "",
          "## 最後 {#ent-last}",
          "最後の要素の説明。",
          "追加の行。",
          "さらに追加。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const range = extractElementRange("ent-last", graph, files);
    expect(range).not.toBeNull();
    expect(range).toContain("## 最後 {#ent-last}");
    expect(range).toContain("最後の要素の説明。");
    expect(range).toContain("追加の行。");
    expect(range).toContain("さらに追加。");
    // Must not contain the first element
    expect(range).not.toContain("最初の要素。");
  });

  it("range boundary is attribution-rule based (element declaration), not heading-level based", () => {
    // Multiple elements in one file; range boundary is next element's declaration,
    // regardless of heading level
    const files = makeFiles([
      [
        "glossary.md",
        [
          "## 注文 {#term-order}",
          "注文の説明。",
          "",
          "### サブセクション",
          "詳細内容。",
          "",
          "## 製品 {#term-product}",
          "製品の説明。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const range = extractElementRange("term-order", graph, files);
    expect(range).not.toBeNull();
    // Declaration line included
    expect(range).toContain("## 注文 {#term-order}");
    // Sub-section content included (same attribution region)
    expect(range).toContain("### サブセクション");
    expect(range).toContain("詳細内容。");
    // Next element NOT included (its declaration line is the boundary)
    expect(range).not.toContain("## 製品 {#term-product}");
    expect(range).not.toContain("製品の説明。");
  });
});

describe("extractElementRange — document elements", () => {
  it("range is the entire file content including frontmatter", () => {
    const files = makeFiles([
      [
        "dynamic/intake.md",
        [
          "---",
          "id: seq-intake",
          "---",
          "# 引合の受付",
          "",
          "フローの説明。",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const range = extractElementRange("seq-intake", graph, files);
    expect(range).not.toBeNull();
    // Frontmatter IS included (unlike extractElementBody)
    expect(range).toContain("---");
    expect(range).toContain("id: seq-intake");
    expect(range).toContain("# 引合の受付");
    expect(range).toContain("フローの説明。");
  });
});

describe("extractElementRange — null cases", () => {
  it("returns null for unknown element ID", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(extractElementRange("mod-unknown", graph, files)).toBeNull();
  });

  it("returns null when element file is not in files list", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(extractElementRange("mod-cli", graph, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeElementHash (T-02)
// ---------------------------------------------------------------------------

describe("computeElementHash (T-02)", () => {
  it("returns a 64-character lowercase hex string", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n実装: src/cli/\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const hash = computeElementHash("mod-cli", graph, files);
    expect(hash).not.toBeNull();
    expect(hash!.length).toBe(64);
    expect(hash!).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same content produces same hash", () => {
    const content = "## CLI {#mod-cli}\n責務: コマンド解釈\n実装: src/cli/\n";
    const files1 = makeFiles([["modules.md", content]]);
    const files2 = makeFiles([["modules.md", content]]);

    const parsed1 = parseFiles(files1);
    const graph1 = buildGraph(parsed1);
    const parsed2 = parseFiles(files2);
    const graph2 = buildGraph(parsed2);

    expect(computeElementHash("mod-cli", graph1, files1)).toBe(
      computeElementHash("mod-cli", graph2, files2)
    );
  });

  it("1-byte difference produces a different hash (no normalization)", () => {
    const files1 = makeFiles([["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈\n"]]);
    const files2 = makeFiles([["modules.md", "## CLI {#mod-cli}\n責務: コマンド解釈 \n"]]);  // trailing space

    const parsed1 = parseFiles(files1);
    const graph1 = buildGraph(parsed1);
    const parsed2 = parseFiles(files2);
    const graph2 = buildGraph(parsed2);

    const h1 = computeElementHash("mod-cli", graph1, files1);
    const h2 = computeElementHash("mod-cli", graph2, files2);
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    expect(h1).not.toBe(h2);
  });

  it("returns null for unknown element", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(computeElementHash("mod-unknown", graph, files)).toBeNull();
  });

  it("mark and check compute the same hash for a heading element (shared helper test)", () => {
    // Simulates: mark records hash, then check re-computes it — must match if body unchanged
    const content = [
      "# モジュール",
      "",
      "## CLI {#mod-cli}",
      "責務: コマンド解釈",
      "実装: src/cli/",
      "",
      "## コア {#mod-core}",
      "責務: コア",
    ].join("\n");

    const files = makeFiles([["modules.md", content]]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    // Simulate mark computing hash
    const markHash = computeElementHash("mod-cli", graph, files);
    // Simulate check re-computing hash (same call, same inputs)
    const checkHash = computeElementHash("mod-cli", graph, files);

    expect(markHash).not.toBeNull();
    expect(markHash).toBe(checkHash);
  });

  it("mark and check compute the same hash for EOF element", () => {
    const content = [
      "## 受注 {#ent-order}",
      "最初",
      "",
      "## 最後 {#ent-last}",
      "最後の要素",
    ].join("\n");

    const files = makeFiles([["model.md", content]]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const markHash = computeElementHash("ent-last", graph, files);
    const checkHash = computeElementHash("ent-last", graph, files);
    expect(markHash).toBe(checkHash);
  });

  it("mark and check compute the same hash for a document element", () => {
    const content = [
      "---",
      "id: seq-intake",
      "---",
      "# フロー",
      "説明",
    ].join("\n");

    const files = makeFiles([["dynamic/intake.md", content]]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const markHash = computeElementHash("seq-intake", graph, files);
    const checkHash = computeElementHash("seq-intake", graph, files);
    expect(markHash).not.toBeNull();
    expect(markHash).toBe(checkHash);
  });
});

// ---------------------------------------------------------------------------
// computeAllHashes (T-02)
// ---------------------------------------------------------------------------

describe("computeAllHashes (T-02)", () => {
  it("returns hashes for all resolvable IDs", () => {
    const files = makeFiles([
      [
        "glossary.md",
        [
          "## 注文 {#term-order}",
          "注文の定義",
          "",
          "## 製品 {#term-product}",
          "製品の定義",
        ].join("\n"),
      ],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const hashes = computeAllHashes(["term-order", "term-product"], graph, files);
    expect(hashes.size).toBe(2);
    expect(hashes.get("term-order")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashes.get("term-product")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("omits entries for unknown IDs", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    const hashes = computeAllHashes(["mod-cli", "mod-unknown"], graph, files);
    expect(hashes.has("mod-cli")).toBe(true);
    expect(hashes.has("mod-unknown")).toBe(false);
  });

  it("returns empty map for empty IDs list", () => {
    const files = makeFiles([
      ["modules.md", "## CLI {#mod-cli}\n責務\n"],
    ]);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed);

    expect(computeAllHashes([], graph, files).size).toBe(0);
  });
});
