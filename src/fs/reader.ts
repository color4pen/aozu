/**
 * File system reader (thin I/O layer).
 *
 * Enumerates `.md` files recursively in a directory and returns their contents
 * as `FileInput[]` for the pure parser layer (`src/parse/`).
 *
 * Uses Bun's `Bun.file` for reading and Node.js `fs/promises` for directory
 * enumeration (both are zero-dependency in a Bun runtime).
 */

import { readdir } from "fs/promises";
import { join } from "path";
import type { FileInput } from "../parse/types.ts";

/**
 * Recursively enumerate all `.md` files under `dir` and return their paths and
 * contents as `FileInput[]`.
 *
 * File paths in the result are absolute (or relative to the process CWD,
 * matching how `dir` was supplied).
 *
 * Order is not guaranteed.
 */
export async function readMarkdownFiles(dir: string): Promise<FileInput[]> {
  const files: FileInput[] = [];
  await collectMdFiles(dir, files);
  return files;
}

async function collectMdFiles(dir: string, out: FileInput[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMdFiles(fullPath, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const content = await Bun.file(fullPath).text();
      out.push({ path: fullPath, content });
    }
  }
}
