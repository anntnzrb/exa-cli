export type StdinLike = {
  isTTY?: boolean;
  size?: number;
  setEncoding?: (encoding?: string) => unknown;
  on?: (event: "data" | "end" | "error", cb: (chunk?: string) => void) => void;
  text?: () => Promise<string>;
  stream?: () => ReadableStream<Uint8Array>;
};

export type StdoutLike = {
  write: (chunk: string) => unknown;
};

export type CliIO = {
  stdin: StdinLike;
  stdout: StdoutLike;
  stderr: StdoutLike;
};

type InputOptions = {
  input?: string;
  inputFile?: string;
};

export const readStdin = async (stdin: StdinLike): Promise<string> => {
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

export const resolveInput = async (
  options: InputOptions,
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

export const printJson = (payload: unknown, pretty: boolean | undefined, stdout: StdoutLike) => {
  const json = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  stdout.write(`${json}\n`);
};

export const formatError = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true
});

export const defaultIo: CliIO = {
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
