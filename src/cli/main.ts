#!/usr/bin/env bun

/**
 * aozu — design layer CLI entry point.
 *
 * Dispatches to command handlers via the registry.
 * No CLI framework is used (ADR-0009).
 */

import { createRegistry, register, dispatch, helpText } from "./registry.ts";
import { handleCheck } from "./commands/check.ts";
import { handleCoverage } from "./commands/coverage.ts";
import { handleExport } from "./commands/export.ts";
import { handleInit } from "./commands/init.ts";
import { handleMark } from "./commands/mark.ts";
import { handlePlan } from "./commands/plan.ts";
import { handlePrompt } from "./commands/prompt.ts";
import { handleScaffold } from "./commands/scaffold.ts";
import { handleStatus } from "./commands/status.ts";

const registry = createRegistry();
register(registry, "check", handleCheck, "run closure checks on design directory");
register(registry, "coverage", handleCoverage, "verify draft coverage and transition to requested");
register(registry, "export", handleExport, "export design artifacts");
register(registry, "init", handleInit, "initialize a design directory");
register(registry, "mark", handleMark, "transition element states");
register(registry, "plan", handlePlan, "generate a plan from designed elements");
register(registry, "prompt", handlePrompt, "generate prompts for design workflows");
register(registry, "scaffold", handleScaffold, "create a new design document from template");
register(registry, "status", handleStatus, "show design frontiers and summary");

const argv = process.argv.slice(2); // strip [bun, script.ts]
const commandName = argv[0];
const commandArgs = argv.slice(1);

if (!commandName || commandName === "--help" || commandName === "-h") {
  process.stderr.write(helpText(registry) + "\n");
  process.exit(0);
}

if (commandName === "--version" || commandName === "-v") {
  const { fileURLToPath } = await import("url");
  const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const pkg = (await Bun.file(pkgPath).json()) as { version: string };
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

const exitCode = await dispatch(registry, commandName, commandArgs);
process.exit(exitCode);
