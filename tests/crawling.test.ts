import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createCrawlingTool } from "../src/tools/crawling.js";
import { API_CONFIG } from "../src/tools/config.js";

describe("crawling tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns JSON results", async () => {
    const data = { results: [{ id: "1" }] };
    axiosMock.post.mockResolvedValue({ data });
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
  });

  it("sends maxCharacters at the top level", async () => {
    axiosMock.post.mockResolvedValue({ data: { results: [] } });
    const tool = createCrawlingTool();
    await tool.handler({ url: "https://example.com", maxCharacters: 123 });
    expect(axiosMock.post).toHaveBeenCalledWith(
      "/contents",
      expect.objectContaining({
        ids: ["https://example.com"],
        text: { maxCharacters: 123 },
        livecrawl: "preferred"
      }),
      { timeout: 25000 }
    );
  });

  it("defaults maxCharacters when omitted", async () => {
    axiosMock.post.mockResolvedValue({ data: { results: [] } });
    const tool = createCrawlingTool();
    await tool.handler({ url: "https://example.com" });
    expect(axiosMock.post).toHaveBeenCalledWith(
      "/contents",
      expect.objectContaining({
        ids: ["https://example.com"],
        text: { maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS },
        livecrawl: "preferred"
      }),
      { timeout: 25000 }
    );
  });

  it("handles missing results", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.content[0].text).toContain("No content found");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawling error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawling error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawling error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createCrawlingTool();
    const result = await tool.handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawling error: boom");
  });
});
