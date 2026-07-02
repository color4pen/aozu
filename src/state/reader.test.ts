import { describe, it, expect } from "bun:test";
import { readState } from "./reader.ts";
import { join } from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";

describe("readState", () => {
  it("returns entries when state.json exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-state-test-"));
    try {
      const stateData = {
        "mod-parse": { state: "requested", request: "r1" },
        "mod-graph": { state: "implemented", request: "r0", pr: 1 },
      };
      await writeFile(join(dir, "state.json"), JSON.stringify(stateData));
      const result = await readState(join(dir, "state.json"));
      expect(result["mod-parse"]).toEqual({ state: "requested", request: "r1" });
      expect(result["mod-graph"]).toEqual({ state: "implemented", request: "r0", pr: 1 });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns empty object when state.json does not exist", async () => {
    const result = await readState("/tmp/nonexistent-state-" + Date.now() + ".json");
    expect(result).toEqual({});
  });

  it("returns empty object when state.json contains empty object", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-state-test-"));
    try {
      await writeFile(join(dir, "state.json"), "{}");
      const result = await readState(join(dir, "state.json"));
      expect(result).toEqual({});
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
