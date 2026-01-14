import { describe, expect, it, beforeEach } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createWebSearchTool } from "../src/tools/webSearch.js";

describe("webSearch tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns context on success", async () => {
    axiosMock.post.mockResolvedValue({ data: { context: "hello" } });
    const tool = createWebSearchTool({ exaApiKey: "key" });
    const result = await tool.handler({ query: "test" });
    expect(result.content[0].text).toBe("hello");
  });

  it("handles missing context", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createWebSearchTool();
    const result = await tool.handler({ query: "test" });
    expect(result.content[0].text).toContain("No search results");
  });

  it("handles axios errors", async () => {
    const error = {
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    };
    axiosMock.post.mockRejectedValue(error);
    const tool = createWebSearchTool();
    const result = await tool.handler({ query: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createWebSearchTool();
    const result = await tool.handler({ query: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createWebSearchTool();
    const result = await tool.handler({ query: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createWebSearchTool();
    const result = await tool.handler({ query: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search error: boom");
  });
});
