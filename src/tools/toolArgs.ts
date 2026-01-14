export type WebSearchArgs = {
  query: string;
  numResults?: number;
  livecrawl?: 'fallback' | 'preferred';
  type?: 'auto' | 'fast' | 'deep' | 'neural' | 'keyword';
  contextMaxCharacters?: number;
};

export type DeepSearchArgs = {
  objective: string;
  search_queries?: string[];
};

export type CompanyResearchArgs = {
  companyName: string;
  numResults?: number;
};

export type CrawlingArgs = {
  url: string;
  maxCharacters?: number;
};

export type LinkedInSearchArgs = {
  query: string;
  searchType?: 'profiles' | 'companies' | 'all';
  numResults?: number;
};

export type DeepResearchStartArgs = {
  instructions: string;
  model: 'exa-research' | 'exa-research-pro';
};

export type DeepResearchCheckArgs = {
  taskId: string;
};

export type ExaCodeArgs = {
  query: string;
  tokensNum: number;
};
