#!/usr/bin/env bun

/**
 * aozu — design layer CLI entry point.
 *
 * Dispatches to command handlers via the registry.
 * No CLI framework is used (ADR-0009).
 */

import { createRegistry, register, dispatch, helpText } from "./registry.ts";
import { handleCheck } from "./commands/check.ts";
import { handleExport } from "./commands/export.ts";

const registry = createRegistry();
register(registry, "check", handleCheck, "run closure checks on design directory");
register(registry, "export", handleExport, "export design artifacts");

const argv = process.argv.slice(2); // strip [bun, script.ts]
const commandName = argv[0];
const commandArgs = argv.slice(1);

if (!commandName || commandName === "--help" || commandName === "-h") {
  process.stderr.write(helpText(registry) + "\n");
  process.exit(0);
}

const exitCode = await dispatch(registry, commandName, commandArgs);
process.exit(exitCode);
