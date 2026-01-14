import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createDeepSearchTool } from "../src/tools/deepSearch.js";

describe("deepSearch tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("uses additional queries when provided", async () => {
    axiosMock.post.mockResolvedValue({ data: { context: "ctx" } });
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj", search_queries: ["q1", "q2"] });
    expect(result.content[0].text).toBe("ctx");
    const request = axiosMock.post.mock.calls[0][1];
    expect(request.additionalQueries).toEqual(["q1", "q2"]);
  });

  it("omits additional queries when not provided", async () => {
    axiosMock.post.mockResolvedValue({ data: { context: "ctx" } });
    const tool = createDeepSearchTool();
    await tool.handler({ objective: "obj" });
    const request = axiosMock.post.mock.calls[0][1];
    expect(request.additionalQueries).toBeUndefined();
  });

  it("handles missing context", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.content[0].text).toContain("No search results");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Deep search error (500): bad");
  });

  it("handles axios errors with string response body", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: "bad request" },
      message: "fallback"
    });
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Deep search error (500): fallback");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Deep search error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Deep search error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createDeepSearchTool();
    const result = await tool.handler({ objective: "obj" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Deep search error: boom");
  });
});
