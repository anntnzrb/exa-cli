import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createExaCodeTool } from "../src/tools/exaCode.js";

describe("exaCode tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns string response", async () => {
    axiosMock.post.mockResolvedValue({
      data: { response: "code", resultsCount: 1 }
    });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.content[0].text).toBe("code");
  });

  it("handles missing resultsCount", async () => {
    axiosMock.post.mockResolvedValue({
      data: { response: "code" }
    });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.content[0].text).toBe("code");
  });

  it("stringifies non-string response", async () => {
    axiosMock.post.mockResolvedValue({
      data: { response: { a: 1 }, resultsCount: 1 }
    });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.content[0].text).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("handles empty response", async () => {
    axiosMock.post.mockResolvedValue({ data: null });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.content[0].text).toContain("No code snippets");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Code search error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Code search error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Code search error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createExaCodeTool();
    const result = await tool.handler({ query: "q", tokensNum: 1000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Code search error: boom");
  });
});
