/**
 * Version resolution for aozu CLI.
 *
 * Checks for a compile-time constant first (used when compiled via
 * `bun build --compile --define 'globalThis.__AOZU_VERSION="x.y.z"'`).
 * Falls back to reading package.json at runtime (source execution via bun run).
 */

declare global {
  // Injected at compile time via `bun build --compile --define`.
  // Undefined in source-execution mode (bun run src/cli/main.ts).
  // eslint-disable-next-line no-var
  var __AOZU_VERSION: string | undefined;
}

export async function getVersion(): Promise<string> {
  // Compile-time constant takes priority (binary execution path).
  const compiledVersion = globalThis.__AOZU_VERSION;
  if (typeof compiledVersion === "string" && compiledVersion !== "") {
    return compiledVersion;
  }

  // Runtime fallback: read package.json (source execution path).
  const { fileURLToPath } = await import("url");
  const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const pkg = (await Bun.file(pkgPath).json()) as { version: string };
  return pkg.version;
}
