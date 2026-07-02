/**
 * Verify that package.json has no runtime dependencies.
 * (devDependencies are allowed; only `dependencies` must be empty.)
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";

describe("package.json", () => {
  it("TC-013: package.json dependencies field is empty or absent", async () => {
    const pkgPath = join(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();

    const deps = pkg.dependencies ?? {};
    const depCount = Object.keys(deps).length;

    expect(depCount).toBe(0);
  });

  // TC-014: tsc --noEmit and bun test both exit with status 0 (manual verification)
  it("has required fields", async () => {
    const pkgPath = join(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();

    expect(pkg.name).toBe("aozu");
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin["aozu"]).toBeDefined();
  });
});
