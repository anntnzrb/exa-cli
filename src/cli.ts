#!/usr/bin/env bun
import { z } from "zod";
import { createToolRegistry, getToolDefinition } from "./tools/registry.js";
import type { ToolRegistryEntry } from "./tools/registry.js";
import type { ToolConfig, ToolResult } from "./tools/toolTypes.js";
import { defaultIo, formatError, printJson, resolveInput } from "./cli/io.js";
import type { CliIO } from "./cli/io.js";

type CliOptions = {
  input?: string;
  inputFile?: string;
  apiKey?: string;
  pretty?: boolean;
  listTools?: boolean;
  help?: boolean;
};

const usage = () => `
Usage:
  exa-cli <tool_id> --input '<json>'
  exa-cli <tool_id> --input @path/to/input.json
  exa-cli --list-tools

Examples:
  exa-cli web_search_exa --input '{"query":"latest ai news"}'
  exa-cli get_code_context_exa --input '{"query":"React useState hook examples","tokensNum":5000}'
`;

const parseArgs = (argv: string[]): { toolId?: string; options: CliOptions } => {
  const options: CliOptions = {};
  const args = [...argv];
  let toolId: string | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--list-tools") {
      options.listTools = true;
      continue;
    }
    if (arg === "--pretty") {
      options.pretty = true;
      continue;
    }
    if (arg === "--api-key") {
      options.apiKey = args.shift();
      continue;
    }
    if (arg === "--input" || arg === "-i") {
      options.input = args.shift();
      continue;
    }
    if (arg === "--input-file") {
      options.inputFile = args.shift();
      continue;
    }
    if (!toolId) {
      toolId = arg;
      continue;
    }
  }

  return { toolId, options };
};

const runTool = async (tool: ToolRegistryEntry, raw: unknown) => {
  const schema = z.object(tool.schema);
  const args = schema.parse(raw);
  const handler = tool.handler as (args: unknown) => Promise<ToolResult>;
  return handler(args);
};

export const runCli = async (argv: string[] = Bun.argv.slice(2), io: CliIO = defaultIo) => {
  const { toolId, options } = parseArgs(argv);

  if (options.help) {
    io.stdout.write(usage());
    return 0;
  }

  if (options.listTools) {
    const tools = createToolRegistry({});
    const summary = tools.map(tool => ({ id: tool.id, description: tool.description }));
    printJson(summary, true, io.stdout);
    return 0;
  }

  if (!toolId) {
    io.stderr.write("Missing tool_id.\n");
    io.stdout.write(usage());
    return 1;
  }

  const config: ToolConfig = { exaApiKey: options.apiKey };
  const tool = getToolDefinition(toolId, config);
  if (!tool) {
    printJson(formatError(`Unknown tool: ${toolId}`), options.pretty, io.stdout);
    return 1;
  }

  const input = await resolveInput(options, io.stdin);
  if (!input) {
    printJson(formatError("Missing --input JSON or stdin input."), options.pretty, io.stdout);
    return 1;
  }

  try {
    const parsed = JSON.parse(input);
    const result = await runTool(tool, parsed);
    printJson(result, options.pretty, io.stdout);
    return result.isError ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printJson(formatError(`CLI error: ${message}`), options.pretty, io.stdout);
    return 1;
  }
};

const isEntryPoint = typeof (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ === "boolean"
  ? (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ === true
  : import.meta.main;

const setExitCode = (code: number) => {
  if ((globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__) {
    (globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__ = code;
    return;
  }
  Bun.exit(code);
};

if (isEntryPoint) {
  runCli().then(code => {
    if (code !== 0) {
      setExitCode(code);
    }
  }).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    void Bun.write(Bun.stderr, `CLI error: ${message}\n`);
    setExitCode(1);
  });
}
