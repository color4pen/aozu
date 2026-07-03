/**
 * Packaging smoke tests.
 *
 * Verifies that:
 * 1. `npm pack` produces a tarball containing only the expected files
 *    (no test files, design docs, or other dev-only artifacts).
 * 2. The published bin (`src/cli/main.ts`) runs with `--help` and exits 0.
 * 3. The CI workflow YAML contains the required quality gate commands.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { join, resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { readFile } from "fs/promises";

const REPO_ROOT = resolve(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// T-09: CI workflow YAML grep tests
// ---------------------------------------------------------------------------

describe("CI workflow YAML contains required quality gate commands", () => {
  const ciYmlPath = join(REPO_ROOT, ".github/workflows/ci.yml");

  const requiredCommands = [
    "tsc --noEmit",
    "bun test",
    "check --dir design",
    "export rules --dir design --verify",
  ] as const;

  for (const cmd of requiredCommands) {
    it(`contains: ${cmd}`, async () => {
      const content = await readFile(ciYmlPath, "utf-8");
      expect(content).toContain(cmd);
    });
  }
});

// ---------------------------------------------------------------------------
// T-08: npm pack tarball content tests
// ---------------------------------------------------------------------------

interface PackFile {
  path: string;
  size: number;
  mode: number;
}

interface PackResult {
  id: string;
  name: string;
  version: string;
  filename: string;
  files: PackFile[];
}

/**
 * Run `npm pack --json --dry-run` and return the list of file paths in the tarball.
 */
async function getPackFiles(): Promise<string[]> {
  const proc = Bun.spawn(["npm", "pack", "--json", "--dry-run"], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      `npm pack --json --dry-run failed (exit ${exitCode}): ${stderr}`
    );
  }

  const results = JSON.parse(stdout) as PackResult[];
  const result = results[0];
  if (!result) {
    throw new Error("npm pack --json --dry-run returned empty results");
  }
  return result.files.map((f) => f.path);
}

describe("npm pack tarball content", () => {
  const filesPromise = getPackFiles();

  it("package.json is included", async () => {
    const files = await filesPromise;
    expect(files.some((f) => f === "package.json")).toBe(true);
  });

  it("README.md is included", async () => {
    const files = await filesPromise;
    expect(files.some((f) => f === "README.md")).toBe(true);
  });

  it("LICENSE is included", async () => {
    const files = await filesPromise;
    expect(files.some((f) => f === "LICENSE")).toBe(true);
  });

  it("src/cli/main.ts (bin entrypoint) is included", async () => {
    const files = await filesPromise;
    expect(files.some((f) => f === "src/cli/main.ts")).toBe(true);
  });

  it("no *.test.ts files are included", async () => {
    const files = await filesPromise;
    const testFiles = files.filter((f) => f.endsWith(".test.ts"));
    expect(testFiles).toHaveLength(0);
  });

  it("no design/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "design" || f.startsWith("design/")
    );
    expect(excluded).toHaveLength(0);
  });

  it("no specrunner/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "specrunner" || f.startsWith("specrunner/")
    );
    expect(excluded).toHaveLength(0);
  });

  it("no tools/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "tools" || f.startsWith("tools/")
    );
    expect(excluded).toHaveLength(0);
  });

  it("no tests/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "tests" || f.startsWith("tests/")
    );
    expect(excluded).toHaveLength(0);
  });

  it("no adr/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter((f) => f === "adr" || f.startsWith("adr/"));
    expect(excluded).toHaveLength(0);
  });

  it("no docs/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "docs" || f.startsWith("docs/")
    );
    expect(excluded).toHaveLength(0);
  });

  it("no spec/ files are included", async () => {
    const files = await filesPromise;
    const excluded = files.filter(
      (f) => f === "spec" || f.startsWith("spec/")
    );
    expect(excluded).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-08: packaging smoke test — bun <bin> --help exits 0
// ---------------------------------------------------------------------------

describe("packaging smoke: bin --help exits 0", () => {
  let tmpDir: string | null = null;
  let tarball: string | null = null;

  afterAll(async () => {
    if (tarball) {
      await rm(tarball, { force: true });
    }
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("bun src/cli/main.ts --help exits 0 from the extracted package", async () => {
    // Step 1: Create the tarball
    const packProc = Bun.spawn(["npm", "pack", "--json"], {
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    const packOut = await new Response(packProc.stdout).text();
    const packExit = await packProc.exited;

    if (packExit !== 0) {
      const packErr = await new Response(packProc.stderr).text();
      throw new Error(`npm pack failed (exit ${packExit}): ${packErr}`);
    }

    const packResults = JSON.parse(packOut) as PackResult[];
    const filename = packResults[0]?.filename;
    if (!filename) {
      throw new Error("npm pack did not return a filename");
    }
    tarball = join(REPO_ROOT, filename);

    // Step 2: Extract the tarball to a temp directory
    tmpDir = await mkdtemp(join(tmpdir(), "aozu-smoke-"));
    const extractProc = Bun.spawn(["tar", "-xzf", tarball, "-C", tmpDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const extractExit = await extractProc.exited;

    if (extractExit !== 0) {
      const extractErr = await new Response(extractProc.stderr).text();
      throw new Error(
        `tar extraction failed (exit ${extractExit}): ${extractErr}`
      );
    }

    // Step 3: npm pack extracts into a `package/` subdirectory
    const binPath = join(tmpDir, "package", "src", "cli", "main.ts");

    // Step 4: Run bun <bin> --help
    const helpProc = Bun.spawn(["bun", binPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const helpExit = await helpProc.exited;

    expect(helpExit).toBe(0);
  });
});
