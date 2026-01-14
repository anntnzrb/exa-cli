import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createLinkedInSearchTool } from "../src/tools/linkedInSearch.js";

describe("linkedInSearch tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("uses profile search query", async () => {
    axiosMock.post.mockResolvedValue({ data: { results: [] } });
    const tool = createLinkedInSearchTool();
    await tool.handler({ query: "Jane", searchType: "profiles" });
    const request = axiosMock.post.mock.calls[0][1];
    expect(request.query).toBe("Jane");
    expect(request.type).toBe("keyword");
    expect(request.includeDomains).toEqual(["linkedin.com/in"]);
  });

  it("uses company search query", async () => {
    axiosMock.post.mockResolvedValue({ data: { results: [] } });
    const tool = createLinkedInSearchTool();
    await tool.handler({ query: "Exa", searchType: "companies" });
    const request = axiosMock.post.mock.calls[0][1];
    expect(request.query).toBe("Exa");
    expect(request.type).toBe("keyword");
    expect(request.includeDomains).toEqual(["linkedin.com/company"]);
  });

  it("uses default search query", async () => {
    axiosMock.post.mockResolvedValue({ data: { results: [] } });
    const tool = createLinkedInSearchTool();
    await tool.handler({ query: "Exa" });
    const request = axiosMock.post.mock.calls[0][1];
    expect(request.query).toBe("Exa");
    expect(request.type).toBe("neural");
    expect(request.includeDomains).toEqual(["linkedin.com"]);
  });

  it("handles missing results", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createLinkedInSearchTool();
    const result = await tool.handler({ query: "Exa" });
    expect(result.content[0].text).toContain("No LinkedIn content");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createLinkedInSearchTool();
    const result = await tool.handler({ query: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LinkedIn search error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createLinkedInSearchTool();
    const result = await tool.handler({ query: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LinkedIn search error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createLinkedInSearchTool();
    const result = await tool.handler({ query: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LinkedIn search error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createLinkedInSearchTool();
    const result = await tool.handler({ query: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LinkedIn search error: boom");
  });
});
