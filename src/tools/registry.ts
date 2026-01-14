import type { ToolConfig } from "./toolTypes.js";
import { createWebSearchTool } from "./webSearch.js";
import { createDeepSearchTool } from "./deepSearch.js";
import { createCompanyResearchTool } from "./companyResearch.js";
import { createCrawlingTool } from "./crawling.js";
import { createLinkedInSearchTool } from "./linkedInSearch.js";
import { createDeepResearchStartTool } from "./deepResearchStart.js";
import { createDeepResearchCheckTool } from "./deepResearchCheck.js";
import { createExaCodeTool } from "./exaCode.js";

export const TOOL_IDS = [
  "web_search_exa",
  "deep_search_exa",
  "company_research_exa",
  "crawling_exa",
  "linkedin_search_exa",
  "deep_researcher_start",
  "deep_researcher_check",
  "get_code_context_exa"
] as const;

export type ToolRegistryEntry =
  | ReturnType<typeof createWebSearchTool>
  | ReturnType<typeof createDeepSearchTool>
  | ReturnType<typeof createCompanyResearchTool>
  | ReturnType<typeof createCrawlingTool>
  | ReturnType<typeof createLinkedInSearchTool>
  | ReturnType<typeof createDeepResearchStartTool>
  | ReturnType<typeof createDeepResearchCheckTool>
  | ReturnType<typeof createExaCodeTool>;

export const createToolRegistry = (config?: ToolConfig): ToolRegistryEntry[] => [
  createWebSearchTool(config),
  createDeepSearchTool(config),
  createCompanyResearchTool(config),
  createCrawlingTool(config),
  createLinkedInSearchTool(config),
  createDeepResearchStartTool(config),
  createDeepResearchCheckTool(config),
  createExaCodeTool(config)
];

export const getToolDefinition = (
  toolId: string,
  config?: ToolConfig
): ToolRegistryEntry | undefined => {
  const tools = createToolRegistry(config);
  return tools.find(tool => tool.id === toolId);
};
