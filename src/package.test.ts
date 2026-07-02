/**
 * Verify that package.json has no runtime dependencies.
 * (devDependencies are allowed; only `dependencies` must be empty.)
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readdir } from "fs/promises";

describe("package.json", () => {
  it("TC-013 TC-028 TC-039: package.json dependencies field is empty or absent", async () => {
    const pkgPath = join(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();

    const deps = pkg.dependencies ?? {};
    const depCount = Object.keys(deps).length;

    expect(depCount).toBe(0);
  });

  // TC-014 TC-029: tsc --noEmit and bun test both exit with status 0 (manual verification)
  it("has required fields", async () => {
    const pkgPath = join(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();

    expect(pkg.name).toBe("aozu");
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin["aozu"]).toBeDefined();
  });
});

describe("regression — TC-037", () => {
  it("TC-037: pre-existing test files are present after adding init/scaffold/status", async () => {
    // This change adds 3 new test files (init.test.ts, scaffold.test.ts, status.test.ts).
    // Verifying that no pre-existing test files were deleted.
    const srcDir = import.meta.dir;
    const allEntries = await readdir(srcDir, { recursive: true });
    const testFiles = (allEntries as string[]).filter((f) =>
      f.endsWith(".test.ts")
    );
    // 33 test files pre-existed; 3 new ones were added by this change
    expect(testFiles.length).toBeGreaterThanOrEqual(36);
  });
});
