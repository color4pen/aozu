/**
 * Tests for the `plan` command handler.
 *
 * Covers:
 *   - Normal generation: plan file conforms to spec §8
 *   - Annotation section: reference edges, mod grounding, requested elements
 *   - check exit 0 after generation (C1/C2/C10 not broken)
 *   - Stage gates: loop disabled / slug collision / no designed elements
 *   - Slug validation: invalid slug formats exit 2 without writing a file
 *   - stdout/stderr separation
 */

import { describe, it, expect } from "bun:test";
import { handlePlan } from "./plan.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { runCheck } from "../../check/checker.ts";
import { readState } from "../../state/reader.ts";

/** Absolute path to CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a loop-enabled fixture with:
 *   - mod-core (designed)
 *   - ent-order (designed, body references [[inv-order-valid]])
 *   - inv-order-valid (designed)
 *   - seq-my-flow (designed, references [[mod-core]] in 登場要素)
 *   - ent-product (requested in state.json)
 */
async function createLoopFixtureWithRefs(): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-plan-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "dynamic"), { recursive: true });

  // manifest: loop enabled
  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, domain, dynamic, loop",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  // static/modules.md: mod-core (designed)
  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## コア {#mod-core}",
      "責務: コアロジック",
      "実装: src/core/",
    ].join("\n")
  );

  // static/dependencies.md: empty
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // domain/model.md: ent-order (references inv-order-valid), ent-product
  await writeFile(
    join(designDir, "domain", "model.md"),
    [
      "# ドメインモデル",
      "",
      "## 注文 {#ent-order}",
      "注文エンティティ。[[inv-order-valid]] を満たす必要がある。",
      "",
      "## 製品 {#ent-product}",
      "製品エンティティ。",
    ].join("\n")
  );

  // domain/invariants.md: inv-order-valid
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    [
      "# 不変条件",
      "",
      "## 注文有効性 {#inv-order-valid}",
      "注文は必ず顧客 ID を持つ。",
    ].join("\n")
  );

  // dynamic/my-flow.md: seq-my-flow (designed, references mod-core)
  await writeFile(
    join(designDir, "dynamic", "my-flow.md"),
    [
      "---",
      "id: seq-my-flow",
      "---",
      "# マイフロー",
      "",
      "## 登場要素",
      "- [[mod-core]]",
      "",
      "## 流れ",
      "フローの説明",
    ].join("\n")
  );

  // state.json: ent-product is requested
  await writeFile(
    join(designDir, "state.json"),
    JSON.stringify(
      { "ent-product": { state: "requested", request: "product-feature" } },
      null,
      2
    )
  );

  return designDir;
}

/**
 * Create a fixture with loop disabled (manifest enabled: static only).
 */
async function createLoopDisabledFixture(): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-plan-nodloop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "---",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI",
      "実装: src/cli/",
    ].join("\n")
  );

  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  return designDir;
}

/**
 * Create a fixture where all elements are already implemented (no designed elements).
 */
async function createNoDesignedFixture(): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-plan-nodesigned-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, loop",
      "---",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI",
      "実装: src/cli/",
    ].join("\n")
  );

  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // All elements implemented
  await writeFile(
    join(designDir, "state.json"),
    JSON.stringify({ "mod-cli": { state: "implemented", request: "cli-init", pr: 1 } }, null, 2)
  );

  return designDir;
}

// ---------------------------------------------------------------------------
// Normal generation
// ---------------------------------------------------------------------------

describe("handlePlan — normal generation", () => {
  it("returns 0 and creates plans/<slug>.md", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["my-batch", "--dir", designDir]);
      expect(code).toBe(0);

      const planPath = join(designDir, "plans", "my-batch.md");
      expect(await Bun.file(planPath).exists()).toBe(true);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("generated plan has id: plan-<slug> in frontmatter", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      expect(content).toContain("id: plan-my-batch");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("generated plan has status: open in frontmatter", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      expect(content).toContain("status: open");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("generated plan has H1 heading # my-batch after frontmatter", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      expect(content).toContain("# my-batch");
      // H1 must appear after the closing ---
      const lines = content.split("\n");
      const closingDashIdx = lines.indexOf("---", 1);
      const h1Idx = lines.indexOf("# my-batch");
      expect(h1Idx).toBeGreaterThan(closingDashIdx);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("generated plan has {#grp-my-batch} group", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      expect(content).toContain("{#grp-my-batch}");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("elements: line contains designed elements", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      // mod-core, ent-order, inv-order-valid, seq-my-flow are designed
      const elemLine = content.split("\n").find((l) => l.startsWith("- elements:"));
      expect(elemLine).toBeDefined();
      expect(elemLine).toContain("[[mod-core]]");
      expect(elemLine).toContain("[[ent-order]]");
      expect(elemLine).toContain("[[inv-order-valid]]");
      expect(elemLine).toContain("[[seq-my-flow]]");
      // ent-product is requested, must not be in elements:
      expect(elemLine).not.toContain("[[ent-product]]");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("generated plan does NOT contain a request: line (ADR-0018-2)", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      const lines = content.split("\n");
      const hasRequestLine = lines.some(
        (l) => l.trim().startsWith("request:") || l.trim().startsWith("- request:")
      );
      expect(hasRequestLine).toBe(false);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Annotation section
// ---------------------------------------------------------------------------

describe("handlePlan — annotation section", () => {
  it("annotation section contains reference edges between designed elements", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      // ent-order references inv-order-valid → should appear in annotation
      expect(content).toContain("[[ent-order]]");
      expect(content).toContain("[[inv-order-valid]]");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("annotation section contains mod grounding", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      // seq-my-flow references mod-core → mod grounding for seq-my-flow
      expect(content).toContain("[[seq-my-flow]]");
      expect(content).toContain("[[mod-core]]");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("annotation section contains requested elements", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      // ent-product is requested
      expect(content).toContain("[[ent-product]]");
      expect(content).toContain("product-feature");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// check passes after plan generation
// ---------------------------------------------------------------------------

describe("handlePlan — check still passes after generation", () => {
  it("runCheck returns no errors after plan generation (C1/C2/C10 not broken)", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      await handlePlan(["my-batch", "--dir", designDir]);

      // Re-read all files including the generated plan
      const files = await readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap = await readState(join(designDir, "state.json"));
      const stateKeys = Object.keys(stateMap);

      const diagnostics = runCheck(graph, manifest, stateKeys);
      expect(diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Stage gates
// ---------------------------------------------------------------------------

describe("handlePlan — stage gates", () => {
  it("loop disabled → exit 1, no file written", async () => {
    const designDir = await createLoopDisabledFixture();
    try {
      const code = await handlePlan(["my-batch", "--dir", designDir]);
      expect(code).toBe(1);
      expect(await Bun.file(join(designDir, "plans", "my-batch.md")).exists()).toBe(false);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("existing slug → exit 1, existing file unchanged", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      // Create plans directory and existing plan
      await mkdir(join(designDir, "plans"), { recursive: true });
      const existingContent = "# existing plan\n";
      await writeFile(join(designDir, "plans", "my-batch.md"), existingContent);

      const code = await handlePlan(["my-batch", "--dir", designDir]);
      expect(code).toBe(1);

      // File must be unchanged
      const content = await Bun.file(join(designDir, "plans", "my-batch.md")).text();
      expect(content).toBe(existingContent);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("no designed elements → exit 1, no file written", async () => {
    const designDir = await createNoDesignedFixture();
    try {
      const code = await handlePlan(["my-batch", "--dir", designDir]);
      expect(code).toBe(1);
      expect(await Bun.file(join(designDir, "plans", "my-batch.md")).exists()).toBe(false);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

describe("handlePlan — slug validation", () => {
  it("invalid slug with path traversal (../evil) → exit 2, no file written", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["../evil", "--dir", designDir]);
      expect(code).toBe(2);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("invalid slug with uppercase (My-Batch) → exit 2", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["My-Batch", "--dir", designDir]);
      expect(code).toBe(2);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("invalid slug with spaces → exit 2", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["my batch", "--dir", designDir]);
      expect(code).toBe(2);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("invalid slug with trailing dash → exit 2", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["my-batch-", "--dir", designDir]);
      expect(code).toBe(2);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("valid slug → exit 0", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["my-batch", "--dir", designDir]);
      expect(code).toBe(0);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("missing slug → exit 2", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const code = await handlePlan(["--dir", designDir]);
      expect(code).toBe(2);
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// stdout/stderr separation (subprocess test)
// ---------------------------------------------------------------------------

describe("handlePlan — stdout/stderr separation", () => {
  it("stdout is empty on success (subprocess)", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "plan", "my-subprocess-batch", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });

  it("stderr contains success message on success (subprocess)", async () => {
    const designDir = await createLoopFixtureWithRefs();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "plan", "my-subprocess-batch2", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(0);
      expect(stderr).toContain("my-subprocess-batch2.md");
    } finally {
      await rm(join(designDir, ".."), { recursive: true });
    }
  });
});
