import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const handler = vi.fn(async (args: { query: string }) => ({
  content: [{ type: "text" as const, text: `ok:${args.query}` }]
}));

vi.mock("../src/tools/registry.js", () => {
  const tool = {
    id: "dummy",
    description: "dummy tool",
    schema: { query: z.string() },
    handler
  };
  return {
    createToolRegistry: () => [tool],
    getToolDefinition: (id: string) => (id === "dummy" ? tool : undefined),
    TOOL_IDS: ["dummy"]
  };
});

let runCli: typeof import("../src/cli.js").runCli;
let originalBun: typeof Bun | undefined;

beforeAll(async () => {
  originalBun = (globalThis as { Bun?: typeof Bun }).Bun;
  if (!originalBun) {
    (globalThis as { Bun?: typeof Bun }).Bun = {
      env: {},
      argv: ["bun"],
      stdin: { size: Number.POSITIVE_INFINITY, text: async () => "" },
      stdout: {},
      stderr: {},
      write: () => 0,
      exit: () => {},
      file: () => ({
        text: async () => ""
      })
    } as typeof Bun;
  }
  runCli = (await import("../src/cli.js")).runCli;
});

afterAll(() => {
  if (originalBun) {
    (globalThis as { Bun?: typeof Bun }).Bun = originalBun;
  } else {
    delete (globalThis as { Bun?: typeof Bun }).Bun;
  }
});

const makeIo = () => {
  let out = "";
  let err = "";
  return {
    stdout: {
      write: (chunk: string) => {
        out += chunk;
      }
    },
    stderr: {
      write: (chunk: string) => {
        err += chunk;
      }
    },
    out: () => out,
    err: () => err
  };
};

const makeEventInput = (data: string, includeTty: boolean) => {
  const handlers: {
    data?: (chunk?: string) => void;
    end?: () => void;
    error?: (error: unknown) => void;
  } = {};
  const stdin = {
    ...(includeTty ? { isTTY: false } : {}),
    setEncoding: () => {},
    on: (event: "data" | "end" | "error", cb: (chunk?: string) => void) => {
      handlers[event] = cb;
    }
  };
  const emit = () => {
    handlers.data?.(data);
    handlers.end?.();
  };
  return { stdin, emit };
};

describe("cli", () => {
  beforeEach(() => {
    handler.mockClear();
  });

  it("prints help", async () => {
    const io = makeIo();
    const code = await runCli(["--help"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("Usage:");
  });

  it("skips empty argv entries", async () => {
    const io = makeIo();
    const code = await runCli(["", "--help"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("Usage:");
  });

  it("lists tools", async () => {
    const io = makeIo();
    const code = await runCli(["--list-tools"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(io.out());
    expect(parsed[0].id).toBe("dummy");
  });

  it("errors on missing tool", async () => {
    const io = makeIo();
    const code = await runCli([], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.err()).toContain("Missing tool_id");
  });

  it("errors on unknown tool", async () => {
    const io = makeIo();
    const code = await runCli(["nope", "--input", "{}"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("accepts api key flag", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "--api-key", "k", "--input", "{\"query\":\"x\"}"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:x");
  });

  it("ignores extra positional args", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "extra", "--input", "{\"query\":\"x\"}"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:x");
  });

  it("errors on missing input", async () => {
    const io = makeIo();
    const code = await runCli(["dummy"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("reads input from stdin", async () => {
    const io = makeIo();
    const { stdin, emit } = makeEventInput(JSON.stringify({ query: "stdin" }), true);
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    emit();
    const code = await promise;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:stdin");
  });

  it("reads input from stdin via text()", async () => {
    const io = makeIo();
    const code = await runCli(["dummy"], {
      stdin: {
        isTTY: false,
        text: async () => "{\"query\":\"stdin-text\"}"
      },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:stdin-text");
  });

  it("reads input from stdin via stream()", async () => {
    const io = makeIo();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"query\":\"stdin-stream\"}"));
        controller.close();
      }
    });
    const code = await runCli(["dummy"], {
      stdin: {
        isTTY: false,
        stream: () => stream
      },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:stdin-stream");
  });

  it("handles stdin with no readable hooks", async () => {
    const io = makeIo();
    const code = await runCli(["dummy"], {
      stdin: { isTTY: false },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.out()).toContain("Missing --input");
  });

  it("handles undefined chunks from stdin events", async () => {
    const io = makeIo();
    const stdin = {
      isTTY: false,
      on: (event: "data" | "end" | "error", cb: (chunk?: string) => void) => {
        if (event === "data") cb(undefined);
        if (event === "end") cb();
      }
    };
    const code = await runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.out()).toContain("Missing --input");
  });

  it("reads input from stdin without isTTY", async () => {
    const io = makeIo();
    const { stdin, emit } = makeEventInput(JSON.stringify({ query: "nostty" }), false);
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    emit();
    const code = await promise;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:nostty");
  });

  it("reads input from stdin when size is finite", async () => {
    const io = makeIo();
    const code = await runCli(["dummy"], {
      stdin: {
        size: 3,
        text: async () => "{\"query\":\"size\"}"
      },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:size");
  });

  it("handles empty stdin", async () => {
    const io = makeIo();
    const { stdin, emit } = makeEventInput("", true);
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    emit();
    const code = await promise;
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("reads input from --input-file", async () => {
    const io = makeIo();
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalFile = bunGlobal.file;
    const filePath = "/tmp/exa-cli-input.json";
    bunGlobal.file = (path: string) => ({
      text: async () => (path === filePath ? JSON.stringify({ query: "file" }) : "")
    });
    const code = await runCli(["dummy", "--input-file", filePath], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    bunGlobal.file = originalFile;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:file");
  });

  it("reads input from @file", async () => {
    const io = makeIo();
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalFile = bunGlobal.file;
    const filePath = "/tmp/exa-cli-input-at.json";
    bunGlobal.file = (path: string) => ({
      text: async () => (path === filePath ? JSON.stringify({ query: "atfile" }) : "")
    });
    const code = await runCli(["dummy", "--input", `@${filePath}`], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    bunGlobal.file = originalFile;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:atfile");
  });

  it("handles invalid JSON", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "--input", "{oops"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("handles schema errors", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "--input", "{}"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("handles non-error throws in handler", async () => {
    handler.mockImplementationOnce(() => {
      throw "boom";
    });
    const io = makeIo();
    const code = await runCli(["dummy", "--input", "{\"query\":\"x\"}"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("returns non-zero when handler reports error", async () => {
    handler.mockResolvedValueOnce({
      content: [{ type: "text" as const, text: "fail" }],
      isError: true
    });
    const io = makeIo();
    const code = await runCli(["dummy", "--input", "{\"query\":\"x\"}", "--pretty"], {
      stdin: { isTTY: true },
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.out()).toContain("\n");
  });

  it("uses default IO when not provided", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalWrite = bunGlobal.write;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const writeSpy = vi.fn(() => 0);
    bunGlobal.write = writeSpy;
    bunGlobal.argv = ["bun"];
    const code = await runCli();
    expect(code).toBe(1);
    expect(writeSpy).toHaveBeenCalled();
    bunGlobal.write = originalWrite;
    bunGlobal.argv = originalArgv;
  });

  it("runs entrypoint when invoked directly", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const writeSpy = vi.fn(() => 0);
    const originalWrite = bunGlobal.write;
    bunGlobal.write = writeSpy;
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = true;
    (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__ = true;
    bunGlobal.argv = ["bun", cliPath, "--help"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(writeSpy).toHaveBeenCalled();
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
    delete (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__;
    delete (globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__;
    bunGlobal.argv = originalArgv;
    bunGlobal.write = originalWrite;
  });

  it("skips entrypoint when argv[1] is missing", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const writeSpy = vi.fn(() => 0);
    const originalWrite = bunGlobal.write;
    bunGlobal.write = writeSpy;
    bunGlobal.argv = ["bun"];
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = false;
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(writeSpy).not.toHaveBeenCalled();
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
    bunGlobal.argv = originalArgv;
    bunGlobal.write = originalWrite;
  });

  it("sets exitCode on entrypoint errors", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = true;
    (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__ = true;
    bunGlobal.argv = ["bun", cliPath, "nope", "--input", "{}"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect((globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__).toBe(1);
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
    delete (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__;
    delete (globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__;
    bunGlobal.argv = originalArgv;
  });

  it("handles entrypoint exceptions", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    const originalFile = bunGlobal.file;
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = true;
    (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__ = true;
    bunGlobal.argv = ["bun", cliPath, "dummy", "--input", "@/nope.json"];
    bunGlobal.file = () => {
      throw new Error("missing");
    };
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setTimeout(resolve, 10));
    expect((globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__).toBe(1);
    bunGlobal.file = originalFile;
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
    delete (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__;
    delete (globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__;
    bunGlobal.argv = originalArgv;
  });

  it("handles entrypoint non-error throws", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    const originalFile = bunGlobal.file;
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = true;
    (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__ = true;
    bunGlobal.argv = ["bun", cliPath, "dummy", "--input", "@/boom.json"];
    bunGlobal.file = () => {
      throw "boom";
    };
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setTimeout(resolve, 10));
    expect((globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__).toBe(1);
    bunGlobal.file = originalFile;
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
    delete (globalThis as { __EXA_CLI_DISABLE_EXIT__?: boolean }).__EXA_CLI_DISABLE_EXIT__;
    delete (globalThis as { __EXA_CLI_LAST_EXIT_CODE__?: number }).__EXA_CLI_LAST_EXIT_CODE__;
    bunGlobal.argv = originalArgv;
  });

  it("calls Bun.exit when exit is not disabled", async () => {
    const bunGlobal = (globalThis as { Bun?: typeof Bun }).Bun!;
    const originalArgv = [...(bunGlobal.argv ?? [])];
    const originalExit = bunGlobal.exit;
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    const exitSpy = vi.fn();
    bunGlobal.exit = exitSpy;
    (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__ = true;
    bunGlobal.argv = ["bun", cliPath, "nope", "--input", "{}"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(exitSpy).toHaveBeenCalled();
    bunGlobal.exit = originalExit;
    bunGlobal.argv = originalArgv;
    delete (globalThis as { __EXA_CLI_ENTRY__?: boolean }).__EXA_CLI_ENTRY__;
  });
});
