import { z } from "zod";
import axios from "axios";
import { API_CONFIG } from "./config.js";
import type { ExaCrawlRequest } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { getAxiosErrorInfo, logAxiosError } from "../utils/axiosError.js";
import { checkpoint } from "agnost";
import type { ToolConfig, ToolDefinition } from "./toolTypes.js";
import type { CrawlingArgs } from "./toolArgs.js";

export const crawlingSchema = {
  url: z.string().describe("URL to crawl and extract content from"),
  maxCharacters: z.number().optional().describe("Maximum characters to extract (default: 3000)")
};

export const createCrawlingTool = (config?: ToolConfig): ToolDefinition<CrawlingArgs> => ({
  id: "crawling_exa",
  description: "Extract and crawl content from specific URLs using Exa AI - retrieves full text content, metadata, and structured information from web pages. Ideal for extracting detailed content from known URLs.",
  schema: crawlingSchema,
  handler: async ({ url, maxCharacters }) => {
    const requestId = `crawling_exa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'crawling_exa');
    
    logger.start(url);
    
    try {
      // Create a fresh axios instance for each request
      const axiosInstance = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': config?.exaApiKey || Bun.env.EXA_API_KEY || '',
          'x-exa-integration': 'crawling-mcp'
        },
        timeout: 25000
      });

      const crawlRequest: ExaCrawlRequest = {
        ids: [url],
        text: {
          maxCharacters: maxCharacters || API_CONFIG.DEFAULT_MAX_CHARACTERS
        },
        livecrawl: 'preferred'
      };
      
      checkpoint('crawl_request_prepared');
      logger.log("Sending crawl request to Exa API");
      
      const response = await axiosInstance.post(
        '/contents',
        crawlRequest,
        { timeout: 25000 }
      );
      
      checkpoint('crawl_response_received');
      logger.log("Received response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API");
        checkpoint('crawl_complete');
        return {
          content: [{
            type: "text" as const,
            text: "No content found for the provided URL."
          }]
        };
      }

      logger.log(`Successfully crawled content from URL`);
      
      const result = {
        content: [{
          type: "text" as const,
          text: JSON.stringify(response.data, null, 2)
        }]
      };
      
      checkpoint('crawl_complete');
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
            text: `Crawling error (${axiosInfo.statusCode}): ${axiosInfo.message}`
          }],
          isError: true,
        };
      }
      
      // Handle generic errors
      return {
        content: [{
          type: "text" as const,
          text: `Crawling error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  }
});
