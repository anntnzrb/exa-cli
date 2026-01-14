import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createDeepResearchCheckTool } from "../src/tools/deepResearchCheck.js";

describe("deepResearchCheck tool", () => {
  beforeEach(() => {
    axiosMock.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const runWithResponse = async (data: unknown) => {
    axiosMock.get.mockResolvedValue({ data });
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    return await promise;
  };

  it("formats completed status", async () => {
    const result = await runWithResponse({
      id: "task-1",
      status: "completed",
      data: { report: "report" }
    });
    expect(result.content[0].text).toContain("Deep research completed");
  });

  it("uses fallback report when missing", async () => {
    const result = await runWithResponse({
      id: "task-1",
      status: "completed"
    });
    expect(result.content[0].text).toContain("No report generated");
  });

  it("formats running status", async () => {
    const result = await runWithResponse({
      id: "task-1",
      status: "running"
    });
    expect(result.content[0].text).toContain("Research in progress");
  });

  it("formats failed status", async () => {
    const result = await runWithResponse({
      id: "task-1",
      status: "failed",
      createdAt: 1000,
      instructions: "do it"
    });
    expect(result.content[0].text).toContain("Deep research task failed");
  });

  it("formats unknown status", async () => {
    const result = await runWithResponse({
      id: "task-1",
      status: "mystery"
    });
    expect(result.content[0].text).toContain("Unknown status");
  });

  it("handles missing data", async () => {
    const result = await runWithResponse(undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to check research task status");
  });

  it("handles 404 axios errors", async () => {
    axiosMock.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: "Not found" } },
      message: "Not found"
    });
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Task not found");
  });

  it("handles other axios errors", async () => {
    axiosMock.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research check error (500): bad");
  });

  it("handles axios errors without response", async () => {
    axiosMock.get.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research check error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.get.mockRejectedValue(new Error("boom"));
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research check error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.get.mockRejectedValue("boom");
    const tool = createDeepResearchCheckTool();
    const promise = tool.handler({ taskId: "task-1" });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Research check error: boom");
  });
});
