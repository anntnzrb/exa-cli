#!/usr/bin/env bun
import { z } from "zod";
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

type StdinLike = {
  isTTY?: boolean;
  size?: number;
  setEncoding?: (encoding?: string) => unknown;
  on?: (event: "data" | "end" | "error", cb: (chunk?: string) => void) => void;
  text?: () => Promise<string>;
  stream?: () => ReadableStream<Uint8Array>;
};

const readStdin = async (stdin: StdinLike): Promise<string> => {
  if (typeof stdin.text === "function") {
    return await stdin.text();
  }
  if (typeof stdin.stream === "function") {
    return await new Response(stdin.stream()).text();
  }
  if (typeof stdin.on === "function") {
    return await new Promise((resolve, reject) => {
      let data = "";
      stdin.setEncoding?.("utf8");
      stdin.on?.("data", chunk => {
        data += chunk ?? "";
      });
      stdin.on?.("end", () => resolve(data));
      stdin.on?.("error", reject);
    });
  }
  return "";
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
  stdin: StdinLike
): Promise<string | undefined> => {
  if (options.inputFile) {
    return await Bun.file(options.inputFile).text();
  }
  if (options.input?.startsWith("@")) {
    const path = options.input.slice(1);
    return await Bun.file(path).text();
  }
  if (options.input) {
    return options.input;
  }
  const stdinIsTTY =
    typeof stdin.isTTY === "boolean"
      ? stdin.isTTY
      : typeof stdin.size === "number"
        ? !Number.isFinite(stdin.size)
        : false;
  if (!stdinIsTTY) {
    const stdinData = await readStdin(stdin);
    return stdinData.trim().length ? stdinData : undefined;
  }
  return undefined;
};

type StdoutLike = {
  write: (chunk: string) => unknown;
};

const printJson = (payload: unknown, pretty: boolean | undefined, stdout: StdoutLike) => {
  const json = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  stdout.write(`${json}\n`);
};

const formatError = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true
});

type CliIO = {
  stdin: StdinLike;
  stdout: StdoutLike;
  stderr: StdoutLike;
};

const defaultIo: CliIO = {
  stdin: Bun.stdin,
  stdout: {
    write: chunk => {
      void Bun.write(Bun.stdout, chunk);
    }
  },
  stderr: {
    write: chunk => {
      void Bun.write(Bun.stderr, chunk);
    }
  }
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
