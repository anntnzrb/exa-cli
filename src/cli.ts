#!/usr/bin/env node
import { z } from "zod";
import { pathToFileURL } from "url";
import { createToolRegistry, getToolDefinition } from "./tools/registry.js";
import type { ToolConfig } from "./tools/toolTypes.js";

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

const readStdin = async (stdin: NodeJS.ReadableStream): Promise<string> => {
  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", chunk => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data));
    stdin.on("error", reject);
  });
};

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

const resolveInput = async (
  options: CliOptions,
  stdin: NodeJS.ReadableStream
): Promise<string | undefined> => {
  if (options.inputFile) {
    return await import("fs/promises").then(fs => fs.readFile(options.inputFile!, "utf8"));
  }
  if (options.input?.startsWith("@")) {
    const path = options.input.slice(1);
    return await import("fs/promises").then(fs => fs.readFile(path, "utf8"));
  }
  if (options.input) {
    return options.input;
  }
  const stdinIsTTY = "isTTY" in stdin ? Boolean((stdin as { isTTY?: boolean }).isTTY) : false;
  if (!stdinIsTTY) {
    const stdinData = await readStdin(stdin);
    return stdinData.trim().length ? stdinData : undefined;
  }
  return undefined;
};

const printJson = (payload: unknown, pretty: boolean | undefined, stdout: NodeJS.WritableStream) => {
  const json = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  stdout.write(`${json}\n`);
};

const formatError = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true
});

type CliIO = {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

const defaultIo: CliIO = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
};

export const runCli = async (argv: string[] = process.argv.slice(2), io: CliIO = defaultIo) => {
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
    const schema = z.object(tool.schema);
    const args = schema.parse(parsed);
    const result = await tool.handler(args);
    printJson(result, options.pretty, io.stdout);
    return result.isError ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printJson(formatError(`CLI error: ${message}`), options.pretty, io.stdout);
    return 1;
  }
};

const isEntryPoint =
  process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isEntryPoint) {
  runCli().then(code => {
    if (code !== 0) {
      process.exitCode = code;
    }
  }).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`CLI error: ${message}\n`);
    process.exitCode = 1;
  });
}
