import { z } from "zod";

export type ToolResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
};

export type ToolHints = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
};

export type ToolDefinition = {
  id: string;
  description: string;
  schema: z.ZodRawShape;
  hints?: ToolHints;
  handler: (args: any) => Promise<ToolResult>;
};

export type ToolConfig = {
  exaApiKey?: string;
};
