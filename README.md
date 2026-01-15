# Exa CLI 🔍

CLI for Exa web search, research, crawling, and code context tools.

## Install

```bash
bunx github:anntnzrb/exa-cli --list-tools
# Or for local dev
bun install
```

## Usage

```bash
bun run build:cli
exa-cli --list-tools
exa-cli web_search_exa --input '{"query":"latest ai news"}'
exa-cli get_code_context_exa --input '{"query":"React useState hook examples","tokensNum":5000}'
exa-cli linkedin_search_exa --input '{"query":"Jane Doe","searchType":"profiles"}'
exa-cli linkedin_search_exa --input '{"query":"Acme","searchType":"companies"}'

# Input via stdin

echo '{"query":"exa api"}' | exa-cli web_search_exa

# Input from file

exa-cli web_search_exa --input @input.json
exa-cli web_search_exa --input-file input.json

# Pretty output and api key override

exa-cli web_search_exa --input '{"query":"exa"}' --pretty
exa-cli web_search_exa --input '{"query":"exa"}' --api-key "$EXA_API_KEY"
```

## Environment

```bash
export EXA_API_KEY="your-api-key"
```

## Tools

- `web_search_exa`
- `deep_search_exa`
- `company_research_exa`
- `crawling_exa`
- `linkedin_search_exa`
- `deep_researcher_start`
- `deep_researcher_check`
- `get_code_context_exa`

LinkedIn search notes:
- `searchType: "profiles"` targets `linkedin.com/in`
- `searchType: "companies"` targets `linkedin.com/company`
- `searchType: "all"` (default) targets `linkedin.com`
