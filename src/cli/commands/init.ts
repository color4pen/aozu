/**
 * `init` command handler.
 *
 * Generates a minimal design directory (static-only profile, ADR-0010 stage ①).
 * The generated structure passes `aozu check` immediately.
 *
 * Exit codes:
 *   0 = success
 *   1 = design directory already exists (fail-closed)
 *   2 = input error
 */

import { stat, mkdir } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Templates (embedded — no runtime file references; ADR-0009 zero-dep)
// ---------------------------------------------------------------------------

/**
 * Minimal manifest for the static-only profile (ADR-0010 stage ①).
 *
 * Passes check immediately; add more layers to `enabled:` as needed.
 */
export const MANIFEST_TEMPLATE = `---
format-version: 0
enabled: static
---

# manifest

<!-- enabled: 利用する層を有効化する。段階①では static のみ。
     追加可能な層: domain, dynamic, loop
     詳細: spec/format.md §3

     loop 有効化後、prompt derive を使う場合は以下のキーも追加する:
       request-template: <ファイルパスまたはシェルコマンド>
         - ファイルパスの場合: design dir からの相対パスで内容を読む
         - コマンドの場合: stdout をテンプレートとして使用する
       request-output-dir: <出力先ディレクトリパス>
         - prompt derive が草稿を出力するディレクトリ
     詳細: spec/format.md §3 -->
`;

/**
 * Placeholder modules file with one starter module.
 *
 * Format: spec/format.md §8 (static/modules.md — mod)
 */
export const MODULES_TEMPLATE = `# モジュール構成

## アプリケーション {#mod-app}
責務: （このモジュールの責務を記述する）
実装: src/

<!-- モジュールを追加するには以下の形式を使う:
     ## 名前 {#mod-<slug>}
     責務: <責務の説明>
     実装: <実装ディレクトリ>（カンマ区切りで複数可）

     詳細: spec/format.md §8 -->
`;

/**
 * Empty permitted-dependency file.
 *
 * Format: spec/format.md §8 (static/dependencies.md)
 */
export const DEPENDENCIES_TEMPLATE = `# 許可依存

<!-- 許可依存を追加するには以下の形式を使う:
     - [[mod-<from>]] -> [[mod-<to>]]

     列挙されない依存はすべて禁止（fail-closed）。
     詳細: spec/format.md §8 -->
`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Check whether a path exists (any type). */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle the `init` command.
 *
 * Creates a minimal design directory with manifest.md, static/modules.md,
 * and static/dependencies.md. Fails if the directory already exists.
 */
export async function handleInit(args: string[]): Promise<number> {
  // --help
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu init [--dir <path>]",
        "",
        "Initialize a design directory with the minimal static profile (ADR-0010 stage ①).",
        "The generated structure passes `aozu check` immediately.",
        "",
        "Options:",
        "  --dir <path>  Target directory (default: ./design)",
        "  -h, --help    Show this help",
        "",
        "Exit codes: 0 = success / 1 = directory already exists / 2 = input error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Fail-closed: do not touch an existing directory
  if (await pathExists(designDir)) {
    process.stderr.write(`ERROR: design directory already exists: ${designDir}\n`);
    process.stderr.write(`Remove or rename it before running init.\n`);
    return 1;
  }

  // Create directory structure
  await mkdir(join(designDir, "static"), { recursive: true });

  // Write files
  await Bun.write(join(designDir, "manifest.md"), MANIFEST_TEMPLATE);
  await Bun.write(join(designDir, "static", "modules.md"), MODULES_TEMPLATE);
  await Bun.write(join(designDir, "static", "dependencies.md"), DEPENDENCIES_TEMPLATE);

  process.stderr.write(`Initialized design directory: ${designDir}\n`);
  process.stderr.write(`  ${join(designDir, "manifest.md")}\n`);
  process.stderr.write(`  ${join(designDir, "static", "modules.md")}\n`);
  process.stderr.write(`  ${join(designDir, "static", "dependencies.md")}\n`);
  process.stderr.write(`\nRun: aozu check --dir ${designDir}\n`);

  return 0;
}
