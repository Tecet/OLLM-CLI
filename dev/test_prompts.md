# LLM Testing Prompts

This document provides three specialized prompts designed to test the OLLM CLI's advanced features, including context management, prompt routing/sharding, and skill (tool) usage.

## 1. Context Overload & Rollover Test

**Goal**: Force the LLM to generate massive output to trigger context compression, resizing, and eventually the emergency rollover (snapshot + clear).

### Instruction

> [!TIP]
> Use a model with a relatively small context window (e.g., 8k) to trigger these events faster.

**Prompt:**

```text
Write a extremely detailed, 5000-word academic paper on the history and evolution of prime numbers.
For every prime number from 2 to 1000, provide:
1. Its historical significance.
2. A detailed mathematical proof of its primality.
3. A unique poem (at least 4 stanzas) dedicated to that specific number.
After every 5 numbers, provide a 500-word summary of the progress so far in the style of a 18th-century explorer.
Continue until you hit the context limit. do not stop until I tell you to.
```

---

## 2. Prompt Router & Sharding Test

**Goal**: Force the LLM to switch "modes" or internal system instructions to test if a prompt router or sharding mechanism (detecting intent and swapping system prompts) is working.

**Prompt:**

```text
I am now starting a multi-phase project.

Phase 1: Act as a "Senior Security Auditor". Perform a deep security audit of an imaginary bank's API. Use highly technical jargon and focus on OIDC flows and JWT vulnerabilities.

Phase 2: (When I say "SWITCH TO RESEARCH") Immediately stop the audit and switch your entire personality to a "Quantum Physics Professor". Forget the security audit and explain Bell's Theorem using only metaphors related to baking.

Phase 3: (When I say "SHARD CONTEXT") Split your reasoning into two "shards". Shard A will continue the Quantum Physics explanation, while Shard B will plan a vacation to Mars. Provide one paragraph from each shard in every response.

[Start with Phase 1 now]
```

---

## 3. Different Skills (Tools) Usage Test

**Goal**: Force the LLM to use multiple different internal skills/tools (Search, Fetch, File Operations, Shell) in a single workflow.

**Prompt:**

```text
Execute the following multi-skill workflow:

1. Search the web for the latest stock price and 24h change of NVIDIA (NVDA).
2. Fetch the content of the top news article related to NVIDIA's latest earnings report.
3. Summarize the key findings from that article.
4. Use a shell command to check the current system load (cpu/memory).
5. Create a local file named `nvda_report.md` containing the stock info, the article summary, and the system load statistics.
6. Read the newly created file back to me to verify it was saved correctly.
```
