/**
 * Tests for the `prompt derive` command handler.
 *
 * Covers:
 *   - stdout contains all 6 sections (template, element bodies, neighborhood,
 *     term/inv, citation convention, output path)
 *   - Template dual-mode: file path vs shell command
 *   - Stage gates: loop disabled / missing config / plan not found / group not found
 *   - Filesystem non-write: execution does not change the filesystem
 */

import { describe, it, expect } from "bun:test";
import { handlePrompt, handleDerive } from "./prompt.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a full derive-ready fixture:
 *   - manifest: loop enabled, request-template: template.md, request-output-dir: requests/
 *   - static/modules.md: mod-core
 *   - static/dependencies.md: empty
 *   - domain/model.md: ent-order (refs [[inv-order-valid]])
 *   - domain/invariants.md: inv-order-valid
 *   - domain/glossary.md: term-status
 *   - dynamic/my-flow.md: seq-my-flow (refs [[mod-core]])
 *   - plans/my-plan.md: plan-my-plan with grp-my-plan containing ent-order
 *   - template.md: the template file
 */
async function createDeriveFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-derive-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "dynamic"), { recursive: true });
  await mkdir(join(designDir, "plans"), { recursive: true });

  // manifest: loop enabled + template config
  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, domain, dynamic, loop",
      "request-template: template.md",
      "request-output-dir: requests/",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  // template file
  await writeFile(
    join(designDir, "template.md"),
    [
      "# Request Template",
      "",
      "## Summary",
      "",
      "Describe the change.",
      "",
      "## Elements",
      "",
      "<!-- list [[id]] references here -->",
    ].join("\n")
  );

  // static/modules.md
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

  // static/dependencies.md
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // domain/model.md
  await writeFile(
    join(designDir, "domain", "model.md"),
    [
      "# ドメインモデル",
      "",
      "## 注文 {#ent-order}",
      "注文エンティティ。[[inv-order-valid]] を満たす必要がある。",
    ].join("\n")
  );

  // domain/invariants.md
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    [
      "# 不変条件",
      "",
      "## 注文有効性 {#inv-order-valid}",
      "注文は必ず顧客 ID を持つ。",
    ].join("\n")
  );

  // domain/glossary.md: term-status
  await writeFile(
    join(designDir, "domain", "glossary.md"),
    [
      "# 用語集",
      "",
      "## ステータス {#term-status}",
      "注文の状態を表す。",
    ].join("\n")
  );

  // dynamic/my-flow.md: seq-my-flow references mod-core
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

  // plans/my-plan.md: plan-my-plan with grp-my-plan containing ent-order
  await writeFile(
    join(designDir, "plans", "my-plan.md"),
    [
      "---",
      "id: plan-my-plan",
      "status: open",
      "---",
      "# my-plan",
      "",
      "## グループ {#grp-my-plan}",
      "- elements: [[ent-order]]",
      "- parallel: no",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a fixture where the plan group references an element that does not
 * exist in the graph (TC-017).  The grp-test element is valid but its
 * elements: line contains [[ent-nonexistent]] which has no matching heading.
 */
async function createUnresolvedElementFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-derive-unresolved-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "plans"), { recursive: true });

  // manifest: loop enabled + template config
  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, domain, dynamic, loop",
      "request-template: template.md",
      "request-output-dir: requests/",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  // template file
  await writeFile(join(designDir, "template.md"), "# Request Template\n");

  // static/modules.md
  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## Core {#mod-core}", "責務: コア", "実装: src/core/"].join("\n")
  );

  // static/dependencies.md
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // domain/model.md: ent-real exists, ent-nonexistent does NOT
  await writeFile(
    join(designDir, "domain", "model.md"),
    ["# ドメインモデル", "", "## 実エンティティ {#ent-real}", "実エンティティの説明。"].join("\n")
  );

  // plans/test-plan.md: grp-test references [[ent-nonexistent]] (unresolvable)
  await writeFile(
    join(designDir, "plans", "test-plan.md"),
    [
      "---",
      "id: plan-test",
      "status: open",
      "---",
      "# test-plan",
      "",
      "## テストグループ {#grp-test}",
      "- elements: [[ent-nonexistent]]",
      "- parallel: no",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a fixture with loop disabled.
 */
async function createLoopDisabledFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-derive-nodloop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "request-template: template.md",
      "request-output-dir: requests/",
      "---",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## CLI {#mod-cli}", "責務: CLI", "実装: src/cli/"].join("\n")
  );
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  return { designDir, baseDir };
}

// ---------------------------------------------------------------------------
// Normal case — stdout contains all 6 sections
// ---------------------------------------------------------------------------

describe("handleDerive — normal case stdout", () => {
  it("stdout contains template content delimited by TEMPLATE BEGIN/END", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("---TEMPLATE BEGIN---");
      expect(stdout).toContain("---TEMPLATE END---");
      expect(stdout).toContain("Request Template");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains target element body", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // ent-order body contains "注文エンティティ"
      expect(stdout).toContain("注文エンティティ");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains 2-hop neighborhood body", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // inv-order-valid is 1-hop from ent-order, its body has "顧客 ID"
      expect(stdout).toContain("顧客 ID");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains term/inv text", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // term-status body and inv-order-valid body appear in terms & invariants section
      expect(stdout).toContain("注文の状態");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains citation convention text", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("引用は被覆の宣言");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains output directory path", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("requests/");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Template dual-mode: file path vs command
// ---------------------------------------------------------------------------

describe("handleDerive — template dual-mode", () => {
  it("uses file content when request-template is a file path", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // template.md contains "Describe the change."
      expect(stdout).toContain("Describe the change.");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("executes command when request-template is not an existing file", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Change manifest to use a command instead of a file
      await writeFile(
        join(designDir, "manifest.md"),
        [
          "---",
          "format-version: 0",
          "enabled: static, domain, dynamic, loop",
          "request-template: echo COMMAND_TEMPLATE_OUTPUT",
          "request-output-dir: requests/",
          "---",
          "",
          "# manifest",
        ].join("\n")
      );

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("COMMAND_TEMPLATE_OUTPUT");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Stage gates
// ---------------------------------------------------------------------------

describe("handleDerive — stage gates", () => {
  it("loop disabled → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createLoopDisabledFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-test", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("loop");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("missing request-template → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Remove request-template from manifest
      await writeFile(
        join(designDir, "manifest.md"),
        [
          "---",
          "format-version: 0",
          "enabled: static, domain, dynamic, loop",
          "request-output-dir: requests/",
          "---",
          "# manifest",
        ].join("\n")
      );

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("request-template");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("missing request-output-dir → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Remove request-output-dir from manifest
      await writeFile(
        join(designDir, "manifest.md"),
        [
          "---",
          "format-version: 0",
          "enabled: static, domain, dynamic, loop",
          "request-template: template.md",
          "---",
          "# manifest",
        ].join("\n")
      );

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("request-output-dir");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("plan not found (no plan files) → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Remove plan file
      await rm(join(designDir, "plans", "my-plan.md"));

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr.length).toBeGreaterThan(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("group not found → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-nonexistent", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("grp-nonexistent");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("missing --group argument → exit 2", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  // TC-017: group elements reference IDs absent from the graph
  it("group elements reference unresolvable IDs → exit 2 + stderr diagnostic (TC-017)", async () => {
    const { designDir, baseDir } = await createUnresolvedElementFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-test", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("ent-nonexistent");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Filesystem non-write test
// ---------------------------------------------------------------------------

describe("handleDerive — filesystem non-write", () => {
  it("does not write any files to the design directory", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Snapshot before
      const before = await listAllFiles(designDir);

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-my-plan", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;

      // Snapshot after
      const after = await listAllFiles(designDir);

      expect(after.sort()).toEqual(before.sort());
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePrompt dispatch
// ---------------------------------------------------------------------------

describe("handlePrompt dispatch", () => {
  it("unknown subcommand → exit 2", async () => {
    const code = await handlePrompt(["unknown-sub"]);
    expect(code).toBe(2);
  });

  it("no subcommand → exit 2", async () => {
    const code = await handlePrompt([]);
    expect(code).toBe(2);
  });

  it("--help → exit 0", async () => {
    const code = await handlePrompt(["--help"]);
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function listAllFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  await collectFiles(dir, result);
  return result;
}

async function collectFiles(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, out);
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
}
