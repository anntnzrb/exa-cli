import { beforeEach, describe, expect, it } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import "./helpers/agnostMock.js";
import { createCompanyResearchTool } from "../src/tools/companyResearch.js";

describe("companyResearch tool", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns JSON results", async () => {
    const data = { results: [{ id: "1" }] };
    axiosMock.post.mockResolvedValue({ data });
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
  });

  it("handles missing results", async () => {
    axiosMock.post.mockResolvedValue({ data: {} });
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.content[0].text).toContain("No company information");
  });

  it("handles axios errors", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "bad" } },
      message: "bad"
    });
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Company research error (500): bad");
  });

  it("handles axios errors with string response body", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: "bad request" },
      message: "fallback"
    });
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Company research error (500): fallback");
  });

  it("handles axios errors without response", async () => {
    axiosMock.post.mockRejectedValue({
      isAxiosError: true,
      message: "fallback"
    });
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Company research error (unknown): fallback");
  });

  it("handles generic errors", async () => {
    axiosMock.post.mockRejectedValue(new Error("boom"));
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Company research error: boom");
  });

  it("handles non-error throwables", async () => {
    axiosMock.post.mockRejectedValue("boom");
    const tool = createCompanyResearchTool();
    const result = await tool.handler({ companyName: "Exa" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Company research error: boom");
  });
});
