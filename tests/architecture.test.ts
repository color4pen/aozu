/**
 * Architecture test (歯) — aozu self-verification.
 *
 * Verifies that every import edge in `src/` (excluding *.test.ts) is permitted
 * by the ruleset generated from `design/`. This ensures that aozu's own design
 * and implementation stay in sync.
 *
 * Spec: spec/integration.md §3
 * Rules:
 *   - import type counts as a dependency edge
 *   - Files with no matching module path are violations (fail-closed)
 */

import { describe, it, expect } from "bun:test";
import { resolve, join, relative, dirname } from "path";
import { readdir, readFile } from "fs/promises";
import { readMarkdownFiles } from "../src/fs/reader.ts";
import { parseFiles } from "../src/parse/parser.ts";
import { buildGraph } from "../src/graph/builder.ts";
import { generateRuleset } from "../src/export/generator.ts";

/** Absolute path to the repository root. */
const REPO_ROOT = resolve(import.meta.dir, "..");

/** Absolute path to the design directory. */
const DESIGN_DIR = join(REPO_ROOT, "design");

/** Absolute path to the src directory. */
const SRC_DIR = join(REPO_ROOT, "src");

// ---------------------------------------------------------------------------
// Helper: scanImports
// ---------------------------------------------------------------------------

/** An extracted import reference from a source file. */
export interface ImportRef {
  /** The raw import path as written in the source (e.g., "./types.ts"). */
  from: string;
  /** 1-based line number of the import statement. */
  line: number;
}

/**
 * Scan a TypeScript file's content for import/export-from statements.
 *
 * Extracts relative imports (`./` or `../` prefixes). Skips package imports
 * (those that don't start with `./` or `../`).
 *
 * Pattern: lines containing `import` or `export` followed by `from "..."` or `from '...'`.
 */
export function scanImports(filePath: string, content: string): ImportRef[] {
  const lines = content.split("\n");
  const results: ImportRef[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1;

    // Match: import ... from "..." or export ... from "..."
    // Also handles: import type ... from "..."
    const match = /\bfrom\s+["']([^"']+)["']/.exec(line);
    if (!match) continue;

    // Check if it's an import or re-export line
    if (!/\b(import|export)\b/.test(line)) continue;

    const importPath = match[1]!;

    // Only consider relative imports
    if (!importPath.startsWith("./") && !importPath.startsWith("../")) continue;

    results.push({ from: importPath, line: lineNumber });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper: resolveImportPath
// ---------------------------------------------------------------------------

/**
 * Resolve a relative import path to a repo-root-relative path.
 *
 * @param importingFile  Absolute path to the file containing the import.
 * @param importPath     The raw import path string (e.g., `"../types.ts"`).
 * @returns              Repo-root-relative path (e.g., `"src/parse/types.ts"`).
 */
export function resolveImportPath(
  importingFile: string,
  importPath: string
): string {
  const absResolved = resolve(dirname(importingFile), importPath);
  return relative(REPO_ROOT, absResolved);
}

// ---------------------------------------------------------------------------
// Helper: findModule
// ---------------------------------------------------------------------------

/**
 * Find the module that owns a given file path using longest-prefix matching.
 *
 * @param filePath  Repo-root-relative path (e.g., `"src/cli/main.ts"`).
 * @param paths     `paths` record from the ruleset mapping module IDs to path prefixes.
 * @returns         The matching module ID, or `null` if no module matches.
 */
export function findModule(
  filePath: string,
  paths: Record<string, string[]>
): string | null {
  let bestMatch: string | null = null;
  let bestLength = -1;

  for (const [moduleId, prefixes] of Object.entries(paths)) {
    for (const prefix of prefixes) {
      if (filePath.startsWith(prefix) && prefix.length > bestLength) {
        bestMatch = moduleId;
        bestLength = prefix.length;
      }
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Helper: recursively list .ts files
// ---------------------------------------------------------------------------

async function collectTsFiles(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTsFiles(fullPath, out);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Unit tests for helper functions
// ---------------------------------------------------------------------------

describe("scanImports", () => {
  it("detects a standard relative import", () => {
    const content = 'import { Foo } from "./bar.ts"';
    const refs = scanImports("src/foo.ts", content);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.from).toBe("./bar.ts");
    expect(refs[0]!.line).toBe(1);
  });

  it("detects import type", () => {
    const content = 'import type { Foo } from "../baz/qux.ts"';
    const refs = scanImports("src/foo.ts", content);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.from).toBe("../baz/qux.ts");
  });

  it("detects re-export", () => {
    const content = 'export { Foo } from "./bar.ts"';
    const refs = scanImports("src/foo.ts", content);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.from).toBe("./bar.ts");
  });

  it("excludes package (non-relative) imports", () => {
    const content = 'import { join } from "path"\nimport { readdir } from "fs/promises"';
    const refs = scanImports("src/foo.ts", content);
    expect(refs).toHaveLength(0);
  });

  it("handles multiple imports in the same file", () => {
    const content = [
      'import type { Foo } from "./types.ts"',
      'import { bar } from "../graph/index.ts"',
      'import { join } from "path"',
    ].join("\n");
    const refs = scanImports("src/cli/foo.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.from)).toEqual(["./types.ts", "../graph/index.ts"]);
  });
});

describe("resolveImportPath", () => {
  it("resolves a sibling import", () => {
    const result = resolveImportPath(
      join(REPO_ROOT, "src/cli/commands/check.ts"),
      "../format.ts"
    );
    expect(result).toBe("src/cli/format.ts");
  });

  it("resolves a cross-module import", () => {
    const result = resolveImportPath(
      join(REPO_ROOT, "src/cli/commands/export.ts"),
      "../../export/generator.ts"
    );
    expect(result).toBe("src/export/generator.ts");
  });

  it("resolves a parent-relative import", () => {
    const result = resolveImportPath(
      join(REPO_ROOT, "src/graph/builder.ts"),
      "../parse/types.ts"
    );
    expect(result).toBe("src/parse/types.ts");
  });
});

describe("findModule", () => {
  const paths: Record<string, string[]> = {
    "mod-cli": ["src/cli/"],
    "mod-parse": ["src/parse/"],
    "mod-graph": ["src/graph/"],
    "mod-export": ["src/export/"],
  };

  it("returns the module ID for a matching file", () => {
    expect(findModule("src/cli/main.ts", paths)).toBe("mod-cli");
    expect(findModule("src/parse/types.ts", paths)).toBe("mod-parse");
    expect(findModule("src/graph/builder.ts", paths)).toBe("mod-graph");
  });

  it("returns null for unmatched files", () => {
    expect(findModule("src/nonexistent/foo.ts", paths)).toBeNull();
    expect(findModule("design/static/modules.md", paths)).toBeNull();
  });

  it("uses longest prefix for disambiguation", () => {
    const overlapping: Record<string, string[]> = {
      "mod-cli": ["src/cli/"],
      "mod-cli-commands": ["src/cli/commands/"],
    };
    // The longer prefix should win
    expect(findModule("src/cli/commands/check.ts", overlapping)).toBe(
      "mod-cli-commands"
    );
    // A file at the cli root level should match mod-cli
    expect(findModule("src/cli/main.ts", overlapping)).toBe("mod-cli");
  });

  it("returns null when paths is empty", () => {
    expect(findModule("src/cli/main.ts", {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Violation fixture tests
// ---------------------------------------------------------------------------

describe("architecture violation detection — fixtures", () => {
  it("detects a violation caused by import type across module boundary", () => {
    // Simulate a file in mod-check that imports from mod-parse directly
    // (mod-check -> mod-parse is NOT in allowed, only mod-check -> mod-graph)
    const paths: Record<string, string[]> = {
      "mod-check": ["src/check/"],
      "mod-parse": ["src/parse/"],
      "mod-graph": ["src/graph/"],
    };
    const allowed: [string, string][] = [
      ["mod-check", "mod-graph"],
      ["mod-graph", "mod-parse"],
    ];

    const fileInCheck = join(REPO_ROOT, "src/check/fixture-test.ts");
    const content = 'import type { ParseResult } from "../parse/types.ts"';

    const refs = scanImports(fileInCheck, content);
    expect(refs).toHaveLength(1);

    const importRef = refs[0]!;
    const resolvedPath = resolveImportPath(fileInCheck, importRef.from);
    // resolvedPath = "src/parse/types.ts"

    const fromModule = findModule(relative(REPO_ROOT, fileInCheck), paths);
    const toModule = findModule(resolvedPath, paths);

    expect(fromModule).toBe("mod-check");
    expect(toModule).toBe("mod-parse");

    // Check if this edge is in allowed
    const isAllowed = allowed.some(([f, t]) => f === fromModule && t === toModule);
    expect(isAllowed).toBe(false); // This is a violation
  });

  it("detects unmapped src/ files as violations", () => {
    const paths: Record<string, string[]> = {
      "mod-cli": ["src/cli/"],
      "mod-parse": ["src/parse/"],
    };

    // A file in an unknown directory is unmapped
    const unmappedFile = "src/unknown/foo.ts";
    const module = findModule(unmappedFile, paths);
    expect(module).toBeNull(); // null = unmapped = violation
  });
});

// ---------------------------------------------------------------------------
// Main architecture test
// ---------------------------------------------------------------------------

describe("aozu self-architecture", () => {
  it("all src/ imports are permitted by design/rules.json", async () => {
    // 1. Load ruleset from design/
    const mdFiles = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(mdFiles);
    const manifestPath = join(DESIGN_DIR, "manifest.md");
    const graph = buildGraph(parsed, manifestPath);
    const { json, diagnostics } = generateRuleset(graph);

    if (diagnostics.length > 0) {
      throw new Error(
        `generateRuleset failed: ${diagnostics.map((d) => d.message).join(", ")}`
      );
    }
    if (json === null) {
      throw new Error("generateRuleset returned null JSON with no diagnostics");
    }

    const ruleset = JSON.parse(json) as {
      modules: string[];
      paths: Record<string, string[]>;
      allowed: [string, string][];
    };

    const allowedSet = new Set(
      ruleset.allowed.map(([f, t]) => `${f}→${t}`)
    );

    // 2. Collect all non-test .ts files under src/
    const srcFiles: string[] = [];
    await collectTsFiles(SRC_DIR, srcFiles);

    // 3. Check every import in every file
    type Violation = {
      file: string;
      line: number;
      reason: string;
    };
    const violations: Violation[] = [];

    for (const absFile of srcFiles) {
      const relFile = relative(REPO_ROOT, absFile);

      // (a) Determine owning module (fail-closed: unmapped = violation)
      const fromModule = findModule(relFile, ruleset.paths);
      if (fromModule === null) {
        violations.push({
          file: relFile,
          line: 0,
          reason: `file is not mapped to any module (fail-closed)`,
        });
        continue;
      }

      // (b) Scan imports
      const content = await readFile(absFile, "utf-8");
      const refs = scanImports(absFile, content);

      for (const ref of refs) {
        const resolvedRel = resolveImportPath(absFile, ref.from);

        // Determine the target module
        const toModule = findModule(resolvedRel, ruleset.paths);
        if (toModule === null) {
          // Target file not in any module — could be external or auto-generated
          // Only flag if it's a src/ path
          if (resolvedRel.startsWith("src/")) {
            violations.push({
              file: relFile,
              line: ref.line,
              reason: `imports '${resolvedRel}' which is not mapped to any module (fail-closed)`,
            });
          }
          continue;
        }

        // (d) Same-module imports are always allowed
        if (fromModule === toModule) continue;

        // (e) Cross-module import: check allowed
        const edge = `${fromModule}→${toModule}`;
        if (!allowedSet.has(edge)) {
          violations.push({
            file: relFile,
            line: ref.line,
            reason: `import from ${fromModule} to ${toModule} is not in allowed (imports '${ref.from}')`,
          });
        }
      }
    }

    // Report all violations in a single assertion
    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.reason}`)
        .join("\n");
      // Use expect to integrate with the test reporter, then throw with full details
      expect(violations.map((v) => `${v.file}:${v.line}: ${v.reason}`)).toEqual([]);
      // (The line above will throw if there are violations; the message below provides context)
      throw new Error(`Architecture violations detected:\n${details}`);
    }

    expect(violations).toHaveLength(0);
  });
});
