/**
 * Integration tests for the `coverage` command handler (T-04).
 *
 * Uses tmpdir fixture design directories with plan files and draft documents.
 * Verifies exit codes, state.json transitions, stderr diagnostics, and
 * stdout silence.
 */

import { describe, it, expect } from "bun:test";
import { handleCoverage } from "./coverage.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal loop-enabled design directory.
 *
 * Contains:
 *   - manifest.md (loop enabled)
 *   - static/modules.md: mod-alpha, mod-beta
 *   - static/dependencies.md: empty
 *   - plans/my-plan.md: plan-my-plan with grp-my-group containing mod-alpha, mod-beta
 *   - Optional state.json if stateEntries provided
 *
 * Returns the designDir path.
 */
async function createFixture(options: {
  stateJson?: Record<string, unknown>;
  groupElements?: string[]; // defaults to ["mod-alpha", "mod-beta"]
  afterEdge?: string; // e.g. "grp-group-b" to add after: [[grp-group-b]] to grp-my-group
  secondGroup?: { id: string; elements: string[] };
} = {}): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-coverage-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "plans"), { recursive: true });

  // manifest.md
  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, loop",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  // static/modules.md
  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール",
      "",
      "## Alpha モジュール {#mod-alpha}",
      "責務: alpha の処理",
      "実装: src/alpha/",
      "",
      "## Beta モジュール {#mod-beta}",
      "責務: beta の処理",
      "実装: src/beta/",
    ].join("\n")
  );

  // static/dependencies.md
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // plans/my-plan.md
  const groupElements = options.groupElements ?? ["mod-alpha", "mod-beta"];
  const elementsLine = `- elements: ${groupElements.map((id) => `[[${id}]]`).join(", ")}`;
  const afterLine = options.afterEdge ? `- after: [[${options.afterEdge}]]` : "- after: (none)";

  let planContent = [
    "---",
    "id: plan-my-plan",
    "status: open",
    "---",
    "## My Group {#grp-my-group}",
    elementsLine,
    afterLine,
    "- parallel: no",
  ].join("\n");

  // Add second group if requested
  if (options.secondGroup) {
    const secondElemsLine = `- elements: ${options.secondGroup.elements.map((id) => `[[${id}]]`).join(", ")}`;
    planContent += [
      "",
      `## Second Group {#${options.secondGroup.id}}`,
      secondElemsLine,
      "- after: (none)",
      "- parallel: no",
    ].join("\n");
  }

  await writeFile(join(designDir, "plans", "my-plan.md"), planContent);

  // state.json (optional)
  if (options.stateJson !== undefined) {
    await writeFile(
      join(designDir, "state.json"),
      JSON.stringify(options.stateJson, null, 2)
    );
  }

  return designDir;
}

/**
 * Create a draft file in a tmp location.
 * Returns the draft file path.
 */
async function createDraft(
  baseDir: string,
  content: string
): Promise<string> {
  const draftPath = join(baseDir, "draft.md");
  await writeFile(draftPath, content);
  return draftPath;
}

// ---------------------------------------------------------------------------
// T-04a: Normal case — full coverage → exit 0
// ---------------------------------------------------------------------------

describe("coverage — normal case (full coverage)", () => {
  it("exits 0 when draft cites all group elements", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "# Request\n\nThis covers [[mod-alpha]] and [[mod-beta]].\n"
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("writes all group elements as requested in state.json", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "# Request\n\nCovers [[mod-alpha]] and [[mod-beta]].\n"
      );

      await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      const stateContent = await readFile(join(designDir, "state.json"), "utf-8");
      const state = JSON.parse(stateContent);
      expect(state["mod-alpha"]).toEqual({ state: "requested", request: "my-request" });
      expect(state["mod-beta"]).toEqual({ state: "requested", request: "my-request" });
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("records the correct request slug in each state entry", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "[[mod-alpha]] and [[mod-beta]]"
      );

      await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "checkout-rework",
        "--dir", designDir,
      ]);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"]?.request).toBe("checkout-rework");
      expect(state["mod-beta"]?.request).toBe("checkout-rework");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04b: Missing citation → exit 1, state.json unchanged
// ---------------------------------------------------------------------------

describe("coverage — missing citation", () => {
  it("exits 1 when draft is missing a citation", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Only [[mod-alpha]] is cited, mod-beta is missing.\n"
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("stderr contains the missing element ID", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Only [[mod-alpha]] is cited.\n"
      );

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "coverage",
          "--group", "grp-my-group",
          "--draft", draftPath,
          "--request", "my-request",
          "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("mod-beta");
      expect(stdout).toBe(""); // nothing on stdout
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("state.json is unchanged after a failed coverage run", async () => {
    const initialState = { "ent-x": { state: "implemented", request: "old", pr: 1 } };
    const designDir = await createFixture({ stateJson: initialState });
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Only [[mod-alpha]] is cited.\n"
      );

      await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      // ent-x should be untouched; mod-alpha and mod-beta should NOT be requested
      expect(state["ent-x"]).toEqual({ state: "implemented", request: "old", pr: 1 });
      expect(state["mod-alpha"]).toBeUndefined();
      expect(state["mod-beta"]).toBeUndefined();
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04c: State check — requested/implemented → exit 1, state.json unchanged
// ---------------------------------------------------------------------------

describe("coverage — state check (adr/0018-4)", () => {
  it("exits 1 when group contains a requested element", async () => {
    const designDir = await createFixture({
      stateJson: { "mod-alpha": { state: "requested", request: "other-req" } },
    });
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Covers [[mod-alpha]] and [[mod-beta]].\n"
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 1 when group contains an implemented element", async () => {
    const designDir = await createFixture({
      stateJson: { "mod-beta": { state: "implemented", request: "old-req", pr: 5 } },
    });
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Covers [[mod-alpha]] and [[mod-beta]].\n"
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("state.json is unchanged after state-check failure", async () => {
    const initial = { "mod-alpha": { state: "requested", request: "other-req" } };
    const designDir = await createFixture({ stateJson: initial });
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        "Covers [[mod-alpha]] and [[mod-beta]].\n"
      );

      await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      // Should still be the original state
      expect(state["mod-alpha"]).toEqual({ state: "requested", request: "other-req" });
      expect(state["mod-beta"]).toBeUndefined();
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04d: Code fence exclusion test
// ---------------------------------------------------------------------------

describe("coverage — code fence exclusion (spec §6)", () => {
  it("exits 1 when [[id]] only appears inside a code fence (not counted as citation)", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      // mod-alpha is only inside a code fence; mod-beta is in regular text
      const draftPath = await createDraft(
        baseDir,
        [
          "# Request",
          "",
          "```",
          "[[mod-alpha]]",
          "```",
          "",
          "[[mod-beta]] is cited outside the fence.",
        ].join("\n")
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      // mod-alpha is not covered (only in code fence)
      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 0 when [[id]] appears outside a code fence", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(
        baseDir,
        [
          "# Request",
          "",
          "```",
          "some code",
          "```",
          "",
          "[[mod-alpha]] and [[mod-beta]] are both cited outside fences.",
        ].join("\n")
      );

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04e: Cross-group reference warning
// ---------------------------------------------------------------------------

describe("coverage — cross-group reference warning", () => {
  it("emits warning to stderr for cross-group refs without after:, but exits 0 if coverage is complete", async () => {
    // Create a fixture where mod-alpha's file references mod-beta, but they're in different groups
    // For simplicity: create two groups where grp-my-group has mod-alpha, grp-second has mod-beta
    // AND mod-alpha file references mod-beta (simulate via references in modules.md)

    const baseDir = await mkdtemp(join(tmpdir(), "aozu-coverage-crossgrp-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "plans"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );

    // modules.md: mod-alpha references mod-beta
    await writeFile(
      join(designDir, "static", "modules.md"),
      [
        "# モジュール",
        "",
        "## Alpha {#mod-alpha}",
        "責務: alpha の処理",
        "実装: src/alpha/",
        "依存: [[mod-beta]]",
        "",
        "## Beta {#mod-beta}",
        "責務: beta の処理",
        "実装: src/beta/",
      ].join("\n")
    );

    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n- [[mod-alpha]] -> [[mod-beta]]\n");

    // Two groups: grp-my-group has mod-alpha, grp-second-group has mod-beta
    await writeFile(
      join(designDir, "plans", "my-plan.md"),
      [
        "---",
        "id: plan-my-plan",
        "status: open",
        "---",
        "## My Group {#grp-my-group}",
        "- elements: [[mod-alpha]]",
        "- after: (none)",
        "- parallel: no",
        "",
        "## Second Group {#grp-second-group}",
        "- elements: [[mod-beta]]",
        "- after: (none)",
        "- parallel: no",
      ].join("\n")
    );

    try {
      const draftPath = await createDraft(
        baseDir,
        "This request covers [[mod-alpha]].\n"
      );

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "coverage",
          "--group", "grp-my-group",
          "--draft", draftPath,
          "--request", "my-request",
          "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      // Should exit 0 (coverage is complete for grp-my-group)
      expect(exitCode).toBe(0);
      // Should emit cross-group warning to stderr
      expect(stderr).toContain("WARN");
      // Nothing on stdout
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04f: loop disabled → exit 1
// ---------------------------------------------------------------------------

describe("coverage — loop disabled", () => {
  it("exits 1 when loop is not in manifest enabled", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-coverage-noloop-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## Alpha {#mod-alpha}", "責務: alpha", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]]");

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04g: Input error cases → exit 2
// ---------------------------------------------------------------------------

describe("coverage — input errors (exit 2)", () => {
  it("exits 2 when draft file does not exist", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", "/nonexistent/draft.md",
        "--request", "my-request",
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 2 when group does not exist", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]] [[mod-beta]]");

      const exitCode = await handleCoverage([
        "--group", "grp-nonexistent",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 2 when slug has invalid grammar (uppercase)", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]] [[mod-beta]]");

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "MyRequest",  // uppercase = invalid
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 2 when slug has invalid grammar (underscore)", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]] [[mod-beta]]");

      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my_request",  // underscore = invalid
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 2 when design directory does not exist", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-coverage-nodir-"));
    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]]");
      const exitCode = await handleCoverage([
        "--group", "grp-my-group",
        "--draft", draftPath,
        "--request", "my-request",
        "--dir", "/nonexistent/design",
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 2 when --group is missing", async () => {
    const exitCode = await handleCoverage([
      "--draft", "/some/draft.md",
      "--request", "my-request",
    ]);
    expect(exitCode).toBe(2);
  });

  it("exits 2 when --draft is missing", async () => {
    const exitCode = await handleCoverage([
      "--group", "grp-my-group",
      "--request", "my-request",
    ]);
    expect(exitCode).toBe(2);
  });

  it("exits 2 when --request is missing", async () => {
    const exitCode = await handleCoverage([
      "--group", "grp-my-group",
      "--draft", "/some/draft.md",
    ]);
    expect(exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T-04h: stdout is always empty
// ---------------------------------------------------------------------------

describe("coverage — stdout is empty", () => {
  it("produces no stdout output on success", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(baseDir, "[[mod-alpha]] [[mod-beta]]");

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "coverage",
          "--group", "grp-my-group",
          "--draft", draftPath,
          "--request", "my-request",
          "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("produces no stdout output on failure", async () => {
    const designDir = await createFixture();
    const baseDir = join(designDir, "..");
    try {
      const draftPath = await createDraft(baseDir, "Only [[mod-alpha]] cited.");

      const proc = Bun.spawn(
        ["bun", MAIN_TS, "coverage",
          "--group", "grp-my-group",
          "--draft", draftPath,
          "--request", "my-request",
          "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04i: --help
// ---------------------------------------------------------------------------

describe("coverage — --help", () => {
  it("returns 0 for --help", async () => {
    const exitCode = await handleCoverage(["--help"]);
    expect(exitCode).toBe(0);
  });
});
