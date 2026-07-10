/**
 * Tests for writeDesignState (T-01).
 *
 * Covers:
 *   - round-trip: writeDesignState → readDesignState produces the original StateMap
 *   - key order: output file keys are in lexicographic order
 *   - 1-element-per-line: output line count == entryCount + 2 (for `{` and `}`)
 *   - pr field: entries with pr are round-tripped correctly
 *   - empty stateMap: does not create file when absent; writes `{}\n` when file exists
 */

import { describe, it, expect } from "bun:test";
import { writeDesignState, serializeEntry } from "./writer.ts";
import { readDesignState } from "./reader.ts";
import { join } from "path";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import type { StateMap } from "./types.ts";

// ---------------------------------------------------------------------------
// round-trip test
// ---------------------------------------------------------------------------

describe("writeDesignState — round-trip", () => {
  it("writeDesignState → readDesignState produces the original StateMap", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-test-"));
    try {
      const stateMap: StateMap = {
        "mod-parse": { state: "requested", request: "r1" },
        "mod-graph": { state: "implemented", request: "r0", pr: 1 },
        "ent-order": { state: "requested", request: "order-rework" },
      };

      await writeDesignState(dir, stateMap);
      const result = await readDesignState(dir);

      expect(result).toEqual(stateMap);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// key order test
// ---------------------------------------------------------------------------

describe("writeDesignState — lexicographic key order", () => {
  it("output file keys are in lexicographic order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-order-"));
    try {
      const stateMap: StateMap = {
        "mod-z": { state: "requested", request: "rz" },
        "ent-a": { state: "implemented", request: "ra", pr: 5 },
        "mod-a": { state: "requested", request: "ra" },
        "ent-order": { state: "requested", request: "ro" },
      };

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");
      const lines = content.split("\n").filter(l => l.trim().startsWith('"'));

      // Extract keys from the lines
      const keyPattern = /^\s+"([^"]+)":/;
      const keys = lines.map(l => keyPattern.exec(l)?.[1]).filter(Boolean) as string[];

      // Verify the keys are sorted
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);

      // Verify the expected order
      expect(keys).toEqual(["ent-a", "ent-order", "mod-a", "mod-z"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 1-element-per-line test
// ---------------------------------------------------------------------------

describe("writeDesignState — 1-element-per-line", () => {
  it("output line count equals entryCount + 2 (opening { and closing })", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-lines-"));
    try {
      const stateMap: StateMap = {
        "mod-parse": { state: "requested", request: "r1" },
        "mod-graph": { state: "implemented", request: "r0", pr: 1 },
        "ent-order": { state: "requested", request: "order-rework" },
      };
      const entryCount = Object.keys(stateMap).length; // 3

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");
      // Split into non-empty lines (the trailing \n adds an empty entry)
      const lines = content.split("\n").filter(l => l.length > 0);

      // Expected: entryCount + 2 lines (one `{`, N entries, one `}`)
      expect(lines.length).toBe(entryCount + 2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("each entry occupies exactly one line", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-oneline-"));
    try {
      const stateMap: StateMap = {
        "mod-cli": { state: "implemented", request: "cli-split", pr: 123 },
        "ent-order": { state: "requested", request: "order-rework" },
      };

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");
      const lines = content.split("\n").filter(l => l.trim().startsWith('"'));

      // 2 entries = 2 lines
      expect(lines.length).toBe(2);
      // Each line must be complete JSON (opening/closing braces for value on same line)
      for (const line of lines) {
        expect(line).toMatch(/^\s+"[^"]+": \{.+\}[,]?$/);
      }
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// pr field test
// ---------------------------------------------------------------------------

describe("writeDesignState — pr field round-trip", () => {
  it("entries with pr are round-tripped correctly", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-pr-"));
    try {
      const stateMap: StateMap = {
        "mod-cli": { state: "implemented", request: "cli-split", pr: 42 },
      };

      await writeDesignState(dir, stateMap);
      const result = await readDesignState(dir);

      expect(result["mod-cli"]).toEqual({
        state: "implemented",
        request: "cli-split",
        pr: 42,
      });
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// empty stateMap tests
// ---------------------------------------------------------------------------

describe("writeDesignState — empty stateMap", () => {
  it("does not create state.json when stateMap is empty and file does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-empty-"));
    try {
      await writeDesignState(dir, {});

      const f = Bun.file(join(dir, "state.json"));
      expect(await f.exists()).toBe(false);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("writes {} when stateMap is empty and file already exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-empty-exists-"));
    try {
      // Pre-create a state.json with some content
      await writeFile(
        join(dir, "state.json"),
        '{\n  "mod-cli": { "state": "requested", "request": "r1" }\n}\n'
      );

      await writeDesignState(dir, {});

      const content = await readFile(join(dir, "state.json"), "utf-8");
      expect(content).toBe("{}\n");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// format verification
// ---------------------------------------------------------------------------

describe("writeDesignState — output format", () => {
  it("produces valid JSON parseable by JSON.parse", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-valid-json-"));
    try {
      const stateMap: StateMap = {
        "mod-parse": { state: "requested", request: "r1" },
        "mod-graph": { state: "implemented", request: "r0", pr: 1 },
      };

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");

      // Must be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(stateMap);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-01: hash field tests
// ---------------------------------------------------------------------------

describe("writeDesignState — hash field (T-01)", () => {
  it("round-trip: hash is preserved through write → read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-hash-rt-"));
    try {
      const hash = "a".repeat(64);
      const stateMap: StateMap = {
        "mod-cli": { state: "implemented", request: "r1", pr: 1, hash },
      };

      await writeDesignState(dir, stateMap);
      const result = await readDesignState(dir);

      expect(result["mod-cli"]).toEqual({ state: "implemented", request: "r1", pr: 1, hash });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("field order is state, request, pr, hash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-hash-order-"));
    try {
      const hash = "b".repeat(64);
      const stateMap: StateMap = {
        "ent-order": { state: "implemented", request: "req1", pr: 42, hash },
      };

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");

      // Find the entry line
      const line = content.split("\n").find(l => l.includes('"ent-order"'))!;
      // Extract the JSON object from the line
      const match = /^\s+"ent-order": (\{.+\})/.exec(line);
      expect(match).not.toBeNull();

      const parsed = JSON.parse(match![1]!);
      const keys = Object.keys(parsed);
      expect(keys).toEqual(["state", "request", "pr", "hash"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("hash-less entry does not contain hash key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aozu-writer-no-hash-"));
    try {
      const stateMap: StateMap = {
        "mod-parse": { state: "requested", request: "r1" },
      };

      await writeDesignState(dir, stateMap);
      const content = await readFile(join(dir, "state.json"), "utf-8");

      expect(content).not.toContain('"hash"');
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-01: serializeEntry unit tests
// ---------------------------------------------------------------------------

describe("serializeEntry (T-01)", () => {
  it("serializes full entry with state, request, pr, hash in that order", () => {
    const hash = "c".repeat(64);
    const result = serializeEntry({ state: "implemented", request: "slug", pr: 10, hash });
    expect(result).toBe(`{"state":"implemented","request":"slug","pr":10,"hash":"${hash}"}`);
  });

  it("omits pr and hash when absent", () => {
    const result = serializeEntry({ state: "requested", request: "slug" });
    expect(result).toBe('{"state":"requested","request":"slug"}');
  });

  it("omits hash when only pr is present", () => {
    const result = serializeEntry({ state: "implemented", request: "slug", pr: 5 });
    expect(result).toBe('{"state":"implemented","request":"slug","pr":5}');
  });
});
