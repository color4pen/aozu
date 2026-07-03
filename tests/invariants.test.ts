/**
 * Invariant coverage test (歯) — aozu self-verification.
 *
 * For each of the 5 invariants in design/domain/invariants.md, this file
 * declares one of:
 *   - "tested"          : mechanized grep test implemented in this file
 *   - "covered"         : existing test gate (see detail)
 *   - "not-mechanizable": excluded with reason recorded here
 *
 * Coverage table:
 * ┌──────────────────────────────┬──────────────────────┬─────────────────────────────────────────────────────────────────┐
 * │ inv-deterministic-verdict    │ tested               │ 本ファイル内の grep テスト（subprocess/fetch 禁止）              │
 * │ inv-immutable-id             │ not-mechanizable     │ 改名 = 削除 + 新規の意味論は mod-diff 実装まで観測点なし         │
 * │ inv-tool-writes-state        │ tested               │ 本ファイル内の grep テスト（write API + state.json 共起禁止）   │
 * │ inv-fail-closed-deps         │ covered              │ tests/architecture.test.ts — 未マップ = 違反・許可リスト方式    │
 * │ inv-single-reference-grammar │ tested               │ 本ファイル内の grep テスト（\[\[ regex 禁止域）                  │
 * └──────────────────────────────┴──────────────────────┴─────────────────────────────────────────────────────────────────┘
 *
 * Spec: design/domain/invariants.md
 */

import { describe, it, expect } from "bun:test";
import { resolve, join, basename } from "path";
import { readdir, readFile, mkdtemp, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CoverageStatus = "tested" | "covered" | "not-mechanizable";

interface CoverageEntry {
  status: CoverageStatus;
  detail: string;
}

// ---------------------------------------------------------------------------
// Coverage Table
// ---------------------------------------------------------------------------

const COVERAGE_TABLE: Record<string, CoverageEntry> = {
  "inv-deterministic-verdict": {
    status: "tested",
    detail: "本ファイル内の grep テスト（subprocess/fetch 禁止）",
  },
  "inv-immutable-id": {
    status: "not-mechanizable",
    detail: "改名 = 削除 + 新規の意味論は mod-diff 実装まで観測点なし。mod-diff 実装時に再訪",
  },
  "inv-tool-writes-state": {
    status: "tested",
    detail: "本ファイル内の grep テスト（write API + state.json 共起禁止）",
  },
  "inv-fail-closed-deps": {
    status: "covered",
    detail: "tests/architecture.test.ts — 未マップ = 違反・許可リスト方式",
  },
  "inv-single-reference-grammar": {
    status: "tested",
    detail: "本ファイル内の grep テスト（\\[\\[ regex 禁止域）",
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute path to the repository root. */
const REPO_ROOT = resolve(import.meta.dir, "..");

/** Absolute path to the src directory. */
const SRC_DIR = join(REPO_ROOT, "src");

// ---------------------------------------------------------------------------
// Utility: file scanner
// ---------------------------------------------------------------------------

/**
 * Recursively collect non-test `.ts` files under `dir`.
 * Returns absolute paths of files whose names end with `.ts` but not `.test.ts`.
 */
async function collectNonTestTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  await _collectRec(dir, out);
  return out;
}

async function _collectRec(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await _collectRec(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      out.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: extract inv-* IDs from invariants.md
// ---------------------------------------------------------------------------

/**
 * Extract all `{#inv-*}` IDs from invariants.md content.
 * Uses the pattern `/\{#(inv-[a-z0-9-]+)\}/g`.
 */
export function extractInvariantIds(content: string): string[] {
  const ids: string[] = [];
  const re = /\{#(inv-[a-z0-9-]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    ids.push(match[1]!);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Detection: inv-tool-writes-state
// ---------------------------------------------------------------------------

/** Matches file-write APIs (Bun.write, fs write variants). */
const WRITE_API_RE =
  /Bun\.write|writeFile|writeFileSync|createWriteStream|appendFile|appendFileSync/;

/** Matches the literal string `state.json`. */
const STATE_JSON_RE = /state\.json/;

/**
 * Returns true if both a file-write API and `state.json` appear in the same
 * source file content — indicating direct state file mutation outside
 * `src/state/`.
 */
export function detectStateWriteViolation(content: string): boolean {
  return WRITE_API_RE.test(content) && STATE_JSON_RE.test(content);
}

// ---------------------------------------------------------------------------
// Detection: inv-single-reference-grammar
// ---------------------------------------------------------------------------

/**
 * Matches the 4-character sequence `\[\[` (backslash + `[` + backslash + `[`)
 * which is the signature of a regex that *interprets* `[[id]]` references.
 *
 * Plain `[[...]]` text in template strings or line comments contains only
 * bare brackets (no preceding backslash) and does NOT trigger this pattern.
 */
const REF_GRAMMAR_RE = /\\\[\\\[/;

/**
 * Returns true if the content appears to interpret `[[...]]` references via
 * a regex (regex literal `/\[\[.../` or similar `RegExp` construction), which
 * is only permitted in `src/parse/`.
 */
export function detectReferenceGrammarViolation(content: string): boolean {
  return REF_GRAMMAR_RE.test(content);
}

// ---------------------------------------------------------------------------
// Detection: inv-deterministic-verdict
// ---------------------------------------------------------------------------

/** Matches subprocess execution patterns. */
const SUBPROCESS_RE = /Bun\.spawn|spawnSync|child_process|Bun\.\$/;

/** Matches network call patterns (word-boundary anchored to avoid false positives like `prefetch`). */
const NETWORK_RE = /\bfetch\s*\(/;

/**
 * Returns true if the content uses subprocess execution or outbound network
 * I/O, which are forbidden in verdict-owning modules (check / export /
 * state / plan).
 */
export function detectNondeterministicViolation(content: string): boolean {
  return SUBPROCESS_RE.test(content) || NETWORK_RE.test(content);
}

// ---------------------------------------------------------------------------
// Helper: verdict-owning module directories
// ---------------------------------------------------------------------------

/**
 * Returns the list of verdict-owning module directories to scan.
 * Includes `src/plan` only if it exists (future module).
 *
 * mod-cli and mod-prompt are intentionally excluded: composition root is
 * permitted to invoke subprocess for template retrieval.
 */
export function getVerdictModuleDirs(): string[] {
  const dirs = [
    join(SRC_DIR, "check"),
    join(SRC_DIR, "export"),
    join(SRC_DIR, "state"),
  ];
  const planDir = join(SRC_DIR, "plan");
  if (existsSync(planDir)) {
    dirs.push(planDir);
  }
  return dirs;
}

// ===========================================================================
// T-01: Coverage Table — Completeness
// ===========================================================================

describe("inv coverage table — completeness (T-01)", () => {
  it("coverage table keys match design/domain/invariants.md IDs exactly", async () => {
    const invariantsPath = join(REPO_ROOT, "design/domain/invariants.md");
    const content = await readFile(invariantsPath, "utf-8");
    const mdIds = extractInvariantIds(content).sort();
    const tableIds = Object.keys(COVERAGE_TABLE).sort();

    const missingFromTable = mdIds.filter((id) => !tableIds.includes(id));
    const extraInTable = tableIds.filter((id) => !mdIds.includes(id));

    expect(
      missingFromTable,
      `IDs in invariants.md but absent from COVERAGE_TABLE: ${missingFromTable.join(", ")}`
    ).toEqual([]);

    expect(
      extraInTable,
      `IDs in COVERAGE_TABLE but absent from invariants.md: ${extraInTable.join(", ")}`
    ).toEqual([]);
  });

  it("all coverage entries have valid status values", () => {
    const validStatuses: CoverageStatus[] = [
      "tested",
      "covered",
      "not-mechanizable",
    ];
    for (const [id, entry] of Object.entries(COVERAGE_TABLE)) {
      expect(
        validStatuses.includes(entry.status),
        `${id}: invalid status "${entry.status}"`
      ).toBe(true);
    }
  });
});

// ===========================================================================
// TC-004: extractInvariantIds — unit tests
// ===========================================================================

describe("extractInvariantIds — unit tests (TC-004)", () => {
  it("extracts all {#inv-*} IDs from a synthetic fixture", () => {
    const fixture = [
      "## inv-deterministic-verdict {#inv-deterministic-verdict}",
      "## inv-immutable-id {#inv-immutable-id}",
      "## inv-tool-writes-state {#inv-tool-writes-state}",
    ].join("\n");

    const ids = extractInvariantIds(fixture);
    expect(ids).toContain("inv-deterministic-verdict");
    expect(ids).toContain("inv-immutable-id");
    expect(ids).toContain("inv-tool-writes-state");
    expect(ids).toHaveLength(3);
  });

  it("returns empty array when no {#inv-*} IDs are present", () => {
    const fixture = "## Some heading\n\nNo invariant IDs here.";
    expect(extractInvariantIds(fixture)).toEqual([]);
  });

  it("does not match non-inv anchors like {#arch-001}", () => {
    const fixture =
      "Some text {#arch-001} and also {#inv-deterministic-verdict}";
    const ids = extractInvariantIds(fixture);
    expect(ids).toEqual(["inv-deterministic-verdict"]);
  });
});

// ===========================================================================
// TC-005: collectNonTestTsFiles — unit tests
// ===========================================================================

describe("collectNonTestTsFiles — excludes *.test.ts (TC-005)", () => {
  it("includes plain *.ts files but excludes *.test.ts files from a mixed directory", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "invariant-tc005-"));
    try {
      await writeFile(join(tmpDir, "helper.ts"), "export const x = 1;");
      await writeFile(
        join(tmpDir, "helper.test.ts"),
        "import { x } from './helper';"
      );
      await writeFile(join(tmpDir, "utils.ts"), "export const y = 2;");

      const result = await collectNonTestTsFiles(tmpDir);
      const names = result.map((f) => basename(f));

      expect(names, "*.test.ts must be excluded").not.toContain(
        "helper.test.ts"
      );
      expect(names, "plain .ts must be included").toContain("helper.ts");
      expect(names, "plain .ts must be included").toContain("utils.ts");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns an empty array for a directory containing only *.test.ts files", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "invariant-tc005b-"));
    try {
      await writeFile(join(tmpDir, "foo.test.ts"), "// test only");

      const result = await collectNonTestTsFiles(tmpDir);
      expect(result).toEqual([]);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// T-03: inv-tool-writes-state
// ===========================================================================

describe("inv-tool-writes-state — fixture tests (T-03)", () => {
  // --- Positive (violation detected) ---

  it("detects Bun.write + state.json co-occurrence (positive)", () => {
    const fixture = 'await Bun.write(join(dir, "state.json"), data);';
    expect(detectStateWriteViolation(fixture)).toBe(true);
  });

  it("detects writeFile + state.json co-occurrence (positive)", () => {
    const fixture =
      'await writeFile(join(dir, "state.json"), JSON.stringify(data));';
    expect(detectStateWriteViolation(fixture)).toBe(true);
  });

  // --- Negative (no violation) ---

  it("does not flag Bun.write without state.json (negative)", () => {
    const fixture = 'await Bun.write(join(dir, "manifest.md"), content);';
    expect(detectStateWriteViolation(fixture)).toBe(false);
  });

  it("does not flag state.json reference without write API (negative)", () => {
    const fixture =
      'const stateMap = await readState(join(designDir, "state.json"));';
    expect(detectStateWriteViolation(fixture)).toBe(false);
  });

  it("does not flag empty string (negative)", () => {
    expect(detectStateWriteViolation("")).toBe(false);
  });
});

describe("inv-tool-writes-state — src/ scan, excluding src/state/ (T-03)", () => {
  it("no non-state src file co-locates a write API with state.json", async () => {
    const stateDir = join(SRC_DIR, "state");
    const allFiles = await collectNonTestTsFiles(SRC_DIR);
    // Exclude src/state/ — that module legitimately manages state.json I/O
    const scanFiles = allFiles.filter(
      (f) => !f.startsWith(stateDir + "/") && f !== stateDir
    );

    const violations: string[] = [];
    for (const filePath of scanFiles) {
      const content = await readFile(filePath, "utf-8");
      if (detectStateWriteViolation(content)) {
        violations.push(filePath.replace(REPO_ROOT + "/", ""));
      }
    }

    expect(
      violations,
      `Files outside src/state/ that write state.json: ${violations.join(", ")}`
    ).toEqual([]);
  });
});

// ===========================================================================
// T-04: inv-single-reference-grammar
// ===========================================================================

describe("inv-single-reference-grammar — fixture tests (T-04)", () => {
  // --- Positive (violation detected) ---

  it("detects regex literal /\\[\\[/ pattern (positive)", () => {
    // Represents source code: const RE = /\[\[([a-z0-9-]+)\]\]/g;
    const fixture = "const RE = /\\[\\[([a-z0-9-]+)\\]\\]/g;";
    expect(detectReferenceGrammarViolation(fixture)).toBe(true);
  });

  it("detects RegExp constructor with \\[\\[ (positive)", () => {
    // Represents source code using new RegExp("\[\[") — single-backslash form
    const fixture = 'new RegExp("\\[\\[")';
    expect(detectReferenceGrammarViolation(fixture)).toBe(true);
  });

  // --- Negative (no violation) ---

  it("does not flag template literal [[mod-xxx]] (negative)", () => {
    const fixture = "`[[mod-xxx]]`";
    expect(detectReferenceGrammarViolation(fixture)).toBe(false);
  });

  it("does not flag line comment // see [[mod-parse]] (negative)", () => {
    const fixture = "// see [[mod-parse]]";
    expect(detectReferenceGrammarViolation(fixture)).toBe(false);
  });

  it("does not flag empty string (negative)", () => {
    expect(detectReferenceGrammarViolation("")).toBe(false);
  });
});

describe("inv-single-reference-grammar — src/ scan, excluding src/parse/ (T-04)", () => {
  it("no non-parse src file contains \\[\\[ regex interpretation pattern", async () => {
    const parseDir = join(SRC_DIR, "parse");
    const allFiles = await collectNonTestTsFiles(SRC_DIR);
    // Exclude src/parse/ — that module is the sole permitted location for
    // [[id]] reference interpretation regex
    const scanFiles = allFiles.filter(
      (f) => !f.startsWith(parseDir + "/") && f !== parseDir
    );

    const violations: string[] = [];
    for (const filePath of scanFiles) {
      const content = await readFile(filePath, "utf-8");
      if (detectReferenceGrammarViolation(content)) {
        violations.push(filePath.replace(REPO_ROOT + "/", ""));
      }
    }

    expect(
      violations,
      `Files outside src/parse/ that interpret [[id]] references: ${violations.join(", ")}`
    ).toEqual([]);
  });
});

// ===========================================================================
// T-05: inv-deterministic-verdict
// ===========================================================================

describe("inv-deterministic-verdict — fixture tests (T-05)", () => {
  // --- Positive (violation detected) ---

  it("detects Bun.spawn (positive)", () => {
    const fixture = 'const proc = Bun.spawn(["ls"]);';
    expect(detectNondeterministicViolation(fixture)).toBe(true);
  });

  it("detects fetch() network call (positive)", () => {
    const fixture = 'const res = await fetch("https://example.com");';
    expect(detectNondeterministicViolation(fixture)).toBe(true);
  });

  it("detects child_process import (positive)", () => {
    const fixture = 'import { exec } from "child_process";';
    expect(detectNondeterministicViolation(fixture)).toBe(true);
  });

  it("detects Bun.$ template tag (positive)", () => {
    const fixture = "await Bun.$`ls`;";
    expect(detectNondeterministicViolation(fixture)).toBe(true);
  });

  // --- Negative (no violation) ---

  it("does not flag normal checker invocation (negative)", () => {
    const fixture = "const result = checker.check(graph);";
    expect(detectNondeterministicViolation(fixture)).toBe(false);
  });

  it("does not flag regex .exec() call (negative)", () => {
    const fixture = "while ((match = REF_RE.exec(line)) !== null) {";
    expect(detectNondeterministicViolation(fixture)).toBe(false);
  });

  it("does not flag empty string (negative)", () => {
    expect(detectNondeterministicViolation("")).toBe(false);
  });
});

describe("inv-deterministic-verdict — verdict-owning modules scan (T-05)", () => {
  it("no verdict-owning module file uses subprocess or network I/O", async () => {
    const verdictDirs = getVerdictModuleDirs();

    const violations: string[] = [];
    for (const dir of verdictDirs) {
      if (!existsSync(dir)) continue;
      const files = await collectNonTestTsFiles(dir);
      for (const filePath of files) {
        const content = await readFile(filePath, "utf-8");
        if (detectNondeterministicViolation(content)) {
          violations.push(filePath.replace(REPO_ROOT + "/", ""));
        }
      }
    }

    expect(
      violations,
      `Verdict-owning modules with subprocess/network calls: ${violations.join(", ")}`
    ).toEqual([]);
  });
});

// ===========================================================================
// TC-027: inv-deterministic-verdict — verdict module exclusions
// ===========================================================================

describe("inv-deterministic-verdict — verdict module exclusions (TC-027)", () => {
  it("src/cli/ and src/prompt/ are not in the verdict-owning modules list", () => {
    const dirs = getVerdictModuleDirs();
    const cliDir = join(SRC_DIR, "cli");
    const promptDir = join(SRC_DIR, "prompt");

    expect(
      dirs,
      "src/cli/ must not be in verdict-owning modules (composition root)"
    ).not.toContain(cliDir);

    expect(
      dirs,
      "src/prompt/ must not be in verdict-owning modules (composition root)"
    ).not.toContain(promptDir);
  });

  it("src/check/, src/export/, src/state/ are in the verdict-owning modules list", () => {
    const dirs = getVerdictModuleDirs();

    expect(dirs, "src/check/ must be a verdict-owning module").toContain(
      join(SRC_DIR, "check")
    );
    expect(dirs, "src/export/ must be a verdict-owning module").toContain(
      join(SRC_DIR, "export")
    );
    expect(dirs, "src/state/ must be a verdict-owning module").toContain(
      join(SRC_DIR, "state")
    );
  });
});
