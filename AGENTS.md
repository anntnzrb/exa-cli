# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds TypeScript source. Entry point is `src/cli.ts`.
- `src/cli/` contains CLI IO/helpers. `src/tools/` contains tool implementations and registry.
- `src/utils/` and `src/types.ts` provide shared utilities and types.
- `tests/` contains Vitest specs (`*.test.ts`).
- `build/` and `coverage/` are generated outputs; do not edit by hand.

## Build, Test, and Development Commands
- `bun run build`: Compile TypeScript to `build/` via `bunx tsc`.
- `bun run watch`: Watch mode for TypeScript builds.
- `bun run test`: Run Vitest with coverage (`bunx vitest run --coverage`).
- Local CLI example: `bunx github:anntnzrb/exa-cli --list-tools` (after build for local bin, run `bun run build`).

## Coding Style & Naming Conventions
- TypeScript, ESM (`"type": "module"`). Use `import`/`export`.
- Indentation: 2 spaces. Strings: double quotes (match existing files).
- Naming: `camelCase` for variables/functions, `PascalCase` for types/interfaces, `lowerCamelCase` filenames (e.g., `deepResearchStart.ts`).
- Avoid `any`; prefer explicit types or `unknown` with narrowing.

## Testing Guidelines
- Framework: Vitest. Specs live in `tests/` and end with `.test.ts`.
- Coverage is expected to stay at 100% for statements/branches/functions/lines.
- Add a regression test when fixing a bug; keep tests small and focused.
