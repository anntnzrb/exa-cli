import { describe, expect, it, beforeEach, vi } from "vitest";
import { PassThrough } from "stream";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { fileURLToPath } from "url";

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

const { runCli } = await import("../src/cli.js");

const makeIo = () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = "";
  let err = "";
  stdout.on("data", chunk => {
    out += chunk.toString();
  });
  stderr.on("data", chunk => {
    err += chunk.toString();
  });
  return { stdout, stderr, out: () => out, err: () => err };
};

describe("cli", () => {
  beforeEach(() => {
    handler.mockClear();
  });

  it("prints help", async () => {
    const io = makeIo();
    const code = await runCli(["--help"], {
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("Usage:");
  });

  it("skips empty argv entries", async () => {
    const io = makeIo();
    const code = await runCli(["", "--help"], {
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("Usage:");
  });

  it("lists tools", async () => {
    const io = makeIo();
    const code = await runCli(["--list-tools"], {
      stdin: new PassThrough(),
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
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.err()).toContain("Missing tool_id");
  });

  it("errors on unknown tool", async () => {
    const io = makeIo();
    const code = await runCli(["nope", "--input", "{}"], {
      stdin: new PassThrough(),
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
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:x");
  });

  it("ignores extra positional args", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "extra", "--input", "{\"query\":\"x\"}"], {
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:x");
  });

  it("errors on missing input", async () => {
    const io = makeIo();
    const stdin = new PassThrough();
    (stdin as NodeJS.ReadStream).isTTY = true;
    const code = await runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("reads input from stdin", async () => {
    const io = makeIo();
    const stdin = new PassThrough();
    (stdin as NodeJS.ReadStream).isTTY = false;
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    stdin.write(JSON.stringify({ query: "stdin" }));
    stdin.end();
    const code = await promise;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:stdin");
  });

  it("reads input from stdin without isTTY", async () => {
    const io = makeIo();
    const stdin = new PassThrough();
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    stdin.write(JSON.stringify({ query: "nostty" }));
    stdin.end();
    const code = await promise;
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:nostty");
  });

  it("handles empty stdin", async () => {
    const io = makeIo();
    const stdin = new PassThrough();
    (stdin as NodeJS.ReadStream).isTTY = false;
    const promise = runCli(["dummy"], {
      stdin,
      stdout: io.stdout,
      stderr: io.stderr
    });
    stdin.end();
    const code = await promise;
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out());
    expect(parsed.isError).toBe(true);
  });

  it("reads input from --input-file", async () => {
    const io = makeIo();
    const dir = await mkdtemp(join(tmpdir(), "exa-cli-"));
    const file = join(dir, "input.json");
    await writeFile(file, JSON.stringify({ query: "file" }), "utf8");
    const code = await runCli(["dummy", "--input-file", file], {
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    await rm(dir, { recursive: true, force: true });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:file");
  });

  it("reads input from @file", async () => {
    const io = makeIo();
    const dir = await mkdtemp(join(tmpdir(), "exa-cli-"));
    const file = join(dir, "input.json");
    await writeFile(file, JSON.stringify({ query: "atfile" }), "utf8");
    const code = await runCli(["dummy", "--input", `@${file}`], {
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    await rm(dir, { recursive: true, force: true });
    expect(code).toBe(0);
    expect(io.out()).toContain("ok:atfile");
  });

  it("handles invalid JSON", async () => {
    const io = makeIo();
    const code = await runCli(["dummy", "--input", "{oops"], {
      stdin: new PassThrough(),
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
      stdin: new PassThrough(),
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
      stdin: new PassThrough(),
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
      stdin: new PassThrough(),
      stdout: io.stdout,
      stderr: io.stderr
    });
    expect(code).toBe(1);
    expect(io.out()).toContain("\n");
  });

  it("runs entrypoint when invoked directly", async () => {
    const originalArgv = [...process.argv];
    const originalExitCode = process.exitCode;
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    process.argv = ["node", cliPath, "--help"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(stdoutSpy).toHaveBeenCalled();
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("skips entrypoint when argv[1] is missing", async () => {
    const originalArgv = [...process.argv];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.argv = ["node"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(stdoutSpy).not.toHaveBeenCalled();
    process.argv = originalArgv;
    stdoutSpy.mockRestore();
  });

  it("sets exitCode on entrypoint errors", async () => {
    const originalArgv = [...process.argv];
    const originalExitCode = process.exitCode;
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    process.argv = ["node", cliPath, "nope", "--input", "{}"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setImmediate(resolve));
    expect(process.exitCode).toBe(1);
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("handles entrypoint exceptions", async () => {
    const originalArgv = [...process.argv];
    const originalExitCode = process.exitCode;
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    process.argv = ["node", cliPath, "dummy", "--input", "@/nope.json"];
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(process.exitCode).toBe(1);
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("handles entrypoint non-error throws", async () => {
    const originalArgv = [...process.argv];
    const originalExitCode = process.exitCode;
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    process.argv = ["node", cliPath, "dummy", "--input", "@/boom.json"];
    vi.doMock("fs/promises", () => ({
      readFile: () => {
        throw "boom";
      }
    }));
    vi.resetModules();
    await import("../src/cli.js");
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(process.exitCode).toBe(1);
    vi.unmock("fs/promises");
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
