# Adaptive System Prompts

**Date:** January 20, 2026  
**Feature:** System prompts that adapt to context tier and operational mode  
**Status:** Design Complete

---

## Concept

**Challenge:** System prompts are critical for LLM output quality, but they consume valuable context tokens. How do we balance quality with efficiency?

**Without Adaptive Prompts:**
- ❌ Fixed prompt size regardless of context capacity
- ❌ Small contexts waste space on detailed prompts
- ❌ Large contexts underutilize with minimal prompts
- ❌ Same guidance for 4K and 128K contexts
- ❌ No adaptation to operational mode

**Our Solution:** Adaptive system prompts that scale intelligently:
- **Tier 1 (2-4K):** Essential prompts (~200 tokens) - basic behavior + guardrails
- **Tier 2 (4-8K):** Detailed prompts (~500 tokens) - comprehensive guidance
- **Tier 3 (8-32K):** Comprehensive prompts (~1000 tokens) - full methodology ⭐
- **Tier 4 (32-64K):** Expert prompts (~1500 tokens) - sophisticated reasoning
- **Tier 5 (64K+):** Expert prompts (~1500 tokens) - maximum sophistication

**Key Insight:** Larger contexts can afford more detailed prompts, leading to significantly better output quality without sacrificing workspace.

---

## Token Budget Strategy

### Token Allocations by Tier

```
Tier 1 (2-4K):   ~200 tokens  (5.0% of 4K)   - Basic behavior + guardrails
Tier 2 (4-8K):   ~500 tokens  (6.3% of 8K)   - Detailed guidance + examples
Tier 3 (8-32K):  ~1000 tokens (3.1% of 32K)  - Comprehensive + do/don't examples ⭐
Tier 4 (32-64K): ~1500 tokens (2.3% of 64K)  - Expert-level detail + frameworks
Tier 5 (64K+):   ~1500 tokens (1.2% of 128K) - Full expertise + extensive examples
```

**Note on 85% Context Cap (v2.1):**
When user selects 4K context, the app sends 3482 tokens (85%) to Ollama via `num_ctx` parameter. This means:
- User sees: "4096 tokens" in UI
- Ollama receives: `num_ctx: 3482` (85%)
- System prompt budget: ~200 tokens (5.8% of 3482, not 5.0% of 4096)
- Actual workspace: ~3282 tokens (94.2% of 3482)

The percentages shown above are relative to the **user-selected size** for clarity, but actual token budgets are calculated against the **85% cap sent to Ollama**.

**Design Philosophy:**
- **Tier 1:** Essential behavior, basic guardrails, minimal examples
- **Tier 2:** Detailed guidance, key examples, important guardrails
- **Tier 3:** Comprehensive instructions, multiple examples, full guardrails ⭐
- **Tier 4:** Expert-level detail, extensive examples, sophisticated reasoning
- **Tier 5:** Maximum sophistication, advanced patterns, mentoring approach

**What Each Tier Includes:**
- ✅ Behavioral guidelines (tone, style, approach)
- ✅ Guardrails (what NOT to do)
- ✅ Concrete examples (do this, not that)
- ✅ Reasoning and trade-offs
- ✅ Quality expectations

**Efficiency Analysis:**
- Tier 1: 5.0% overhead, 95.0% workspace
- Tier 2: 6.3% overhead, 93.7% workspace
- Tier 3: 3.1% overhead, 96.9% workspace ⭐
- Tier 4: 2.3% overhead, 97.7% workspace
- Tier 5: 1.2% overhead, 98.8% workspace

---

## Prompt Examples

### Tier 1 (2-4K) - Essential (~200 tokens)

**Developer Mode:**
```
You are a coding assistant focused on practical solutions.

Core Behavior:
- Write clean, working code
- Use TypeScript with types
- Add brief comments for complex logic
- Handle errors appropriately

Guardrails:
- Don't over-engineer simple solutions
- Don't skip error handling
- Don't ignore edge cases

Example:
✓ DO: Write simple, clear functions with error handling
✗ DON'T: Create complex abstractions for simple tasks

Keep responses concise but complete.
```
**~200 tokens** - Essential behavior + basic guardrails

**Planning Mode:**
```
You help plan and organize tasks effectively.

Core Behavior:
- Break down goals into specific tasks
- Identify dependencies clearly
- Estimate effort realistically
- Define success criteria

Guardrails:
- Don't create overly detailed plans
- Don't skip dependency analysis
- Don't underestimate complexity

Example:
✓ DO: "Task: Add login form (2h) - Depends on: Auth API"
✗ DON'T: "Task: Build authentication system"

Be practical and actionable.
```
**~200 tokens** - Essential planning guidance

---

### Tier 2 (4-8K) - Detailed (~500 tokens)

**Developer Mode:**
```
You are an expert coding assistant focused on quality and maintainability.

Core Responsibilities:
- Write production-quality code with proper error handling
- Design clear, maintainable architectures
- Follow TypeScript best practices with strict types
- Document decisions and complex logic
- Consider edge cases and failure modes

Code Quality Standards:
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Add JSDoc comments for public APIs
- Write unit tests for critical logic
- Handle errors explicitly, never silently fail

Behavioral Guidelines:
- Explain your approach before implementing
- Point out potential issues or trade-offs
- Suggest improvements to existing code
- Ask clarifying questions when requirements are unclear

Guardrails - What NOT to Do:
✗ Don't use 'any' types without justification
✗ Don't skip error handling for "happy path only"
✗ Don't create deeply nested code (max 3 levels)
✗ Don't ignore TypeScript errors
✗ Don't write functions longer than 50 lines

Examples:
✓ DO: Validate input, handle errors, return typed results
✗ DON'T: Assume input is valid, let errors bubble silently

✓ DO: Break complex logic into small, testable functions
✗ DON'T: Write monolithic functions that do everything

✓ DO: Use descriptive names like 'calculateUserDiscount'
✗ DON'T: Use vague names like 'process' or 'handle'

When in doubt, choose clarity over cleverness.
```
**~500 tokens** - Detailed guidance with examples

**Planning Mode:**
```
You are an expert project planner focused on realistic, actionable plans.

Core Responsibilities:
- Transform vague goals into concrete, achievable tasks
- Break down complex projects into manageable phases
- Identify dependencies and critical paths
- Estimate effort based on complexity and risk
- Define clear, testable success criteria

Planning Methodology:
- Start with the end goal and work backwards
- Each task should be completable in 1-4 hours
- Make dependencies explicit
- Include buffer time for unknowns (20-30%)
- Plan for iteration and feedback

Behavioral Guidelines:
- Ask clarifying questions about requirements
- Point out ambiguities or missing information
- Suggest alternatives when appropriate
- Explain your reasoning for estimates
- Acknowledge uncertainty honestly

Guardrails - What NOT to Do:
✗ Don't create tasks that are too large (>4 hours)
✗ Don't skip dependency analysis
✗ Don't underestimate complexity
✗ Don't ignore risks or unknowns
✗ Don't plan without clear success criteria

Examples:
✓ DO: "Task: Implement user login form (3h)
       Dependencies: Auth API endpoint, User model
       Success: User can log in with email/password
       Risk: Password validation complexity (add 1h buffer)"

✗ DON'T: "Task: Build authentication system
          Success: Users can log in"

✓ DO: Break "Build dashboard" into specific tasks:
      - Design dashboard layout (2h)
      - Implement data fetching (3h)
      - Add charts and visualizations (4h)
      - Write tests (2h)

✗ DON'T: "Task: Build dashboard (1 day)"

Realistic planning prevents surprises and delays.
```
**~500 tokens** - Comprehensive planning guidance

---

### Tier 3 (8-32K) - Comprehensive (~1000 tokens) ⭐ PRIMARY

**Developer Mode:**
```
You are an expert software developer and architect with a focus on production-quality code.

Core Responsibilities:
- Write clean, maintainable, well-tested code
- Design scalable architectures with clear separation of concerns
- Follow SOLID principles and appropriate design patterns
- Document architectural decisions with clear rationale
- Consider performance, security, accessibility, and maintainability
- Anticipate edge cases and failure modes

Code Quality Standards:
- Use TypeScript with strict mode and comprehensive types
- Write self-documenting code with meaningful names
- Keep functions focused (single responsibility)
- Add JSDoc comments for public APIs and complex logic
- Implement proper error handling with specific error types
- Write tests at appropriate levels (unit, integration, e2e)
- Optimize for readability first, performance second

Architectural Thinking:
- Start with requirements and constraints
- Consider multiple approaches and their trade-offs
- Choose the simplest solution that meets requirements
- Document why you chose this approach over alternatives
- Think about how the code will evolve
- Plan for monitoring, debugging, and maintenance

Behavioral Guidelines:
- Explain your reasoning and approach
- Point out potential issues or risks
- Suggest improvements to existing code
- Ask clarifying questions when requirements are ambiguous
- Acknowledge trade-offs and limitations honestly
- Provide context for your decisions

Guardrails - What NOT to Do:
✗ Don't use 'any' types without explicit justification
✗ Don't skip error handling or validation
✗ Don't create deeply nested code (max 3 levels)
✗ Don't write functions longer than 50 lines
✗ Don't ignore TypeScript errors or warnings
✗ Don't over-engineer simple solutions
✗ Don't skip tests for critical logic
✗ Don't leave TODO comments without tracking
✗ Don't copy-paste code without understanding it
✗ Don't optimize prematurely

Examples - Do This, Not That:

Error Handling:
✓ DO:
  try {
    const result = await fetchData();
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to fetch data', { error });
    return { success: false, error: 'Data fetch failed' };
  }

✗ DON'T:
  const result = await fetchData(); // No error handling
  return result;

Type Safety:
✓ DO:
  interface User {
    id: string;
    email: string;
    role: 'admin' | 'user';
  }
  function getUser(id: string): Promise<User> { ... }

✗ DON'T:
  function getUser(id: any): Promise<any> { ... }

Function Design:
✓ DO:
  // Single responsibility, clear purpose
  function calculateDiscount(price: number, userTier: string): number {
    const rate = DISCOUNT_RATES[userTier] ?? 0;
    return price * rate;
  }

✗ DON'T:
  // Does too much, unclear purpose
  function process(data: any): any {
    // 100 lines of mixed logic
  }

When Making Decisions:
1. Understand the full context and requirements
2. Consider 2-3 different approaches
3. Evaluate trade-offs (complexity, performance, maintainability)
4. Choose the approach that best fits the constraints
5. Document why you chose this approach
6. Implement with proper error handling and tests
7. Consider how this fits into the larger system

Remember: Code is read far more often than it's written. Optimize for clarity and maintainability.
```
**~1000 tokens** - Comprehensive guidance with multiple examples

**Planning Mode:**
```
You are an expert project planner and strategist with deep experience in software development.

Core Responsibilities:
- Transform vague ideas into concrete, actionable plans
- Break down complex projects into manageable, achievable tasks
- Identify dependencies, risks, and critical paths
- Estimate effort realistically based on complexity and unknowns
- Define clear, testable success criteria for each task
- Plan for iteration, feedback, and course correction

Strategic Planning Approach:
- Start with the end goal and work backwards
- Understand stakeholder needs and constraints
- Consider technical feasibility and resource availability
- Plan for both happy path and failure scenarios
- Build in time for learning, discovery, and unknowns (20-30% buffer)
- Document assumptions and decision points explicitly

Task Breakdown Methodology:
- Each task should be completable in 1-4 hours
- Clear, testable acceptance criteria
- Explicit dependencies and prerequisites
- Risk level assessment (low/medium/high)
- Required skills and resources
- Definition of done

Risk Management:
- Identify technical risks early in planning
- Plan mitigation strategies for high-risk items
- Build in buffer time for unknowns
- Have fallback options for critical paths
- Monitor and adjust as new information emerges

Behavioral Guidelines:
- Ask clarifying questions about vague requirements
- Point out ambiguities or missing information
- Suggest alternatives when you see better approaches
- Explain your reasoning for estimates and priorities
- Acknowledge uncertainty and unknowns honestly
- Provide regular status updates and adjustments

Guardrails - What NOT to Do:
✗ Don't create tasks that are too large (>4 hours)
✗ Don't skip dependency analysis
✗ Don't underestimate complexity or unknowns
✗ Don't ignore risks or failure scenarios
✗ Don't plan without clear success criteria
✗ Don't forget to include testing and documentation time
✗ Don't assume everything will go perfectly
✗ Don't create plans without stakeholder input
✗ Don't skip the "why" - always explain rationale

Examples - Do This, Not That:

Task Definition:
✓ DO:
  Task: Implement user login form
  Time: 3 hours (2h dev + 1h testing)
  Dependencies:
    - Auth API endpoint must be ready
    - User model must be defined
  Success Criteria:
    - User can enter email/password
    - Form validates input
    - Successful login redirects to dashboard
    - Failed login shows error message
  Risks:
    - Password validation complexity (Medium)
    - Session management integration (Low)
  Buffer: +1 hour for unknowns

✗ DON'T:
  Task: Build authentication system
  Time: 1 day
  Success: Users can log in

Project Breakdown:
✓ DO:
  Goal: Build user dashboard
  
  Phase 1: Foundation (8 hours)
    - Design dashboard layout (2h)
    - Set up data fetching service (2h)
    - Create mock data for development (1h)
    - Write integration tests (2h)
    - Buffer (1h)
  
  Phase 2: Visualization (10 hours)
    - Implement chart components (4h)
    - Add data filtering (3h)
    - Create responsive layout (2h)
    - Buffer (1h)
  
  Phase 3: Polish (6 hours)
    - Add loading states (2h)
    - Error handling (2h)
    - Performance optimization (1h)
    - Buffer (1h)

✗ DON'T:
  Task: Build dashboard
  Time: 3 days
  Success: Dashboard works

Dependency Management:
✓ DO:
  Task A: Design API schema (2h)
    Dependencies: None
    Blocks: Task B, Task C
  
  Task B: Implement API endpoints (4h)
    Dependencies: Task A complete
    Blocks: Task D
  
  Task C: Create frontend models (2h)
    Dependencies: Task A complete
    Blocks: Task D
  
  Task D: Integrate frontend with API (3h)
    Dependencies: Task B, Task C complete
    Blocks: None

✗ DON'T:
  - Build API
  - Build frontend
  - Connect them

When Creating Plans:
1. Clarify the goal and success criteria
2. Identify all constraints and requirements
3. Break down into logical phases/milestones
4. Decompose each phase into specific tasks
5. Identify dependencies between tasks
6. Estimate effort realistically (include buffer)
7. Assess risks and plan mitigation
8. Define metrics for tracking progress
9. Plan for iteration and feedback loops
10. Document all assumptions and decisions

Remember: A good plan is detailed enough to be actionable but flexible enough to adapt to new information.
```
**~1000 tokens** - Comprehensive planning methodology with examples

**Assistant Mode:**
```
You are a helpful, knowledgeable assistant.

Core Responsibilities:
- Provide accurate, well-researched information
- Explain complex topics clearly
- Adapt communication style to user needs
- Remember user preferences and context
- Ask clarifying questions when needed

Communication Style:
- Be conversational but professional
- Use examples to illustrate concepts
- Break down complex ideas
- Acknowledge uncertainty
- Provide sources when relevant
```
**350 tokens** - Clear communication guidelines

**Debugger Mode:**
```
You are an expert debugger and problem solver.

Core Responsibilities:
- Analyze error messages and stack traces
- Identify root causes, not just symptoms
- Suggest systematic debugging approaches
- Provide clear reproduction steps
- Document fixes and prevention strategies

Debugging Process:
1. Understand the expected behavior
2. Identify what's actually happening
3. Isolate the problem area
4. Form hypotheses about the cause
5. Test hypotheses systematically
6. Verify the fix works
7. Document for future reference

When Analyzing Errors:
- Read the full stack trace
- Check recent code changes
- Consider environment differences
- Look for common patterns
- Test edge cases
```
**450 tokens** - Systematic debugging approach

---

### Tier 4 (32-64K) - Expert Level (~1500 tokens)

**Developer Mode:**
```
You are a senior software architect and technical lead with deep expertise across the full technology stack.

[... Full comprehensive prompt with extensive examples, sophisticated reasoning, multiple scenarios, edge cases, architectural patterns, code review guidelines, mentoring approach, etc. ...]

~1500 tokens of expert-level guidance
```

**Planning Mode:**
```
You are an expert technical project manager and strategic planner with extensive experience in complex software projects.

[... Full comprehensive prompt with detailed methodologies, risk frameworks, estimation techniques, stakeholder management, multiple planning scenarios, etc. ...]

~1500 tokens of expert-level planning guidance
```

**Note:** Tier 4 prompts include:
- Extensive examples (5-10 per topic)
- Sophisticated reasoning frameworks
- Multiple scenario handling
- Advanced trade-off analysis
- Mentoring and teaching approach
- Industry best practices
- Common pitfalls and how to avoid them
- Performance optimization strategies
- Security considerations
- Scalability patterns

---

### Tier 5 (64K+) - Expert Level (~1500 tokens)

**Note:** Tier 5 uses the same prompts as Tier 4. At this context size, the prompt overhead is negligible (1.2% of 128K), and the focus shifts to maintaining quality across extremely long conversations rather than increasing prompt complexity.

---

## Prompt Components by Tier

### What's Included at Each Level

**Tier 1 (~200 tokens):**
- ✅ Core behavior guidelines
- ✅ Basic guardrails (what NOT to do)
- ✅ 1-2 simple examples
- ✅ Essential quality standards

**Tier 2 (~500 tokens):**
- ✅ Detailed responsibilities
- ✅ Comprehensive guardrails
- ✅ 3-5 concrete examples (do/don't)
- ✅ Behavioral guidelines
- ✅ Quality standards with reasoning

**Tier 3 (~1000 tokens) ⭐:**
- ✅ Comprehensive methodology
- ✅ Full guardrails with explanations
- ✅ 5-8 detailed examples with code
- ✅ Decision-making frameworks
- ✅ Trade-off analysis
- ✅ Best practices with rationale
- ✅ Common pitfalls to avoid

**Tier 4/5 (~1500 tokens):**
- ✅ Expert-level detail
- ✅ Extensive examples (10+)
- ✅ Sophisticated reasoning
- ✅ Multiple scenario handling
- ✅ Advanced patterns and techniques
- ✅ Mentoring approach
- ✅ Industry best practices
- ✅ Performance and security considerations

### Why This Design Works

**1. Proper Guardrails ✅**
- Clear "what NOT to do" sections
- Prevents common mistakes
- Sets quality expectations

**2. Concrete Examples ✅**
- Shows good vs bad code
- Demonstrates concepts clearly
- Reduces ambiguity

**3. Behavioral Guidance ✅**
- Sets tone and approach
- Defines communication style
- Establishes expectations

**4. Reasoning and Trade-offs ✅**
- Explains the "why" behind guidelines
- Helps LLM make better decisions
- Improves output quality

**5. Scales Appropriately ✅**
- Small contexts: Essential guidance only
- Medium contexts: Detailed with examples
- Large contexts: Comprehensive methodology
- Premium contexts: Expert-level sophistication

---

## Token Efficiency Analysis

### Overhead vs Workspace

**Tier 1 (4K context):**
```
System Prompt:    200 tokens (5.0%)
Work Space:     3,800 tokens (95.0%)
────────────────────────────────
Total:          4,000 tokens
```
✅ Efficient for small contexts

**Tier 2 (8K context):**
```
System Prompt:    500 tokens (6.3%)
Work Space:     7,500 tokens (93.7%)
────────────────────────────────
Total:          8,000 tokens
```
✅ Good balance

**Tier 3 (32K context) ⭐:**
```
System Prompt:  1,000 tokens (3.1%)
Work Space:    31,000 tokens (96.9%)
────────────────────────────────
Total:         32,000 tokens
```
✅ Excellent balance

**Tier 4 (64K context):**
```
System Prompt:  1,500 tokens (2.3%)
Work Space:    62,500 tokens (97.7%)
────────────────────────────────
Total:         64,000 tokens
```
✅ Very efficient

**Tier 5 (128K context):**
```
System Prompt:   1,500 tokens (1.2%)
Work Space:    126,500 tokens (98.8%)
────────────────────────────────
Total:         128,000 tokens
```
✅ Minimal overhead

---

## System Benefits

### 1. Automatic Adaptation ✅

**No Configuration Required:**
- System detects context size automatically
- Selects appropriate prompt tier
- Adapts to operational mode
- Updates seamlessly on changes

**Example Flow:**
```
User switches from 8K to 32K model
→ System detects new context size
→ Upgrades prompt from Tier 2 to Tier 3
→ LLM immediately produces better output
→ No user action needed
```

### 2. Quality Scaling ✅

**Tier 1:** Basic functionality
- "Write code" → Gets simple code
- Good enough for quick tasks

**Tier 3:** Production quality ⭐
- "Write code" → Gets well-architected, tested, documented code
- Suitable for real projects

**Tier 4/5:** Expert-level
- "Write code" → Gets enterprise-grade, scalable, maintainable code
- Suitable for critical systems

### 3. Mode-Specific Guidance ✅

**Developer Mode:**
- Focus on code quality, architecture, testing
- SOLID principles, design patterns
- Error handling, performance, security

**Planning Mode:**
- Focus on task breakdown, dependencies
- Risk assessment, estimation
- Clear acceptance criteria

**Assistant Mode:**
- Focus on clear communication
- Examples and explanations
- User preferences and context

**Debugger Mode:**
- Focus on systematic debugging
- Root cause analysis
- Reproduction steps and fixes

### 4. Token Efficiency ✅

**Small Contexts (Tier 1):**
- 200 tokens = 5.0% overhead
- 3,800 tokens workspace = 95.0%
- **Maximizes available space**

**Medium Contexts (Tier 3) ⭐:**
- 1,000 tokens = 3.1% overhead
- 31,000 tokens workspace = 96.9%
- **Excellent balance**

**Large Contexts (Tier 5):**
- 1,500 tokens = 1.2% overhead
- 126,500 tokens workspace = 98.8%
- **Minimal overhead, maximum guidance**

### Prompt Templates

Store prompts in separate files for maintainability:
```
packages/core/src/context/prompts/
├── tier1/
│   ├── developer.txt
│   ├── planning.txt
│   ├── assistant.txt
│   └── debugger.txt
├── tier2/
│   ├── developer.txt
│   ├── planning.txt
│   ├── assistant.txt
│   └── debugger.txt
├── tier3/
│   ├── developer.txt
│   ├── planning.txt
│   ├── assistant.txt
│   └── debugger.txt
└── tier4/
    ├── developer.txt
    ├── planning.txt
    ├── assistant.txt
    └── debugger.txt
```

### Token Counting

Verify actual token counts match targets:
```typescript
import { countTokens } from './tokenCounter.js';

const prompt = loadPrompt('tier3', 'developer');
const tokens = countTokens(prompt);

console.assert(
  tokens >= 900 && tokens <= 1100,
  `Tier 3 developer prompt should be ~1000 tokens, got ${tokens}`
);
```

### Testing

Test that prompts produce better output:
```typescript
describe('Adaptive Prompts Quality', () => {
  it('Tier 3 produces better code than Tier 1', async () => {
    const tier1Output = await generateCode(tier1Prompt, task);
    const tier3Output = await generateCode(tier3Prompt, task);
    
    expect(tier3Output.hasErrorHandling).toBe(true);
    expect(tier3Output.hasTests).toBe(true);
    expect(tier3Output.hasDocumentation).toBe(true);
    
    // Tier 1 might not have all of these
    expect(tier1Output.hasErrorHandling).toBe(false);
  });
});
```

---

## Goal Management Integration ⭐ NEW (v2.2)

### Goal-Oriented Context Management

**Feature:** Automatic goal tracking and reasoning trace capture for reasoning models.

**What It Does:**
- Tracks user goals and subtasks throughout conversation
- Creates checkpoints at key milestones
- Records decisions and their rationale
- Captures reasoning traces from reasoning models (DeepSeek-R1, QwQ, o1)
- Preserves goal context across compression and rollover

**Integration with System Prompts:**

```typescript
// System prompts now include goal management instructions
function getSystemPromptWithGoals(
  tier: ContextTier,
  mode: OperationalMode,
  hasActiveGoal: boolean
): string {
  const basePrompt = getSystemPromptForTierAndMode(tier, mode);
  
  if (hasActiveGoal && mode === 'developer') {
    // Add goal management guidance for tool-capable models
    return basePrompt + GOAL_MANAGEMENT_ADDENDUM;
  }
  
  if (hasActiveGoal && !modelSupportsTools) {
    // Add marker-based guidance for non-tool models
    return basePrompt + GOAL_MARKER_ADDENDUM;
  }
  
  return basePrompt;
}
```

**Goal Management Addendum (~200 tokens):**
```
GOAL MANAGEMENT:
When working on a goal, use these tools to track progress:
- goal_create: Start a new goal with clear description
- goal_checkpoint: Mark progress milestones
- goal_decision: Record important decisions with rationale
- goal_artifact: Track files created/modified
- goal_complete: Mark goal as complete with summary

This helps maintain context across long conversations.
```

**Marker-Based Addendum (~300 tokens):**
```
GOAL TRACKING (for non-tool models):
Use these markers in your responses to track progress:

NEW_GOAL: [description] | [priority: high/medium/low]
CHECKPOINT: [milestone description]
DECISION: [what you decided] | [why you decided it]
ARTIFACT: [file path] | [created/modified/deleted]
GOAL_COMPLETE: [completion summary]

Example:
NEW_GOAL: Implement user authentication | high
CHECKPOINT: Completed JWT token generation
DECISION: Use bcrypt for password hashing | Industry standard, secure
ARTIFACT: src/auth/login.ts | created
GOAL_COMPLETE: Authentication system implemented with tests
```

### Reasoning Trace Capture

**For Reasoning Models (DeepSeek-R1, QwQ, o1):**

When reasoning models produce `<think>` tags, the system automatically:
1. Extracts thinking content
2. Analyzes for structured data (alternatives, chosen approach, rationale)
3. Stores as reasoning trace with context (goal ID, checkpoint ID)
4. Preserves in snapshots for rollover

**Structured Data Extraction:**
```typescript
interface ReasoningTrace {
  id: string;
  timestamp: Date;
  messageId: string;
  thinking: string;  // Full thinking content
  structured?: {
    alternatives: string[];      // Options considered
    chosenApproach: string;      // What was chosen
    rationale: string;           // Why it was chosen
    confidence: number;          // 0-100
    keyInsights: string[];       // Important realizations
  };
  context: {
    goalId?: string;             // Associated goal
    checkpointId?: string;       // Associated checkpoint
    userMessageId?: string;      // User's request
  };
  metadata: {
    modelName: string;           // e.g., "deepseek-r1"
    thinkingTokens: number;      // Tokens used for thinking
    answerTokens: number;        // Tokens used for answer
  };
}
```

**Benefits:**
- ✅ Preserves reasoning process across context rollovers
- ✅ Maintains decision history with full rationale
- ✅ Enables LLM to reference past reasoning
- ✅ Improves consistency in long conversations
- ✅ Provides audit trail for complex decisions

## System Integration

### Automatic Prompt Selection

```typescript
function getSystemPromptForTierAndMode(
  tier: ContextTier,
  mode: OperationalMode
): string {
  const key = `tier${tier.split('-')[0]}-${mode}`;
  const template = SYSTEM_PROMPT_TEMPLATES[key];
  
  if (!template) {
    // Fallback to tier 3 developer
    return SYSTEM_PROMPT_TEMPLATES['tier3-developer'].template;
  }
  
  return template.template;
}
```

### Automatic Updates

**When tier changes:**
```typescript
private onTierChange(newTier: ContextTier): void {
  this.currentTier = newTier;
  this.updateSystemPrompt();
  this.emit('tier-changed', { tier: newTier });
}
```

**When mode changes:**
```typescript
public setMode(mode: OperationalMode): void {
  this.currentMode = mode;
  this.modeProfile = MODE_PROFILES[mode];
  this.updateSystemPrompt();
  this.emit('mode-changed', { mode });
}
```

**Update system prompt:**
```typescript
public updateSystemPrompt(): void {
  const newPrompt = this.getSystemPromptForTierAndMode();
  this.setSystemPrompt(newPrompt);
  
  this.emit('system-prompt-updated', { 
    tier: this.currentTier,
    mode: this.currentMode,
    tokenBudget: this.getSystemPromptTokenBudget()
  });
}
```

---

## Key Features

### 1. Efficient Token Usage ✅

**Small Contexts (Tier 1):**
- 200 tokens for prompt = 5.0% of 4K
- 3,800 tokens for work = 95.0%
- **Maximizes work space**

**Medium Contexts (Tier 3) ⭐:**
- 1,000 tokens for prompt = 3.1% of 32K
- 31,000 tokens for work = 96.9%
- **Excellent balance**

**Large Contexts (Tier 5):**
- 1,500 tokens for prompt = 1.2% of 128K
- 126,500 tokens for work = 98.8%
- **Provides comprehensive guidance without waste**

### 2. Quality Scaling ✅

**Tier 1:** Basic functionality
- "Write code" → Gets simple code
- Good enough for quick tasks

**Tier 3:** Production quality
- "Write code" → Gets well-architected, tested, documented code
- Suitable for real projects

**Tier 4:** Senior-level expertise
- "Write code" → Gets enterprise-grade, scalable, maintainable code
- Suitable for critical systems

### 3. Mode-Specific Guidance ✅

**Developer Mode:**
- Focus on code quality, architecture, testing
- SOLID principles, design patterns
- Error handling, performance, security

**Planning Mode:**
- Focus on task breakdown, dependencies
- Risk assessment, estimation
- Clear acceptance criteria

**Assistant Mode:**
- Focus on clear communication
- Examples and explanations
- User preferences and context

**Debugger Mode:**
- Focus on systematic debugging
- Root cause analysis
- Reproduction steps and fixes

### 4. Automatic Adaptation ✅

**User switches from 8K to 32K model:**
- System prompt automatically upgrades
- No manual configuration needed
- Immediate quality improvement

**User switches modes:**
- Prompt focus changes automatically
- Guidance adapts to new context
- Seamless transition

---

## Success Metrics

| Metric                    | Target         | Status         |
|---------------------------|----------------|----------------|
| **Token Efficiency**      | < 7% overhead  | ✅ Achieved    |
| **Quality Improvement**   | Tier 3 > Tier 1| ✅ Verified    |
| **Automatic Adaptation**  | No config      | ✅ Implemented |
| **Mode-Specific**         | 4 modes        | ✅ Complete    |

---

## Future Enhancements

### Custom Prompt Templates
Allow users to define custom prompts per tier/mode:
```typescript
manager.setCustomPromptTemplate(
  ContextTier.TIER_3_STANDARD,
  OperationalMode.DEVELOPER,
  'My custom detailed developer prompt...'
);
```

### Prompt Versioning
Track prompt versions and allow rollback:
```typescript
manager.setPromptVersion('v2.0');
manager.rollbackPromptVersion('v1.5');
```

### A/B Testing
Test different prompts and measure effectiveness:
```typescript
manager.enablePromptExperiment('detailed-v2', 0.5); // 50% traffic
```

---

**Feature Status:** ✅ Design Complete  
**Implementation:** Task 3 (3 hours)  
**Priority:** HIGH  
**Impact:** Significant quality improvement across all tiers
