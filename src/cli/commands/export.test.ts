/**
 * Integration tests for the `export` command (rules and permissions subcommands).
 */

import { describe, it, expect } from "bun:test";
import { handleExport } from "./export.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to this repository's design directory. */
const DESIGN_DIR = resolve(import.meta.dir, "../../../design");

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

/** Create a minimal valid design fixture with 実装: lines on all mods. */
async function createValidDesignFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-test-"));
  await mkdir(join(dir, "static"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI.",
      "実装: src/cli/",
      "",
      "## Parser {#mod-parse}",
      "責務: parse.",
      "実装: src/parse/",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "dependencies.md"),
    [
      "# Dependencies",
      "",
      "- [[mod-cli]] -> [[mod-parse]]",
    ].join("\n")
  );

  return dir;
}

/** Create a design fixture where one mod is missing its 実装: line. */
async function createMissingImplFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-missing-impl-"));
  await mkdir(join(dir, "static"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI.",
      "実装: src/cli/",
      "",
      "## Parser {#mod-parse}",
      "責務: parse.",
      // No 実装: line for mod-parse
    ].join("\n")
  );

  return dir;
}

describe("handleExport — subcommand routing", () => {
  it("returns 0 for empty args (usage display)", async () => {
    const exitCode = await handleExport([]);
    expect(exitCode).toBe(0);
  });

  it("returns 0 for --help", async () => {
    const exitCode = await handleExport(["--help"]);
    expect(exitCode).toBe(0);
  });

  it("returns 2 for unknown subcommand", async () => {
    const exitCode = await handleExport(["unknown"]);
    expect(exitCode).toBe(2);
  });

  it("returns 2 when design directory does not exist", async () => {
    const exitCode = await handleExport([
      "rules",
      "--dir",
      "/tmp/nonexistent-design-" + Date.now(),
    ]);
    expect(exitCode).toBe(2);
  });
});

describe("handleExport rules — normal mode", () => {
  it("returns 0 for this repository's own design directory", async () => {
    const exitCode = await handleExport(["rules", "--dir", DESIGN_DIR]);
    expect(exitCode).toBe(0);
  });

  it("returns 1 with C12 diagnostic for unknown format-version (exit-gate baseline must be fenced)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-export-fv-test-"));
    try {
      await mkdir(join(dir, "static"), { recursive: true });
      await writeFile(
        join(dir, "manifest.md"),
        ["---", "format-version: 99", "enabled: static", "---", "", "# manifest"].join("\n")
      );
      await writeFile(
        join(dir, "static", "modules.md"),
        ["# Modules", "", "## CLI {#mod-cli}", "責務: CLI.", "実装: src/cli/"].join("\n")
      );
      await writeFile(join(dir, "static", "dependencies.md"), "# Dependencies\n");

      const exitCode = await handleExport(["rules", "--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 1 when a mod is missing 実装: line", async () => {
    const dir = await createMissingImplFixture();
    try {
      const exitCode = await handleExport(["rules", "--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("handleExport rules — subprocess output validation", () => {
  it("stdout is valid JSON when run as subprocess", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "export", "rules", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    // Should be parseable JSON
    const parsed = JSON.parse(stdout);
    expect(parsed).toBeDefined();
  });

  it("stdout JSON contains format-version, modules, paths, allowed", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "export", "rules", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(typeof parsed["format-version"]).toBe("number");
    expect(Array.isArray(parsed.modules)).toBe(true);
    expect(typeof parsed.paths).toBe("object");
    expect(Array.isArray(parsed.allowed)).toBe(true);
  });
});

describe("handleExport rules --verify", () => {
  it("TC-046 TC-050: returns 0 when committed rules.json matches regenerated ruleset (export rules --verify exit 0)", async () => {
    const dir = await createValidDesignFixture();
    try {
      // First generate the rules.json
      const genCode = await handleExport(["rules", "--dir", dir, "--out", join(dir, "rules.json")]);
      expect(genCode).toBe(0);

      // Now verify
      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "rules.json"),
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 1 when rules.json diverges from current design", async () => {
    const dir = await createValidDesignFixture();
    try {
      // Write a stale rules.json with different content
      await writeFile(join(dir, "rules.json"), JSON.stringify({ stale: true }));

      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "rules.json"),
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 2 when the rules.json file does not exist", async () => {
    const dir = await createValidDesignFixture();
    try {
      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "nonexistent-rules.json"),
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("uses <designDir>/rules.json as default verify path", async () => {
    const dir = await createValidDesignFixture();
    try {
      // Generate rules.json to the default path
      const genCode = await handleExport(["rules", "--dir", dir, "--out", join(dir, "rules.json")]);
      expect(genCode).toBe(0);

      // Verify without explicit path → should find <dir>/rules.json
      const exitCode = await handleExport(["rules", "--dir", dir, "--verify"]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-13: export permissions tests
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid permission design fixture.
 *
 * manifest: enabled: static, domain, permission
 * - mod-workflow
 * - act-admin, act-manager, act-member, act-finance
 * - ent-deal
 * - perm-deal (with list and create operations, target: ent-deal)
 */
async function createValidPermissionDesignFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-perm-test-"));
  await mkdir(join(dir, "static"), { recursive: true });
  await mkdir(join(dir, "domain"), { recursive: true });
  await mkdir(join(dir, "views", "permission"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, domain, permission",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## Workflow {#mod-workflow}",
      "責務: ワークフロー.",
      "実装: src/workflow/",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "dependencies.md"),
    "# Dependencies\n"
  );

  await writeFile(
    join(dir, "domain", "actors.md"),
    [
      "# Actors",
      "",
      "## Admin {#act-admin}",
      "",
      "## Manager {#act-manager}",
      "",
      "## Member {#act-member}",
      "",
      "## Finance {#act-finance}",
    ].join("\n")
  );

  await writeFile(
    join(dir, "domain", "model.md"),
    [
      "# Model",
      "",
      "## Deal {#ent-deal}",
    ].join("\n")
  );

  await writeFile(
    join(dir, "domain", "operations.md"),
    [
      "# Operations",
      "",
      "## 案件リスト {#op-list-deals}",
      "",
      "## 案件作成 {#op-create-deal}",
    ].join("\n")
  );

  await writeFile(
    join(dir, "views", "permission", "deal.md"),
    [
      "# Deal Permissions",
      "",
      "## 案件の権限 {#perm-deal}",
      "対象: [[ent-deal]]",
      "",
      "- [[op-list-deals]]: [[act-admin]], [[act-manager]], [[act-member]], [[act-finance]]",
      "- [[op-create-deal]]: [[act-admin]], [[act-manager]]",
    ].join("\n")
  );

  return dir;
}

/** Create a design fixture with no permission in enabled. */
async function createNoPermissionDesignFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-noperm-test-"));
  await mkdir(join(dir, "static"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static, domain",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## Workflow {#mod-workflow}",
      "責務: ワークフロー.",
      "実装: src/workflow/",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "dependencies.md"),
    "# Dependencies\n"
  );

  return dir;
}

describe("handleExport permissions — basic", () => {
  it("returns 2 for design directory not found", async () => {
    const exitCode = await handleExport([
      "permissions",
      "--dir",
      "/tmp/nonexistent-perm-design-" + Date.now(),
    ]);
    expect(exitCode).toBe(2);
  });

  it("returns 1 when permission is not enabled", async () => {
    const dir = await createNoPermissionDesignFixture();
    try {
      const exitCode = await handleExport(["permissions", "--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 0 with valid permission design", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const exitCode = await handleExport(["permissions", "--dir", dir]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("handleExport permissions — JSON output", () => {
  it("JSON is spec §11 compliant (format-version, permissions array)", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      // Capture stdout using --out
      const outPath = join(dir, "permissions.json");
      const exitCode = await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      expect(exitCode).toBe(0);

      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      expect(output["format-version"]).toBe(0);
      expect(Array.isArray(output.permissions)).toBe(true);
      expect(output.permissions).toHaveLength(1);

      const perm = output.permissions[0];
      expect(perm.id).toBe("perm-deal");
      expect(perm.target).toBe("ent-deal");
      expect(typeof perm.operations).toBe("object");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("permissions are sorted by id ascending", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const outPath = join(dir, "permissions.json");
      await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      const ids = output.permissions.map((p: { id: string }) => p.id);
      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("operations keys are in lexicographic order", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const outPath = join(dir, "permissions.json");
      await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      const perm = output.permissions[0];
      const keys = Object.keys(perm.operations);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("act arrays are in ID ascending order", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const outPath = join(dir, "permissions.json");
      await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      const perm = output.permissions[0];
      // op-create-deal: act-admin, act-manager (sorted)
      expect(perm.operations["op-create-deal"]).toEqual(["act-admin", "act-manager"]);
      // op-list-deals: act-admin, act-finance, act-manager, act-member (sorted)
      expect(perm.operations["op-list-deals"]).toEqual(["act-admin", "act-finance", "act-manager", "act-member"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("target field included when 対象: line present", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const outPath = join(dir, "permissions.json");
      await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      expect(output.permissions[0].target).toBe("ent-deal");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("--out writes to file", async () => {
    const dir = await createValidPermissionDesignFixture();
    try {
      const outPath = join(dir, "output-perms.json");
      const exitCode = await handleExport(["permissions", "--dir", dir, "--out", outPath]);
      expect(exitCode).toBe(0);
      const content = await readFile(outPath, "utf-8");
      const output = JSON.parse(content);
      expect(output.permissions).toBeDefined();
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
