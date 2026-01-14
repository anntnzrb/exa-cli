import { z } from "zod";
import axios from "axios";
import { API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { getAxiosErrorInfo, logAxiosError } from "../utils/axiosError.js";
import { checkpoint } from "agnost";
import type { ToolConfig, ToolDefinition } from "./toolTypes.js";
import type { LinkedInSearchArgs } from "./toolArgs.js";

export const linkedInSearchSchema = {
  query: z.string().describe("LinkedIn search query (e.g., person name, company, job title)"),
  searchType: z.enum(["profiles", "companies", "all"]).optional().describe("Type of LinkedIn content to search (default: all)"),
  numResults: z.number().optional().describe("Number of LinkedIn results to return (default: 5)")
};

export const createLinkedInSearchTool = (config?: ToolConfig): ToolDefinition<LinkedInSearchArgs> => ({
  id: "linkedin_search_exa",
  description: "Search LinkedIn profiles and companies using Exa AI - finds professional profiles, company pages, and business-related content on LinkedIn. Useful for networking, recruitment, and business research.",
  schema: linkedInSearchSchema,
  handler: async ({ query, searchType, numResults }) => {
    const requestId = `linkedin_search_exa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'linkedin_search_exa');
    
    logger.start(`${query} (${searchType || 'all'})`);
    
    try {
      // Create a fresh axios instance for each request
      const axiosInstance = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': config?.exaApiKey || Bun.env.EXA_API_KEY || '',
          'x-exa-integration': 'linkedin-search-mcp'
        },
        timeout: 25000
      });

      let searchQuery = query;
      let includeDomains: string[];
      let searchTypeValue: "keyword" | "neural";

      if (searchType === "profiles") {
        includeDomains = ["linkedin.com/in"];
        searchTypeValue = "keyword";
      } else if (searchType === "companies") {
        includeDomains = ["linkedin.com/company"];
        searchTypeValue = "keyword";
      } else {
        includeDomains = ["linkedin.com"];
        searchTypeValue = "neural";
      }

      const searchRequest: ExaSearchRequest = {
        query: searchQuery,
        type: searchTypeValue,
        numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'preferred'
        },
        includeDomains
      };
      
      checkpoint('linkedin_search_request_prepared');
      logger.log("Sending request to Exa API for LinkedIn search");
      
      const response = await axiosInstance.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest,
        { timeout: 25000 }
      );
      
      checkpoint('linkedin_search_response_received');
      logger.log("Received response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API");
        checkpoint('linkedin_search_complete');
        return {
          content: [{
            type: "text" as const,
            text: "No LinkedIn content found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} LinkedIn results`);
      
      const result = {
        content: [{
          type: "text" as const,
          text: JSON.stringify(response.data, null, 2)
        }]
      };
      
      checkpoint('linkedin_search_complete');
      logger.complete();
      return result;
    } catch (error) {
      logger.error(error);
      
      const axiosInfo = getAxiosErrorInfo(error);
      if (axiosInfo) {
        logAxiosError(logger, axiosInfo);
        return {
          content: [{
            type: "text" as const,
            text: `LinkedIn search error (${axiosInfo.statusCode}): ${axiosInfo.message}`
          }],
          isError: true,
        };
      }
      
      // Handle generic errors
      return {
        content: [{
          type: "text" as const,
          text: `LinkedIn search error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  }
});
