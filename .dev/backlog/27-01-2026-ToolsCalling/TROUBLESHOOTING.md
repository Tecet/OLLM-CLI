# Web Search Implementation & Troubleshooting

**Date:** January 28, 2026  
**Status:** ✅ DuckDuckGo Working | 🔍 LLM Behavior Tuning

---

## Implementation Summary

### DuckDuckGo Search Provider

✅ **Status:** Implemented and working

**Implementation:**

- Created `DuckDuckGoSearchProvider` in `packages/core/src/tools/providers/duckduckgo-search.ts`
- Registered with `web_search` tool in `packages/core/src/tools/index.ts`
- No API key required - free and unlimited (with reasonable use)
- Returns real search results with titles, URLs, and snippets

**Test Results:**

```bash
node scripts/test-duckduckgo.mjs
# Returns 5 real search results from DuckDuckGo
```

### Brave Search MCP

⚠️ **Status:** Shows 0 tools (needs investigation)

**Issue:** Brave Search MCP server shows healthy/connected but 0 tools available.

**Possible Causes:**

1. Server needs restart after API key added
2. Tools not initialized properly
3. Authentication issue with API key

**Workaround:** DuckDuckGo is working as primary search provider.

---

## LLM Behavior Issue

### Problem

LLM receives search results but either:

1. **Ignores them** and makes up answers from training data
2. **Overthinks** and tries to use `web_fetch` to scrape websites instead of sharing search results

### Root Cause

LLM is trying to be "helpful" by fetching actual content, when we just want it to share the search results directly.

### Solution Implemented

#### 1. Strengthened System Prompt Instructions

**File:** `packages/cli/src/features/context/utils/systemPromptBuilder.ts`

**For Reasoning Models:**

```
IMPORTANT - Web Search Behavior:
- When you use web_search, it returns URLs and titles - SHARE THOSE DIRECTLY with the user
- DO NOT try to fetch or scrape the URLs unless the user explicitly asks you to read a specific page
- DO NOT make up information - if web_search returns no results, say "I couldn't find information about that"
- The search results ARE the answer - don't overthink it
```

**For Non-Reasoning Models:**
Same instructions added to prevent overthinking.

#### 2. Updated Tool Descriptions

**web_search tool:**

- Description emphasizes it's the PRIMARY tool for finding information
- Output format includes: "✓ These are real search results. Share the URLs and titles above with the user."

**web_fetch tool:**

- Description explicitly states: "DO NOT use this after web_search - the search results already contain the information you need"
- Only use when: 1) User explicitly asks to read a webpage, OR 2) Need detailed content from a URL

#### 3. Search Result Formatting

**File:** `packages/core/src/tools/web-search.ts`

Output format:

```
Search Results (from DuckDuckGo):

1. Title
   URL: https://example.com
   Snippet text

✓ These are real search results. Share the URLs and titles above with the user.
```

---

## Testing

### Manual Test

1. Start the application: `npm run start`
2. Ask: "What is the NVIDIA stock price today?"
3. **Expected:** LLM calls `web_search`, receives results, shares URLs and titles
4. **Not Expected:** LLM tries to use `web_fetch` or makes up information

### Automated Test

```bash
node scripts/test-duckduckgo.mjs
```

Should return 5 real search results.

---

## Files Modified

### Core Implementation

- `packages/core/src/tools/providers/duckduckgo-search.ts` - DuckDuckGo provider
- `packages/core/src/tools/web-search.ts` - Tool registration and formatting
- `packages/core/src/tools/web-fetch.ts` - Updated description to prevent misuse
- `packages/core/src/tools/index.ts` - Register DuckDuckGo provider

### System Prompt

- `packages/cli/src/features/context/utils/systemPromptBuilder.ts` - Anti-hallucination instructions

### Fallback Fix

- `packages/cli/src/features/context/ChatContext.tsx` - When modeManager not initialized, use all tools instead of no tools

---

## Next Steps

1. **Test with actual LLM** to verify behavior improvements
2. **Monitor LLM responses** - does it share search results or still overthink?
3. **Consider alternative models** if current model doesn't follow instructions
4. **Investigate Brave Search MCP** - try restart/re-enable to get tools working

---

## Alternative Approaches (If Still Not Working)

### Option 1: Add Example to System Prompt

Show the LLM an example of correct behavior:

```
Example:
User: "What is the weather in Paris?"
Assistant: [calls web_search]
Tool Result: [URLs and titles about Paris weather]
Assistant: "Here's what I found: [shares URLs and titles]"
```

### Option 2: Try Different Model

Some models follow tool instructions better than others. Consider testing with:

- Models specifically trained for tool use
- Models with better instruction following

### Option 3: Post-Process Tool Results

Intercept tool results and format them in a way that makes it harder for LLM to ignore.

---

**Created:** January 28, 2026  
**Last Updated:** January 28, 2026
