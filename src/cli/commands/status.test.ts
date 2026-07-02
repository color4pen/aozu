/**
 * Tests for the `status` command handler.
 *
 * T-08: Covers computeFrontier unit tests (open topics, designed, requested),
 *        handleStatus integration (loop enabled / disabled),
 *        and stdout/stderr separation.
 */

import { describe, it, expect } from "bun:test";
import { computeFrontier, formatFrontier, formatSummary, handleStatus } from "./status.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { buildGraph } from "../../graph/builder.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest } from "../../check/manifest.ts";
import type { StateMap } from "../../state/types.ts";
import type { ParseResult } from "../../parse/types.ts";

/** Absolute path to this repository's design directory. */
const DESIGN_DIR = resolve(import.meta.dir, "../../../design");

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a design fixture with loop enabled containing:
 *   - top-open-topic (status: open, source: gh#1)
 *   - top-addressed-topic (status: addressed)
 *   - mod-app (static, designed — no state.json entry)
 *   - ent-order (domain, requested)
 *   - seq-my-flow (dynamic, implemented — must NOT appear in frontiers)
 *   - state.json with ent-order requested and seq-my-flow implemented
 */
async function createLoopFixture(): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-loop-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });
  await mkdir(join(designDir, "dynamic"), { recursive: true });
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

  // static/modules.md: mod-app (designed — no state.json entry)
  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール構成",
      "",
      "## アプリケーション {#mod-app}",
      "責務: アプリケーションのコア",
      "実装: src/",
    ].join("\n")
  );

  // static/dependencies.md: empty
  await writeFile(
    join(designDir, "static", "dependencies.md"),
    "# 許可依存\n"
  );

  // domain/model.md: ent-order (will be requested in state.json)
  await writeFile(
    join(designDir, "domain", "model.md"),
    [
      "# ドメインモデル",
      "",
      "## 注文 {#ent-order}",
      "注文エンティティ",
    ].join("\n")
  );

  // dynamic/my-flow.md: seq-my-flow (will be implemented — must not appear in frontiers)
  await writeFile(
    join(designDir, "dynamic", "my-flow.md"),
    [
      "---",
      "id: seq-my-flow",
      "---",
      "# フロー",
      "",
      "## 登場要素",
      "- [[mod-app]]",
      "",
      "## 流れ",
      "フローの説明",
    ].join("\n")
  );

  // topics/open-topic.md: top-open-topic (open)
  await writeFile(
    join(designDir, "topics", "open-topic.md"),
    [
      "---",
      "id: top-open-topic",
      "status: open",
      "source: gh#1",
      "---",
      "open な topic の説明",
    ].join("\n")
  );

  // topics/addressed-topic.md: top-addressed-topic (addressed)
  await writeFile(
    join(designDir, "topics", "addressed-topic.md"),
    [
      "---",
      "id: top-addressed-topic",
      "status: addressed",
      "---",
      "addressed な topic の説明",
    ].join("\n")
  );

  // state.json: ent-order requested, seq-my-flow implemented
  await writeFile(
    join(designDir, "state.json"),
    JSON.stringify({
      "ent-order": { state: "requested", request: "order-model-rework" },
      "seq-my-flow": { state: "implemented", request: "my-flow-impl", pr: 42 },
    }, null, 2)
  );

  return designDir;
}

// ---------------------------------------------------------------------------
// computeFrontier unit tests
// ---------------------------------------------------------------------------

describe("computeFrontier — open topics", () => {
  it("includes topics with status: open", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {
        "ent-order": { state: "requested", request: "order-model-rework" },
        "seq-my-flow": { state: "implemented", request: "my-flow-impl", pr: 42 },
      };

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      expect(frontier.openTopics.length).toBe(1);
      expect(frontier.openTopics[0]!.id).toBe("top-open-topic");
      expect(frontier.openTopics[0]!.source).toBe("gh#1");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("excludes topics with status: addressed", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {};

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      const addressedInOpenList = frontier.openTopics.some(
        (t) => t.id === "top-addressed-topic"
      );
      expect(addressedInOpenList).toBe(false);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("computeFrontier — designed elements", () => {
  it("includes elements with no state.json entry", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {
        "ent-order": { state: "requested", request: "order-model-rework" },
        "seq-my-flow": { state: "implemented", request: "my-flow-impl", pr: 42 },
      };

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      // mod-app has no state.json entry → designed
      expect(frontier.designed).toContain("mod-app");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("excludes elements with state: requested or implemented", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {
        "ent-order": { state: "requested", request: "order-model-rework" },
        "seq-my-flow": { state: "implemented", request: "my-flow-impl", pr: 42 },
      };

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      // ent-order is requested, seq-my-flow is implemented → neither in designed
      expect(frontier.designed).not.toContain("ent-order");
      expect(frontier.designed).not.toContain("seq-my-flow");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("excludes topics and plans from the designed list", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {};

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      // Topics appear in openTopics, not in designed
      const hasTopInDesigned = frontier.designed.some((id) => id.startsWith("top-"));
      expect(hasTopInDesigned).toBe(false);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("computeFrontier — requested elements", () => {
  it("includes elements with state: requested and their request slug", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {
        "ent-order": { state: "requested", request: "order-model-rework" },
      };

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      expect(frontier.requested.length).toBe(1);
      expect(frontier.requested[0]!.id).toBe("ent-order");
      expect(frontier.requested[0]!.request).toBe("order-model-rework");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("excludes elements with state: implemented from all frontiers", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);
      const stateMap: StateMap = {
        "seq-my-flow": { state: "implemented", request: "my-flow-impl", pr: 42 },
      };

      const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);

      expect(frontier.designed).not.toContain("seq-my-flow");
      expect(frontier.requested.some((r) => r.id === "seq-my-flow")).toBe(false);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// handleStatus integration tests
// ---------------------------------------------------------------------------

describe("handleStatus — loop enabled fixture", () => {
  it("outputs 3 frontier sections to stdout", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      // Capture stdout by using the subprocess
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "status", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, , exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("## Open Topics");
      expect(stdout).toContain("## Designed");
      expect(stdout).toContain("## Requested");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("shows open topic with source in frontier output", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "status", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, , exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("top-open-topic");
      expect(stdout).toContain("gh#1");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("handleStatus — loop disabled (this repository's design/)", () => {
  it("returns 0 using this repository's design/ (loop not enabled)", async () => {
    const exitCode = await handleStatus(["--dir", DESIGN_DIR]);
    expect(exitCode).toBe(0);
  });

  it("outputs summary with element count, reference count, and Check: OK/FAIL", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "status", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, , exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Elements:");
    expect(stdout).toContain("References:");
    expect(stdout).toContain("Check:");
    // loop not enabled → no frontier sections
    expect(stdout).not.toContain("## Open Topics");
    expect(stdout).not.toContain("## Designed");
    expect(stdout).not.toContain("## Requested");
  });
});

describe("handleStatus — --help", () => {
  it("returns 0 for --help", async () => {
    const exitCode = await handleStatus(["--help"]);
    expect(exitCode).toBe(0);
  });
});

describe("handleStatus — directory not found", () => {
  it("returns 2 when design directory does not exist", async () => {
    const exitCode = await handleStatus(["--dir", "/tmp/nonexistent-" + Date.now()]);
    expect(exitCode).toBe(2);
  });
});

describe("handleStatus — stdout / stderr separation", () => {
  it("outputs frontier to stdout; diagnostics only on stderr (loop enabled)", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "status", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      // Frontier content goes to stdout
      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout).toContain("## Open Topics");
      // No frontier content on stderr
      expect(stderr).not.toContain("## Open Topics");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("outputs summary to stdout (loop disabled)", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "status", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    // Summary goes to stdout
    expect(stdout).toContain("Elements:");
    // Summary does not go to stderr
    expect(stderr).not.toContain("Elements:");
  });
});

// ---------------------------------------------------------------------------
// formatFrontier and formatSummary unit tests
// ---------------------------------------------------------------------------

describe("formatFrontier", () => {
  it("formats all three sections correctly", () => {
    const frontier = {
      openTopics: [{ id: "top-issue-a", source: "gh#100" }],
      designed: ["mod-core"],
      requested: [{ id: "ent-order", request: "order-rework" }],
    };
    const output = formatFrontier(frontier);
    expect(output).toContain("## Open Topics (1)");
    expect(output).toContain("top-issue-a");
    expect(output).toContain("gh#100");
    expect(output).toContain("## Designed (1)");
    expect(output).toContain("mod-core");
    expect(output).toContain("## Requested (1)");
    expect(output).toContain("ent-order");
    expect(output).toContain("order-rework");
  });

  it("shows (none) for empty sections", () => {
    const frontier = {
      openTopics: [],
      designed: [],
      requested: [],
    };
    const output = formatFrontier(frontier);
    expect(output).toContain("## Open Topics (0)");
    expect(output).toContain("(none)");
  });
});

describe("formatSummary", () => {
  it("formats element count, reference count, and Check: OK", () => {
    const output = formatSummary(10, 5, true);
    expect(output).toContain("Elements: 10");
    expect(output).toContain("References: 5");
    expect(output).toContain("Check: OK");
  });

  it("formats Check: FAIL when check failed", () => {
    const output = formatSummary(3, 2, false);
    expect(output).toContain("Check: FAIL");
  });

  it("includes loop-not-enabled note", () => {
    const output = formatSummary(5, 3, true);
    expect(output).toContain("loop not enabled");
  });
});
