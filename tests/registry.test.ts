import { describe, expect, it } from "vitest";
import "./helpers/agnostMock.js";
import { createToolRegistry, getToolDefinition, TOOL_IDS } from "../src/tools/registry.js";

describe("tool registry", () => {
  it("creates all tools", () => {
    const tools = createToolRegistry();
    const ids = tools.map(tool => tool.id);
    expect(ids.sort()).toEqual([...TOOL_IDS].sort());
  });

  it("finds tool definitions", () => {
    const tool = getToolDefinition("web_search_exa");
    expect(tool?.id).toBe("web_search_exa");
  });

  it("returns undefined for unknown tools", () => {
    const tool = getToolDefinition("nope");
    expect(tool).toBeUndefined();
  });
});
