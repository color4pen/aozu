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

  // TC-044: request-template command exits non-zero → exit 2 + stderr diagnostic
  it("request-template command exits non-zero → exit 2 + stderr diagnostic (TC-044)", async () => {
    const { designDir, baseDir } = await createDeriveFixture();
    try {
      // Set request-template to a command that always fails
      await writeFile(
        join(designDir, "manifest.md"),
        [
          "---",
          "format-version: 0",
          "enabled: static, domain, dynamic, loop",
          "request-template: exit 1",
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
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("request-template");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Stage gates
// ---------------------------------------------------------------------------

describe("handleDerive — stage gates", () => {
  it("loop disabled → exit 1 + stderr diagnostic (ADR-0010 stage gate, same class as plan)", async () => {
    const { designDir, baseDir } = await createLoopDisabledFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "derive", "--group", "grp-test", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
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
// handlePrompt dispatch (T-05: updated to include session)
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

  it("--help output contains 'session' subcommand", async () => {
    // Capture stderr by temporarily replacing process.stderr.write
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    // Simplified mock: capture string chunks, return true (valid for WritableStream.write)
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["--help"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("session");
  });

  it("no subcommand error message contains 'session' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt([]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("session");
  });

  it("unknown subcommand error message contains 'session' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["unknown-sub"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("session");
  });
});

// ---------------------------------------------------------------------------
// Session fixture helpers (T-04)
// ---------------------------------------------------------------------------

/**
 * Create a full session-ready fixture:
 *   - manifest: loop enabled
 *   - static/modules.md: mod-core (責務: あり), mod-cli (責務: あり)
 *   - static/dependencies.md: [[mod-cli]] -> [[mod-core]]
 *   - domain/model.md: ent-order (refs [[inv-order-valid]]), ent-hop2 (refs [[ent-hop3]])
 *   - domain/invariants.md: inv-order-valid (refs [[ent-hop2]])
 *   - domain/glossary.md: term-status
 *   - topics/my-topic.md: id=top-my-topic, body references [[ent-order]]
 *
 * Hop chain from seed (ent-order):
 *   ent-order →(ref)→ inv-order-valid  [1-hop = in neighborhood]
 *   inv-order-valid →(ref)→ ent-hop2   [2-hop = in neighborhood]
 *   ent-hop2 →(ref)→ ent-hop3          [3-hop = OUT OF NEIGHBORHOOD]
 */
async function createSessionFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-session-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "topics"), { recursive: true });

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

  // static/modules.md: mod-core, mod-cli
  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## コア {#mod-core}",
      "責務: コアロジック",
      "実装: src/core/",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI インターフェース",
      "実装: src/cli/",
    ].join("\n")
  );

  // static/dependencies.md
  await writeFile(
    join(designDir, "static", "dependencies.md"),
    [
      "# 許可依存",
      "",
      "- [[mod-cli]] -> [[mod-core]]",
    ].join("\n")
  );

  // domain/model.md: ent-order, ent-hop2, ent-hop3
  await writeFile(
    join(designDir, "domain", "model.md"),
    [
      "# ドメインモデル",
      "",
      "## 注文 {#ent-order}",
      "注文エンティティ。[[inv-order-valid]] を満たす必要がある。",
      "",
      "## ホップ2要素 {#ent-hop2}",
      "ホップ 2 要素。[[ent-hop3]] を参照。",
      "",
      "## ホップ3要素 {#ent-hop3}",
      "ホップ 3 要素 — これはスコープ外。UNIQUE_SCOPE_BOUNDARY_MARKER",
    ].join("\n")
  );

  // domain/invariants.md: inv-order-valid (refs [[ent-hop2]])
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    [
      "# 不変条件",
      "",
      "## 注文有効性 {#inv-order-valid}",
      "注文は必ず顧客 ID を持つ。[[ent-hop2]] も参照。",
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

  // topics/my-topic.md: top-my-topic, body refs [[ent-order]]
  await writeFile(
    join(designDir, "topics", "my-topic.md"),
    [
      "---",
      "id: top-my-topic",
      "---",
      "",
      "# マイトピック",
      "",
      "このトピックは [[ent-order]] に関する設計課題を提起する。",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a session fixture where the topic has no [[id]] citations (引用 0 件).
 */
async function createSessionNoRefsFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-session-norefs-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "topics"), { recursive: true });

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
      "注文エンティティの説明。",
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

  // domain/glossary.md
  await writeFile(
    join(designDir, "domain", "glossary.md"),
    [
      "# 用語集",
      "",
      "## ステータス {#term-status}",
      "注文の状態を表す。",
    ].join("\n")
  );

  // topics/my-topic.md: no [[id]] citations in body
  await writeFile(
    join(designDir, "topics", "my-topic.md"),
    [
      "---",
      "id: top-my-topic",
      "---",
      "",
      "# マイトピック",
      "",
      "このトピックには引用がない。新規 greenfield の設計課題。",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a loop-disabled session fixture.
 */
async function createSessionLoopDisabledFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-session-noloop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "topics"), { recursive: true });

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
    ["# モジュール", "", "## コア {#mod-core}", "責務: コアロジック"].join("\n")
  );
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  await writeFile(
    join(designDir, "topics", "my-topic.md"),
    ["---", "id: top-my-topic", "---", "", "トピック本文。"].join("\n")
  );

  return { designDir, baseDir };
}

// ---------------------------------------------------------------------------
// handleSession — normal case stdout (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — normal case stdout", () => {
  it("exit 0 on normal case", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains topic body text", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("このトピックは");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains seed element (ent-order) body", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
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

  it("stdout contains 1-hop neighbor (inv-order-valid) body", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // inv-order-valid body contains "顧客 ID"
      expect(stdout).toContain("顧客 ID");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains 2-hop neighbor (ent-hop2) body", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // ent-hop2 body contains "ホップ 2 要素"
      expect(stdout).toContain("ホップ 2 要素");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains term/inv full content (term-status and inv-order-valid)", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // term-status body
      expect(stdout).toContain("注文の状態を表す");
      // inv-order-valid appears in terms & invariants section
      expect(stdout).toContain("inv-order-valid");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains static mod condensed (mod-core / mod-cli heading + 責務: line)", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("mod-core");
      expect(stdout).toContain("コアロジック");
      expect(stdout).toContain("mod-cli");
      expect(stdout).toContain("CLI インターフェース");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("static mod condensed excludes 実装: lines", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // fixture modules.md has 実装: lines; condensed form is heading + 責務: only
      expect(stdout).not.toContain("実装:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains format rules summary text", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Declaration syntax");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains session guidance text", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("scaffold");
      expect(stdout).toContain("topics:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — 2-hop scope boundary (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — 2-hop scope boundary", () => {
  it("3-hop element body (ent-hop3) is NOT in stdout", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // UNIQUE_SCOPE_BOUNDARY_MARKER is in ent-hop3's body (3-hop = out of scope)
      expect(stdout).not.toContain("UNIQUE_SCOPE_BOUNDARY_MARKER");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — no-refs topic (引用 0 件) (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — no-refs topic", () => {
  it("exit 0 for topic with no [[id]] citations", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains topic body for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("このトピックには引用がない");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains seed placeholder for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("no seed elements");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains neighborhood placeholder for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("no neighborhood elements");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains term/inv full content for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("注文の状態を表す");
      expect(stdout).toContain("inv-order-valid");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains static mod condensed for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("mod-core");
      expect(stdout).toContain("コアロジック");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains format rules summary for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("Declaration syntax");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains session guidance for no-refs topic", async () => {
    const { designDir, baseDir } = await createSessionNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("scaffold");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — stage gates (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — stage gates", () => {
  it("loop disabled → exit 1 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createSessionLoopDisabledFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("loop");
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("topic not found → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-nonexistent", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("top-nonexistent");
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("non-top prefix ID → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "ent-order", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("ent-order");
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("design directory not found → exit 2", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", "/nonexistent/design"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });

  it("missing --topic argument → exit 2", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(2);
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — deterministic output (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — deterministic output", () => {
  it("two runs with same fixture produce byte-identical stdout", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const run = async () => {
        const proc = Bun.spawn(
          ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
          { stdout: "pipe", stderr: "pipe" }
        );
        await proc.exited;
        return new Response(proc.stdout).text();
      };
      const first = await run();
      const second = await run();
      expect(first).toBe(second);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — stdout/stderr separation (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — stdout/stderr separation", () => {
  it("normal case: stdout is non-empty, stderr is empty", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
      expect(stderr).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleSession — filesystem non-write (T-04)
// ---------------------------------------------------------------------------

describe("handleSession — filesystem non-write", () => {
  it("does not write any files to the design directory", async () => {
    const { designDir, baseDir } = await createSessionFixture();
    try {
      // Snapshot before
      const before = await listAllFiles(designDir);

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "session", "--topic", "top-my-topic", "--dir", designDir],
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

// ---------------------------------------------------------------------------
// Propagate fixture helpers (T-03)
// ---------------------------------------------------------------------------

/**
 * Create a full propagate-ready fixture:
 *   - manifest: loop enabled (propagate must NOT be gated on this)
 *   - static/modules.md: mod-core (責務: あり), mod-cli (責務: あり)
 *   - static/dependencies.md: [[mod-cli]] -> [[mod-core]]
 *   - domain/model.md: ent-order (refs [[inv-order-valid]]), ent-hop2 (refs [[ent-hop3]])
 *   - domain/invariants.md: inv-order-valid (refs [[ent-hop2]])
 *   - domain/glossary.md: term-status
 *   - adr/0001-my-decision.md: id=adr-0001, body references [[ent-order]]
 *
 * Hop chain from ADR seed (ent-order):
 *   ent-order →(ref)→ inv-order-valid  [1-hop = in neighborhood]
 *   inv-order-valid →(ref)→ ent-hop2   [2-hop = in neighborhood]
 *   ent-hop2 →(ref)→ ent-hop3          [3-hop = OUT OF NEIGHBORHOOD]
 */
async function createPropagateFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-propagate-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "adr"), { recursive: true });

  // manifest: loop enabled (propagate should succeed regardless)
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

  // static/modules.md: mod-core, mod-cli
  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## コア {#mod-core}",
      "責務: コアロジック",
      "実装: src/core/",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI インターフェース",
      "実装: src/cli/",
    ].join("\n")
  );

  // static/dependencies.md
  await writeFile(
    join(designDir, "static", "dependencies.md"),
    ["# 許可依存", "", "- [[mod-cli]] -> [[mod-core]]"].join("\n")
  );

  // domain/model.md: ent-order, ent-hop2, ent-hop3
  await writeFile(
    join(designDir, "domain", "model.md"),
    [
      "# ドメインモデル",
      "",
      "## 注文 {#ent-order}",
      "注文エンティティ。[[inv-order-valid]] を満たす必要がある。",
      "",
      "## ホップ2要素 {#ent-hop2}",
      "ホップ 2 要素。[[ent-hop3]] を参照。",
      "",
      "## ホップ3要素 {#ent-hop3}",
      "ホップ 3 要素 — これはスコープ外。PROPAGATE_UNIQUE_SCOPE_MARKER",
    ].join("\n")
  );

  // domain/invariants.md: inv-order-valid (refs [[ent-hop2]])
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    [
      "# 不変条件",
      "",
      "## 注文有効性 {#inv-order-valid}",
      "注文は必ず顧客 ID を持つ。[[ent-hop2]] も参照。",
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

  // adr/0001-my-decision.md: id=adr-0001, body references [[ent-order]]
  await writeFile(
    join(designDir, "adr", "0001-my-decision.md"),
    [
      "---",
      "id: adr-0001",
      "topics: top-my-topic",
      "---",
      "",
      "# ADR-0001: My Decision",
      "",
      "## Decision",
      "",
      "We decided to use [[ent-order]] as the primary entity.",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a propagate fixture where the ADR has no [[id]] citations (引用 0 件).
 */
async function createPropagateNoRefsFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-propagate-norefs-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "adr"), { recursive: true });

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

  // static/modules.md
  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール構成", "", "## コア {#mod-core}", "責務: コアロジック", "実装: src/core/"].join("\n")
  );

  // static/dependencies.md
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // domain/model.md
  await writeFile(
    join(designDir, "domain", "model.md"),
    ["# ドメインモデル", "", "## 注文 {#ent-order}", "注文エンティティの説明。"].join("\n")
  );

  // domain/invariants.md
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    ["# 不変条件", "", "## 注文有効性 {#inv-order-valid}", "注文は必ず顧客 ID を持つ。"].join("\n")
  );

  // domain/glossary.md
  await writeFile(
    join(designDir, "domain", "glossary.md"),
    ["# 用語集", "", "## ステータス {#term-status}", "注文の状態を表す。"].join("\n")
  );

  // adr/0002-no-refs.md: id=adr-0002, body has NO [[id]] citations
  await writeFile(
    join(designDir, "adr", "0002-no-refs.md"),
    [
      "---",
      "id: adr-0002",
      "---",
      "",
      "# ADR-0002: Standalone Decision",
      "",
      "## Decision",
      "",
      "This ADR has no element citations.",
    ].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a propagate fixture with loop disabled.
 * propagate must succeed (exit 0) because it has no loop gate.
 */
async function createPropagateLoopDisabledFixture(): Promise<{
  designDir: string;
  baseDir: string;
}> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-propagate-noloop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "adr"), { recursive: true });

  // manifest: loop NOT enabled
  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", "enabled: static, domain", "---", "# manifest"].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## コア {#mod-core}", "責務: コアロジック"].join("\n")
  );
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // adr/0001-test.md: id=adr-0001
  await writeFile(
    join(designDir, "adr", "0001-test.md"),
    ["---", "id: adr-0001", "---", "", "# ADR-0001", "", "## Decision", "", "No citations."].join(
      "\n"
    )
  );

  return { designDir, baseDir };
}

// ---------------------------------------------------------------------------
// handlePropagate — normal case stdout (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — normal case stdout", () => {
  it("exit 0 on normal case", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains ADR body text", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // ADR body contains "primary entity"
      expect(stdout).toContain("primary entity");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains seed element (ent-order) body", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("注文エンティティ");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains 1-hop neighbor (inv-order-valid) body", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("顧客 ID");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains 2-hop neighbor (ent-hop2) body", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("ホップ 2 要素");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains term/inv full content", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("注文の状態を表す");
      expect(stdout).toContain("inv-order-valid");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains static mod condensed (mod-core / mod-cli heading + 責務: line)", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("mod-core");
      expect(stdout).toContain("コアロジック");
      expect(stdout).toContain("mod-cli");
      expect(stdout).toContain("CLI インターフェース");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("static mod condensed excludes 実装: lines", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("実装:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains format rules summary text", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Declaration syntax");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains propagation guidance text", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("aozu check");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — 2-hop scope boundary (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — 2-hop scope boundary", () => {
  it("3-hop element body (ent-hop3) is NOT in stdout", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      // PROPAGATE_UNIQUE_SCOPE_MARKER is in ent-hop3's body (3-hop = out of scope)
      expect(stdout).not.toContain("PROPAGATE_UNIQUE_SCOPE_MARKER");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — no-refs ADR (引用 0 件) (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — no-refs ADR", () => {
  it("exit 0 for ADR with no [[id]] citations", async () => {
    const { designDir, baseDir } = await createPropagateNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0002", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains seed placeholder for no-refs ADR", async () => {
    const { designDir, baseDir } = await createPropagateNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0002", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("no seed elements");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains neighborhood placeholder for no-refs ADR", async () => {
    const { designDir, baseDir } = await createPropagateNoRefsFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0002", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("no neighborhood elements");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — stage gates (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — stage gates", () => {
  it("ADR not found → exit 2 + stderr diagnostic mentioning the ID", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-nonexistent", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("adr-nonexistent");
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("non-adr prefix ID → exit 2 + stderr diagnostic", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "ent-order", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(2);
      expect(stderr).toContain("ent-order");
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("design directory not found → exit 2", async () => {
    const proc = Bun.spawn(
      [
        "bun",
        MAIN_TS,
        "prompt",
        "propagate",
        "--adr",
        "adr-0001",
        "--dir",
        "/nonexistent/design",
      ],
      { stdout: "pipe", stderr: "pipe" }
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });

  it("missing --adr argument → exit 2", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(2);
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — loop gate absent (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — loop gate absent", () => {
  it("loop disabled → exit 0 (no loop gate for propagate)", async () => {
    const { designDir, baseDir } = await createPropagateLoopDisabledFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — deterministic output (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — deterministic output", () => {
  it("two runs with same fixture produce byte-identical stdout", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const run = async () => {
        const proc = Bun.spawn(
          ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
          { stdout: "pipe", stderr: "pipe" }
        );
        await proc.exited;
        return new Response(proc.stdout).text();
      };
      const first = await run();
      const second = await run();
      expect(first).toBe(second);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — stdout/stderr separation (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — stdout/stderr separation", () => {
  it("normal case: stdout is non-empty, stderr is empty", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
      expect(stderr).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePropagate — filesystem non-write (T-03)
// ---------------------------------------------------------------------------

describe("handlePropagate — filesystem non-write", () => {
  it("does not write any files to the design directory", async () => {
    const { designDir, baseDir } = await createPropagateFixture();
    try {
      const before = await listAllFiles(designDir);

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "prompt", "propagate", "--adr", "adr-0001", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      await proc.exited;

      const after = await listAllFiles(designDir);
      expect(after.sort()).toEqual(before.sort());
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Review fixture helpers (T-05)
// ---------------------------------------------------------------------------

/**
 * Create a review-ready fixture with multiple elements in various layers.
 */
async function createReviewFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-review-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });

  // manifest: loop enabled (review must NOT be gated on this)
  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", "enabled: static, domain, dynamic, loop", "---", "", "# manifest"].join(
      "\n"
    )
  );

  // static/modules.md: mod-core
  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール構成", "", "## コア {#mod-core}", "責務: コアロジック", "実装: src/core/"].join("\n")
  );

  // static/dependencies.md
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // domain/model.md: ent-order
  await writeFile(
    join(designDir, "domain", "model.md"),
    ["# ドメインモデル", "", "## 注文 {#ent-order}", "注文エンティティの説明。"].join("\n")
  );

  // domain/invariants.md: inv-order-valid
  await writeFile(
    join(designDir, "domain", "invariants.md"),
    ["# 不変条件", "", "## 注文有効性 {#inv-order-valid}", "注文は必ず顧客 ID を持つ。"].join("\n")
  );

  // domain/glossary.md: term-status
  await writeFile(
    join(designDir, "domain", "glossary.md"),
    ["# 用語集", "", "## ステータス {#term-status}", "注文の状態を表す。"].join("\n")
  );

  return { designDir, baseDir };
}

/**
 * Create a review fixture with loop disabled.
 * review must succeed (exit 0) because it has no loop gate.
 */
async function createReviewLoopDisabledFixture(): Promise<{
  designDir: string;
  baseDir: string;
}> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-review-noloop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });

  // manifest: loop NOT enabled
  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", "enabled: static", "---", "# manifest"].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## コア {#mod-core}", "責務: コアロジック"].join("\n")
  );
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  await writeFile(
    join(designDir, "domain", "model.md"),
    ["# ドメインモデル", "", "## 注文 {#ent-order}", "注文エンティティの説明。"].join("\n")
  );

  return { designDir, baseDir };
}

// ---------------------------------------------------------------------------
// handleReview — normal case stdout (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — normal case stdout", () => {
  it("exit 0 on normal case", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains all element bodies", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("注文エンティティの説明");
      expect(stdout).toContain("顧客 ID");
      expect(stdout).toContain("コアロジック");
      expect(stdout).toContain("注文の状態を表す");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains elements in ID lexicographic order", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      // ent-order < inv-order-valid < mod-core < term-status (lexicographic)
      const entIdx = stdout.indexOf("### ent-order");
      const invIdx = stdout.indexOf("### inv-order-valid");
      const modIdx = stdout.indexOf("### mod-core");
      const termIdx = stdout.indexOf("### term-status");
      expect(entIdx).toBeGreaterThanOrEqual(0);
      expect(invIdx).toBeGreaterThanOrEqual(0);
      expect(modIdx).toBeGreaterThanOrEqual(0);
      expect(termIdx).toBeGreaterThanOrEqual(0);
      expect(entIdx).toBeLessThan(invIdx);
      expect(invIdx).toBeLessThan(modIdx);
      expect(modIdx).toBeLessThan(termIdx);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains findings format guidance", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("finding");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains 'check' exclusion directive (C1-C11 out of scope)", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("C1");
      expect(stdout).toContain("C11");
      expect(stdout).toContain("aozu check");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains verdict ownership directive (human's responsibility)", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("verdict");
      expect(stdout).toContain("human");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stdout contains format rules summary text", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(stdout).toContain("Declaration syntax");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleReview — loop gate absent (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — loop gate absent", () => {
  it("loop disabled → exit 0 (no loop gate for review)", async () => {
    const { designDir, baseDir } = await createReviewLoopDisabledFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleReview — stage gates (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — stage gates", () => {
  it("design directory not found → exit 2", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "prompt", "review", "--dir", "/nonexistent/design"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });
});

// ---------------------------------------------------------------------------
// handleReview — deterministic output (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — deterministic output", () => {
  it("two runs with same fixture produce byte-identical stdout", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const run = async () => {
        const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await proc.exited;
        return new Response(proc.stdout).text();
      };
      const first = await run();
      const second = await run();
      expect(first).toBe(second);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleReview — stdout/stderr separation (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — stdout/stderr separation", () => {
  it("normal case: stdout is non-empty, stderr is empty", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
      expect(stderr).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleReview — filesystem non-write (T-05)
// ---------------------------------------------------------------------------

describe("handleReview — filesystem non-write", () => {
  it("does not write any files to the design directory", async () => {
    const { designDir, baseDir } = await createReviewFixture();
    try {
      const before = await listAllFiles(designDir);

      const proc = Bun.spawn(["bun", MAIN_TS, "prompt", "review", "--dir", designDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;

      const after = await listAllFiles(designDir);
      expect(after.sort()).toEqual(before.sort());
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handlePrompt dispatch — propagate / review (T-03, T-05)
// ---------------------------------------------------------------------------

describe("handlePrompt dispatch — propagate and review", () => {
  it('"propagate" subcommand is accepted (dispatched to handlePropagate)', async () => {
    // Calling without --adr should exit 2 (not "unknown subcommand")
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      const code = await handlePrompt(["propagate"]);
      // Without --adr: should be exit 2 from handlePropagate (missing arg), not unknown subcommand
      expect(code).toBe(2);
      expect(stderrOutput).not.toContain("unknown subcommand");
    } finally {
      process.stderr.write = origWrite;
    }
  });

  it('"review" subcommand is accepted (dispatched to handleReview)', async () => {
    // Calling without --dir pointing to non-existent path should exit 2 from handleReview
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      // Use default ./design which won't exist → exit 2 from handleReview
      const code = await handlePrompt(["review", "--dir", "/nonexistent/design"]);
      expect(code).toBe(2);
      expect(stderrOutput).not.toContain("unknown subcommand");
    } finally {
      process.stderr.write = origWrite;
    }
  });

  it("--help output contains 'propagate' subcommand", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["--help"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("propagate");
  });

  it("--help output contains 'review' subcommand", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["--help"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("review");
  });

  it("no subcommand error message contains 'propagate' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt([]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("propagate");
  });

  it("no subcommand error message contains 'review' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt([]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("review");
  });

  it("unknown subcommand error message contains 'propagate' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["unknown-sub"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("propagate");
  });

  it("unknown subcommand error message contains 'review' in Available list", async () => {
    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };
    try {
      await handlePrompt(["unknown-sub"]);
    } finally {
      process.stderr.write = origWrite;
    }
    expect(stderrOutput).toContain("review");
  });
});

// ---------------------------------------------------------------------------
// T-01: format-version fence — prompt session command
// ---------------------------------------------------------------------------

describe("handleSession — format-version fence (C12)", () => {
  it("returns non-0 for unknown format-version in manifest", async () => {
    const { handleSession } = await import("./prompt.ts");
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-session-fv-test-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "topics"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 99", "enabled: static, loop", "---", "", "# manifest"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# Modules", "", "## App {#mod-app}", "責務: app.", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    await writeFile(
      join(designDir, "topics", "my-topic.md"),
      ["---", "id: top-my-topic", "---", "", "topic body"].join("\n")
    );

    try {
      const exitCode = await handleSession(["--topic", "top-my-topic", "--dir", designDir]);
      expect(exitCode).not.toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-02: SESSION_GUIDANCE topics 書式確認
// ---------------------------------------------------------------------------

describe("SESSION_GUIDANCE — topics 書式", () => {
  it("contains bracket form 'topics: [[top-'", async () => {
    const { SESSION_GUIDANCE } = await import("../../prompt/session.ts");
    expect(SESSION_GUIDANCE).toContain("topics: [[top-");
  });

  it("does not contain plain form 'topics: top-' (without [[)]", async () => {
    const { SESSION_GUIDANCE } = await import("../../prompt/session.ts");
    // Should not contain 'topics: top-' without the [[ brackets
    const hasPlain = SESSION_GUIDANCE.includes("topics: top-");
    expect(hasPlain).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-04: derive エラーメッセージ確認 — request-template / request-output-dir
// ---------------------------------------------------------------------------

describe("handleDerive — error messages contain config key names", () => {
  it("missing request-template: stderr contains 'request-template:'", async () => {
    const { handleDerive } = await import("./prompt.ts");
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-derive-tpl-test-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "plans"), { recursive: true });

    // manifest with loop enabled but no request-template
    await writeFile(
      join(designDir, "manifest.md"),
      [
        "---",
        "format-version: 0",
        "enabled: static, domain, dynamic, loop",
        // no request-template
        "---",
        "",
        "# manifest",
      ].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# Modules", "", "## App {#mod-app}", "責務: app.", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    await writeFile(
      join(designDir, "plans", "my-plan.md"),
      [
        "---", "id: plan-my-plan", "status: open", "---",
        "## グループ {#grp-my-plan}",
        "- elements: [[mod-app]]",
        "- parallel: no",
      ].join("\n")
    );

    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };

    try {
      const exitCode = await handleDerive(["--group", "grp-my-plan", "--dir", designDir]);
      process.stderr.write = origWrite;
      expect(exitCode).toBe(2);
      expect(stderrOutput).toContain("request-template:");
    } finally {
      process.stderr.write = origWrite;
      await rm(baseDir, { recursive: true });
    }
  });

  it("missing request-output-dir: stderr contains 'request-output-dir:'", async () => {
    const { handleDerive } = await import("./prompt.ts");
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-derive-dir-test-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "plans"), { recursive: true });

    // manifest with loop + template but no output-dir
    await writeFile(
      join(designDir, "manifest.md"),
      [
        "---",
        "format-version: 0",
        "enabled: static, domain, dynamic, loop",
        "request-template: template.md",
        // no request-output-dir
        "---",
        "",
        "# manifest",
      ].join("\n")
    );
    await writeFile(join(designDir, "template.md"), "# Template\n");
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# Modules", "", "## App {#mod-app}", "責務: app.", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    await writeFile(
      join(designDir, "plans", "my-plan.md"),
      [
        "---", "id: plan-my-plan", "status: open", "---",
        "## グループ {#grp-my-plan}",
        "- elements: [[mod-app]]",
        "- parallel: no",
      ].join("\n")
    );

    let stderrOutput = "";
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") stderrOutput += chunk;
      return true;
    };

    try {
      const exitCode = await handleDerive(["--group", "grp-my-plan", "--dir", designDir]);
      process.stderr.write = origWrite;
      expect(exitCode).toBe(2);
      expect(stderrOutput).toContain("request-output-dir:");
    } finally {
      process.stderr.write = origWrite;
      await rm(baseDir, { recursive: true });
    }
  });
});
