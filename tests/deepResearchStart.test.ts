import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createDeepResearchStartTool } from "../src/tools/deepResearchStart.js";

describe("deepResearchStart tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns task metadata on success", async () => {
    const data = { id: "task-1", outputSchema: { type: "object" } };
    axiosMock.post.mockResolvedValue({ data });
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.content[0].text).toContain("task-1");
  });

  it("handles missing id", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to start");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research start error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research start error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research start error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createDeepResearchStartTool();
    const result = await tool.handler({ instructions: "do it" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research start error: boom");
  });
});
