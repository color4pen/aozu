# Verification Result — skeleton-and-parser — iter 1

## Verdict: failed

errorCode: PACKAGE_JSON_SCRIPTS_TAMPERED

## Phase Results

| # | Phase | Status | Duration | Exit Code |
|---|-------|--------|----------|-----------|
| 1 | package-json-integrity | failed | 0.0s | — |

## Phase: package-json-integrity

Step 'package-json-integrity' failed

```
Baseline scripts:
{}

Current scripts:
{
  "typecheck": "tsc --noEmit",
  "test": "bun test"
}
```
