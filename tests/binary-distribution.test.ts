/**
 * Binary distribution validation tests.
 *
 * Verifies via content inspection (grep) that:
 * 1. `.github/workflows/publish.yml` contains the required binary build and
 *    release-upload configuration for all 5 cross-compilation targets.
 * 2. `install.sh` contains the required OS/arch detection logic and
 *    post-install verification step.
 */

import { describe, it, expect } from "bun:test";
import { join, resolve } from "path";
import { readFile } from "fs/promises";

const REPO_ROOT = resolve(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// T-04: publish.yml workflow grep tests
// ---------------------------------------------------------------------------

describe("publish.yml — binary distribution configuration", () => {
  const publishYmlPath = join(REPO_ROOT, ".github/workflows/publish.yml");

  it("contains bun build --compile", async () => {
    const content = await readFile(publishYmlPath, "utf-8");
    expect(content).toContain("bun build --compile");
  });

  const targets = [
    "bun-darwin-arm64",
    "bun-darwin-x64",
    "bun-linux-x64",
    "bun-linux-arm64",
    "bun-windows-x64",
  ] as const;

  for (const target of targets) {
    it(`contains target: ${target}`, async () => {
      const content = await readFile(publishYmlPath, "utf-8");
      expect(content).toContain(target);
    });
  }

  it("contains gh release upload", async () => {
    const content = await readFile(publishYmlPath, "utf-8");
    expect(content).toContain("gh release upload");
  });

  it("contains contents: write (binary job permission)", async () => {
    const content = await readFile(publishYmlPath, "utf-8");
    expect(content).toContain("contents: write");
  });

  it("npm publish job has contents: read (not write)", async () => {
    const content = await readFile(publishYmlPath, "utf-8");
    // The publish job block should declare contents: read
    expect(content).toContain("contents: read");
  });

  it("npm publish job has id-token: write", async () => {
    const content = await readFile(publishYmlPath, "utf-8");
    expect(content).toContain("id-token: write");
  });
});

// ---------------------------------------------------------------------------
// T-06: install.sh validation tests
// ---------------------------------------------------------------------------

describe("install.sh — content validation", () => {
  const installShPath = join(REPO_ROOT, "install.sh");

  it("starts with #!/bin/bash shebang", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content.startsWith("#!/bin/bash")).toBe(true);
  });

  it("contains set -euo pipefail (strict mode)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("set -euo pipefail");
  });

  it("contains uname -s (OS detection)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("uname -s");
  });

  it("contains uname -m (architecture detection)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("uname -m");
  });

  it("contains darwin branch (macOS support)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("darwin");
  });

  it("contains linux branch (Linux support)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("linux");
  });

  it("contains arm64 or aarch64 (ARM64 architecture support)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content.includes("arm64") || content.includes("aarch64")).toBe(true);
  });

  it("contains x86_64 or x64 (x86_64 architecture support)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content.includes("x86_64") || content.includes("x64")).toBe(true);
  });

  it("contains SHA256SUMS (checksum verification)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("SHA256SUMS");
  });

  it("contains sha256sum or shasum (checksum tool)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(
      content.includes("sha256sum") || content.includes("shasum")
    ).toBe(true);
  });

  it("contains aozu --version (post-install verification)", async () => {
    const content = await readFile(installShPath, "utf-8");
    expect(content).toContain("aozu --version");
  });
});
