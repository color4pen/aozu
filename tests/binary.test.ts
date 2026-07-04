/**
 * Binary smoke tests.
 *
 * Compiles the CLI into a native binary using `bun build --compile` with
 * compile-time version injection (`--define`), then verifies that:
 * - `--help` exits 0
 * - `--version` exits 0 and outputs the version string from package.json
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { join, resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const REPO_ROOT = resolve(import.meta.dir, "..");

describe("compiled binary", () => {
  let tmpDir: string = "";
  let binaryPath: string = "";
  let version: string = "";

  beforeAll(async () => {
    // Read version from package.json
    const pkgPath = join(REPO_ROOT, "package.json");
    const pkg = (await Bun.file(pkgPath).json()) as { version: string };
    version = pkg.version;

    // Create temp directory for the binary
    tmpDir = await mkdtemp(join(tmpdir(), "aozu-binary-"));
    binaryPath = join(tmpDir, "aozu");

    // Compile the native binary with version injected at build time.
    // `--define` replaces every occurrence of `globalThis.__AOZU_VERSION`
    // in the bundled code with the string literal "x.y.z".
    const proc = Bun.spawn(
      [
        "bun",
        "build",
        "--compile",
        "--define",
        `globalThis.__AOZU_VERSION="${version}"`,
        join(REPO_ROOT, "src/cli/main.ts"),
        "--outfile",
        binaryPath,
      ],
      {
        cwd: REPO_ROOT,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `bun build --compile failed (exit ${exitCode}): ${stderr}`
      );
    }

    // On macOS, bun-compiled binaries may carry an invalid embedded signature
    // that causes the OS to kill the process (exit 137 / SIGKILL) before it runs.
    // Strip the broken signature and apply an ad-hoc one so the binary executes.
    if (process.platform === "darwin") {
      const strip = Bun.spawn(
        ["codesign", "--remove-signature", binaryPath],
        { stdout: "pipe", stderr: "pipe" }
      );
      const stripCode = await strip.exited;
      if (stripCode !== 0) {
        const stderr = await new Response(strip.stderr).text();
        throw new Error(
          `codesign --remove-signature failed (exit ${stripCode}): ${stderr}`
        );
      }

      const sign = Bun.spawn(
        ["codesign", "-s", "-", binaryPath],
        { stdout: "pipe", stderr: "pipe" }
      );
      const signCode = await sign.exited;
      if (signCode !== 0) {
        const stderr = await new Response(sign.stderr).text();
        throw new Error(
          `codesign -s - failed (exit ${signCode}): ${stderr}`
        );
      }
    }
  }, 120_000); // compilation can take up to 2 minutes on first run

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("--help exits 0", async () => {
    const proc = Bun.spawn([binaryPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });

  it("--version exits 0 and outputs the package.json version", async () => {
    const proc = Bun.spawn([binaryPath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(version);
  });
});
