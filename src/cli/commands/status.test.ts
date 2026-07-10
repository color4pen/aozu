/**
 * Tests for the `status` command handler.
 *
 * T-08: Covers computeFrontier unit tests (open topics, designed, requested),
 *        handleStatus integration (loop enabled / disabled),
 *        stdout/stderr separation, and ADR-0018-3 openTopics semantics.
 */

import { describe, it, expect } from "bun:test";
import { computeFrontier, extractAddressedTopics, formatFrontier, formatSummary, handleStatus } from "./status.ts";
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

  // topics/open-topic.md: top-open-topic
  // NOT cited by any ADR → open (ADR-0018-3: open = not cited in ADR topics:)
  // Retains `status: open` in frontmatter to verify that the STATUS FIELD IS IGNORED
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

  // topics/addressed-topic.md: top-addressed-topic
  // Cited in ADR below → addressed (ADR-0018-3).
  // Retains `status: addressed` in frontmatter to verify that the STATUS FIELD IS IGNORED
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

  // adr/0001-decision.md: cites top-addressed-topic in topics: frontmatter
  // This makes top-addressed-topic addressed under ADR-0018-3 semantics.
  await writeFile(
    join(designDir, "adr", "0001-decision.md"),
    [
      "---",
      "id: adr-0001-decision",
      "topics: [[top-addressed-topic]]",
      "---",
      "# Decision about the addressed topic",
      "",
      "## Context",
      "See [[top-addressed-topic]] for background.",
      "",
      "## Decision",
      "Decided.",
      "",
      "## Consequences",
      "None.",
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

describe("computeFrontier — open topics (ADR-0018-3 semantics)", () => {
  it("includes topics NOT cited in any ADR topics: frontmatter (open)", async () => {
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

      // top-open-topic is NOT cited in any ADR topics: → open
      expect(frontier.openTopics.length).toBe(1);
      expect(frontier.openTopics[0]!.id).toBe("top-open-topic");
      expect(frontier.openTopics[0]!.source).toBe("gh#1");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("excludes topics cited in ADR topics: frontmatter (addressed via ADR-0018-3)", async () => {
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

      // top-addressed-topic IS cited in adr/0001-decision.md topics: → addressed → not in open
      const addressedInOpenList = frontier.openTopics.some(
        (t) => t.id === "top-addressed-topic"
      );
      expect(addressedInOpenList).toBe(false);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("treats topic as open when it has status: addressed frontmatter but is NOT in any ADR topics:", async () => {
    // Create a fixture where a topic has `status: addressed` in its own frontmatter
    // but is NOT referenced in any ADR's topics: line.
    // Under ADR-0018-3, this topic should appear as OPEN (status field is ignored).
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-old-status-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "topics"), { recursive: true });
    await mkdir(join(designDir, "adr"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    // Topic with `status: addressed` in its OWN frontmatter (old style)
    await writeFile(
      join(designDir, "topics", "old-style.md"),
      ["---", "id: top-old-style", "status: addressed", "---", "old style addressed"].join("\n")
    );

    // ADR with topics: citing a DIFFERENT topic (not top-old-style)
    await writeFile(
      join(designDir, "adr", "0001-other.md"),
      [
        "---",
        "id: adr-0001-other",
        "topics: [[top-nonexistent]]",
        "---",
        "# Other ADR",
        "## Context",
        "nothing",
        "## Decision",
        "done",
        "## Consequences",
        "none",
      ].join("\n")
    );

    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);

      const frontier = computeFrontier(graph, {}, manifest, parsed.frontmatters);

      // top-old-style has status: addressed in its OWN frontmatter BUT is not in any ADR topics:
      // → under ADR-0018-3, it is OPEN (status field is ignored)
      const isOpen = frontier.openTopics.some((t) => t.id === "top-old-style");
      expect(isOpen).toBe(true);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("treats topic as open when it has no status frontmatter at all", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-nostatus-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "topics"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    // Topic with NO status field
    await writeFile(
      join(designDir, "topics", "no-status.md"),
      ["---", "id: top-no-status", "---", "topic without status field"].join("\n")
    );

    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);

      const frontier = computeFrontier(graph, {}, manifest, parsed.frontmatters);

      // No ADR cites it → open
      expect(frontier.openTopics.some((t) => t.id === "top-no-status")).toBe(true);
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

  it("includes act elements in the designed frontier (ADR-0015 × ADR-0005)", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      // Add an actor — a first-class domain element that must participate in
      // the state machine like any other element.
      await writeFile(
        join(designDir, "domain", "actors.md"),
        [
          "# アクター",
          "",
          "## 営業 {#act-sales}",
          "受注の入力に責任を持つ。",
        ].join("\n")
      );

      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const manifestPath = join(designDir, "manifest.md");
      const manifest = parseManifest(parsed.frontmatters, manifestPath);
      const graph = buildGraph(parsed, manifestPath);

      const frontier = computeFrontier(graph, {}, manifest, parsed.frontmatters);

      expect(frontier.designed).toContain("act-sales");
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

// ---------------------------------------------------------------------------
// extractAddressedTopics unit tests (T-08: ADR-0018-3)
// ---------------------------------------------------------------------------

describe("extractAddressedTopics — ADR-0018-3 addressed topic computation", () => {
  it("returns empty set when no ADR files exist", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-addressed-empty-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });
    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const addressed = extractAddressedTopics(parsed.frontmatters, graph);
      expect(addressed.size).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("includes top-* IDs from ADR topics: frontmatter", async () => {
    const designDir = await createLoopFixture();
    const baseDir = join(designDir, "..");
    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const addressed = extractAddressedTopics(parsed.frontmatters, graph);

      // adr/0001-decision.md has topics: [[top-addressed-topic]]
      expect(addressed.has("top-addressed-topic")).toBe(true);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("does not include top-* IDs only referenced in ADR body text (not topics: frontmatter)", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-addressed-body-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "topics"), { recursive: true });
    await mkdir(join(designDir, "adr"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    await writeFile(
      join(designDir, "topics", "body-only.md"),
      ["---", "id: top-body-only", "---", "topic"].join("\n")
    );

    // ADR cites top-body-only in the BODY but NOT in topics: frontmatter
    await writeFile(
      join(designDir, "adr", "0001.md"),
      [
        "---",
        "id: adr-0001-test",
        "topics: [[top-nonexistent]]",
        "---",
        "# ADR",
        "## Context",
        "See [[top-body-only]] for background (body reference, not topics: frontmatter).",
        "## Decision",
        "done",
        "## Consequences",
        "none",
      ].join("\n")
    );

    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const addressed = extractAddressedTopics(parsed.frontmatters, graph);

      // top-body-only is only in the body, NOT in topics: frontmatter → NOT addressed
      expect(addressed.has("top-body-only")).toBe(false);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("handles frontmatter topics: as comma-separated list", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-addressed-multi-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });
    await mkdir(join(designDir, "topics"), { recursive: true });
    await mkdir(join(designDir, "adr"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    for (const slug of ["topic-a", "topic-b"]) {
      await writeFile(
        join(designDir, "topics", `${slug}.md`),
        ["---", `id: top-${slug}`, "---", "topic"].join("\n")
      );
    }

    // ADR with comma-separated topics:
    await writeFile(
      join(designDir, "adr", "0001.md"),
      [
        "---",
        "id: adr-0001-multi",
        "topics: [[top-topic-a]], [[top-topic-b]]",
        "---",
        "# Multi-topic ADR",
        "## Context",
        "multiple topics",
        "## Decision",
        "done",
        "## Consequences",
        "none",
      ].join("\n")
    );

    try {
      const files = await (await import("../../fs/reader.ts")).readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const addressed = extractAddressedTopics(parsed.frontmatters, graph);

      expect(addressed.has("top-topic-a")).toBe(true);
      expect(addressed.has("top-topic-b")).toBe(true);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-01: format-version fence — status command
// ---------------------------------------------------------------------------

describe("handleStatus — format-version fence (C12)", () => {
  it("returns non-0 for unknown format-version in manifest", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-fv-test-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 99", "enabled: static", "---", "", "# manifest"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# Modules", "", "## App {#mod-app}", "責務: app.", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

    try {
      const exitCode = await handleStatus(["--dir", designDir]);
      expect(exitCode).not.toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-07: status drift annotation tests
// ---------------------------------------------------------------------------

/**
 * Create a fixture with a drifted element for status tests.
 * Returns designDir and the baseDir for cleanup.
 */
async function createStatusDriftFixture(): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-drift-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });
  await mkdir(join(designDir, "domain"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", "enabled: static, domain, loop", "---", "", "# manifest"].join("\n")
  );

  // Two elements: mod-alpha (will drift) and ent-billing (regular designed)
  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## Alpha {#mod-alpha}", "責務: alpha (original)", "実装: src/alpha/"].join("\n")
  );
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
  await writeFile(
    join(designDir, "domain", "model.md"),
    ["# モデル", "", "## 請求 {#ent-billing}", "請求の説明。"].join("\n")
  );

  // Compute hash of mod-alpha original range
  const { buildGraph } = await import("../../graph/builder.ts");
  const { parseFiles: pf } = await import("../../parse/parser.ts");
  const { computeElementHash } = await import("../../graph/body.ts");
  const { readMarkdownFiles: rmf } = await import("../../fs/reader.ts");

  const files = await rmf(designDir);
  const parsed = pf(files);
  const graph = buildGraph(parsed, join(designDir, "manifest.md"));
  const recordedHash = computeElementHash("mod-alpha", graph, files)!;

  // state.json: mod-alpha implemented with recorded hash; ent-billing designed (no entry)
  await writeFile(
    join(designDir, "state.json"),
    JSON.stringify({ "mod-alpha": { state: "implemented", request: "prev", hash: recordedHash } })
  );

  // Modify mod-alpha body to create drift
  await writeFile(
    join(designDir, "static", "modules.md"),
    ["# モジュール", "", "## Alpha {#mod-alpha}", "責務: alpha (modified — drift)", "実装: src/alpha/"].join("\n")
  );

  return { designDir, baseDir };
}

describe("handleStatus — drift annotation in Designed frontier (T-07)", () => {
  it("drifted element appears in Designed with drift annotation", async () => {
    const { designDir, baseDir } = await createStatusDriftFixture();
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
      expect(stdout).toContain("mod-alpha");
      expect(stdout).toContain("drift: 実装時記録から本文が乖離");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("non-drifted designed element has no drift annotation", async () => {
    const { designDir, baseDir } = await createStatusDriftFixture();
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
      // ent-billing should appear without annotation
      expect(stdout).toContain("ent-billing");
      // ent-billing line should not have the drift note
      const lines = stdout.split("\n");
      const billingLine = lines.find(l => l.includes("ent-billing"));
      expect(billingLine).toBeDefined();
      expect(billingLine!).not.toContain("drift:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("loop disabled: summary output, no drift computation", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-status-nodrift-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["## App {#mod-app}", "責務: app", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

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
      expect(stdout).toContain("loop not enabled");
      expect(stdout).not.toContain("drift:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("formatFrontier — drift annotation", () => {
  it("annotates drifted IDs in Designed section", () => {
    const frontier = {
      openTopics: [],
      designed: ["ent-order", "mod-cli"],
      requested: [],
    };
    const driftedIds = new Set(["ent-order"]);
    const output = formatFrontier(frontier, driftedIds);

    expect(output).toContain("ent-order (drift: 実装時記録から本文が乖離)");
    // mod-cli is not drifted — no annotation
    const lines = output.split("\n");
    const cliLine = lines.find(l => l.includes("mod-cli"))!;
    expect(cliLine).not.toContain("drift:");
  });

  it("no driftedIds argument: no annotations", () => {
    const frontier = {
      openTopics: [],
      designed: ["ent-order"],
      requested: [],
    };
    const output = formatFrontier(frontier);
    expect(output).not.toContain("drift:");
  });
});
