# Dynamic Prompt System - Enhancements

**Status:** 📋 Planned Enhancements  
**Priority:** 🟡 Medium (Post-MVP)  
**Estimated Effort:** 20-30 additional hours

---

## Overview

This document outlines enhancements to the Dynamic Prompt System beyond the core MVP. These features improve usability, discoverability, and prepare the system for future RAG integration.

---

## Enhancement 1: Additional Modes

### Mode 9: Prototype Mode ⚡🔬

**Persona:** "Rapid Prototyper"  
**Icon:** ⚡🔬  
**Color:** Bright Cyan  
**Purpose:** Quick experiments, proof-of-concepts, throwaway code

**Allowed Tools:** All tools (like developer mode)

**Trigger Keywords:** prototype, experiment, quick test, proof of concept, spike, try out, throwaway

**Prompt Template:**
```markdown
You are a rapid prototyper. Your goal is to build working proof-of-concepts
as quickly as possible.

# Prototype Mode Principles
- Speed over perfection
- Working code over clean code
- Experiment freely
- Skip tests and documentation (for now)
- Use simple, direct solutions
- Mark all code with "// PROTOTYPE" comments
- Focus on validating ideas

# When to Use Prototype Mode
- Testing a new library or API
- Validating an architectural approach
- Creating a quick demo
- Exploring solution space
- Spike work before planning

# Restrictions Lifted
- No need for tests
- No need for documentation
- No need for error handling (unless critical)
- No need to follow existing patterns
- Can use hardcoded values
- Can skip edge cases

# Important
When the prototype is successful, suggest:
"This prototype works! Ready to switch to Planning mode to design
a production-ready version? Or Developer mode to refactor this code?"

Always mark prototype code clearly so it's not mistaken for production code.
```

---

### Mode 10: Teacher Mode 👨‍🏫

**Persona:** "Patient Technical Educator"  
**Icon:** 👨‍🏫  
**Color:** Warm Yellow  
**Purpose:** Explain concepts, teach best practices, answer "why" questions

**Allowed Tools:** 
- ✅ web_search (research topics)
- ✅ read_file (show examples from codebase)
- ✅ grep_search (find patterns to explain)
- ❌ No write operations (pure education)

**Trigger Keywords:** explain, teach me, how does, why, understand, learn, what is, tutorial

**Prompt Template:**
```markdown
You are a patient technical educator. Your role is to help users understand
concepts deeply, not just implement solutions.

# Teaching Principles
- Break down complex topics into simple explanations
- Use analogies and real-world examples
- Check for understanding with questions
- Build from fundamentals to advanced
- Encourage curiosity and exploration
- Never assume prior knowledge

# Teaching Approach
1. Assess current understanding
2. Explain the concept clearly
3. Provide concrete examples
4. Show how it works in their codebase
5. Explain common pitfalls
6. Suggest related topics to explore
7. Check comprehension

# Teaching Techniques
- Use analogies: "Think of it like..."
- Show examples: "Here's how it works..."
- Explain why: "This is important because..."
- Compare approaches: "X vs Y..."
- Visual descriptions: "Imagine a..."
- Step-by-step breakdowns

# Topics to Cover
- Programming concepts (closures, async, etc.)
- Design patterns (singleton, factory, etc.)
- Best practices (SOLID, DRY, etc.)
- Architecture (MVC, microservices, etc.)
- Tools and frameworks
- Debugging techniques
- Performance optimization

# Restrictions
- You CANNOT write code in this mode
- You CANNOT modify files
- You CAN read files to show examples
- You CAN search for patterns to explain

When the user is ready to implement, suggest:
"Now that you understand the concept, would you like to switch to
Developer mode to implement it?"
```

---

## Enhancement 2: Mode Transition Suggestions

### Implementation


```typescript
interface ModeTransitionSuggestion {
  currentMode: ModeType;
  suggestedMode: ModeType;
  reason: string;
  confidence: number;
  autoSwitch: boolean;  // If false, ask user first
}

class ModeTransitionSuggester {
  // Suggest mode transitions based on context
  suggestTransition(
    currentMode: ModeType,
    context: ConversationContext
  ): ModeTransitionSuggestion | null {
    
    // Example: In assistant mode, complex technical question
    if (currentMode === 'assistant' && context.hasTechnicalTerms) {
      return {
        currentMode: 'assistant',
        suggestedMode: 'planning',
        reason: 'This sounds like you want to plan an implementation',
        confidence: 0.75,
        autoSwitch: false  // Ask user first
      };
    }
    
    // Example: In planning mode, plan is complete
    if (currentMode === 'planning' && context.planComplete) {
      return {
        currentMode: 'planning',
        suggestedMode: 'developer',
        reason: 'The plan is complete. Ready to implement?',
        confidence: 0.85,
        autoSwitch: false
      };
    }
    
    // Example: In developer mode, multiple errors
    if (currentMode === 'developer' && context.errorCount >= 3) {
      return {
        currentMode: 'developer',
        suggestedMode: 'debugger',
        reason: 'Multiple errors detected. Systematic debugging recommended',
        confidence: 0.90,
        autoSwitch: true  // Auto-switch for errors
      };
    }
    
    return null;
  }
}
```

### UI Display

```
┌─────────────────────────────────────────┐
│ 💡 Mode Suggestion                      │
├─────────────────────────────────────────┤
│ The plan is complete. Ready to switch   │
│ to Developer mode and start             │
│ implementing?                           │
│                                         │
│ [Yes] [No] [Don't ask again]           │
└─────────────────────────────────────────┘
```

---

## Enhancement 3: Mode Workflows

### Predefined Workflows

```typescript
interface ModeWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  mode: ModeType;
  description: string;
  exitCriteria?: string;
  autoAdvance?: boolean;
}

const WORKFLOWS: Record<string, ModeWorkflow> = {
  feature_development: {
    id: 'feature_development',
    name: 'Feature Development',
    description: 'Complete workflow for building a new feature',
    steps: [
      {
        mode: 'planning',
        description: 'Research and design the feature',
        exitCriteria: 'Plan is complete and approved'
      },
      {
        mode: 'developer',
        description: 'Implement the feature',
        exitCriteria: 'Code is written and tests pass'
      },
      {
        mode: 'reviewer',
        description: 'Review code quality',
        exitCriteria: 'No critical issues found'
      },
      {
        mode: 'developer',
        description: 'Apply review feedback',
        exitCriteria: 'All feedback addressed'
      }
    ]
  },
  
  bug_fix: {
    id: 'bug_fix',
    name: 'Bug Fix',
    description: 'Systematic approach to fixing bugs',
    steps: [
      {
        mode: 'debugger',
        description: 'Find root cause of the bug',
        exitCriteria: 'Root cause identified'
      },
      {
        mode: 'developer',
        description: 'Implement the fix',
        exitCriteria: 'Fix applied and tested'
      },
      {
        mode: 'reviewer',
        description: 'Verify the fix',
        exitCriteria: 'Fix verified, no regressions'
      }
    ]
  },
  
  security_hardening: {
    id: 'security_hardening',
    name: 'Security Hardening',
    description: 'Audit and fix security issues',
    steps: [
      {
        mode: 'security',
        description: 'Audit code for vulnerabilities',
        exitCriteria: 'All vulnerabilities documented'
      },
      {
        mode: 'developer',
        description: 'Apply security fixes',
        exitCriteria: 'All fixes implemented'
      },
      {
        mode: 'security',
        description: 'Verify fixes',
        exitCriteria: 'No vulnerabilities remain'
      }
    ]
  },
  
  performance_optimization: {
    id: 'performance_optimization',
    name: 'Performance Optimization',
    description: 'Profile and optimize performance',
    steps: [
      {
        mode: 'performance',
        description: 'Profile and identify bottlenecks',
        exitCriteria: 'Bottlenecks identified and prioritized'
      },
      {
        mode: 'developer',
        description: 'Apply optimizations',
        exitCriteria: 'Optimizations implemented'
      },
      {
        mode: 'performance',
        description: 'Verify improvements',
        exitCriteria: 'Performance targets met'
      }
    ]
  },
  
  learning_session: {
    id: 'learning_session',
    name: 'Learning Session',
    description: 'Learn a concept then apply it',
    steps: [
      {
        mode: 'teacher',
        description: 'Learn the concept',
        exitCriteria: 'Concept understood'
      },
      {
        mode: 'prototype',
        description: 'Experiment with the concept',
        exitCriteria: 'Prototype working'
      },
      {
        mode: 'developer',
        description: 'Build production version',
        exitCriteria: 'Production code complete'
      }
    ]
  }
};
```

### Commands

```bash
# Start a workflow
/workflow feature_development

# List available workflows
/workflow list

# Show current workflow progress
/workflow status

# Skip to next step
/workflow next

# Exit workflow
/workflow exit
```

### UI Display

```
┌─────────────────────────────────────────┐
│ 🔗 Workflow: Feature Development        │
├─────────────────────────────────────────┤
│ Step 2 of 4: Implement the feature      │
│ Mode: 👨‍💻 Developer                      │
│                                         │
│ Progress: [████████░░] 50%             │
│                                         │
│ Next: Review code quality               │
└─────────────────────────────────────────┘
```

---

## Enhancement 4: Mode-Specific Metrics


```typescript
interface ModeMetrics {
  mode: ModeType;
  sessionCount: number;
  totalDuration: number;  // milliseconds
  
  // Mode-specific metrics
  debugger?: {
    bugsAnalyzed: number;
    rootCausesFound: number;
    fixesApplied: number;
    averageTimeToFix: number;
    errorTypes: Record<string, number>;
  };
  
  security?: {
    auditsPerformed: number;
    vulnerabilitiesFound: number;
    criticalIssues: number;
    fixesApplied: number;
    vulnerabilityTypes: Record<string, number>;
  };
  
  reviewer?: {
    reviewsPerformed: number;
    issuesFound: number;
    suggestionsGiven: number;
    averageIssuesPerReview: number;
  };
  
  performance?: {
    profilesRun: number;
    bottlenecksFound: number;
    optimizationsApplied: number;
    speedImprovements: string[];  // "50% faster", etc.
  };
  
  developer?: {
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
    toolsUsed: Record<string, number>;
  };
  
  planning?: {
    plansCreated: number;
    filesAnalyzed: number;
    researchQueriesRun: number;
  };
}

class ModeMetricsTracker {
  private metrics: Map<ModeType, ModeMetrics> = new Map();
  
  // Track mode entry
  onModeEnter(mode: ModeType): void {
    const metrics = this.getOrCreateMetrics(mode);
    metrics.sessionCount++;
  }
  
  // Track mode exit
  onModeExit(mode: ModeType, duration: number): void {
    const metrics = this.getOrCreateMetrics(mode);
    metrics.totalDuration += duration;
  }
  
  // Track mode-specific events
  trackDebuggerEvent(event: 'bug_analyzed' | 'root_cause_found' | 'fix_applied'): void {
    const metrics = this.getOrCreateMetrics('debugger');
    if (!metrics.debugger) {
      metrics.debugger = {
        bugsAnalyzed: 0,
        rootCausesFound: 0,
        fixesApplied: 0,
        averageTimeToFix: 0,
        errorTypes: {}
      };
    }
    
    switch (event) {
      case 'bug_analyzed':
        metrics.debugger.bugsAnalyzed++;
        break;
      case 'root_cause_found':
        metrics.debugger.rootCausesFound++;
        break;
      case 'fix_applied':
        metrics.debugger.fixesApplied++;
        break;
    }
  }
  
  // Get metrics for display
  getMetrics(mode: ModeType): ModeMetrics | null {
    return this.metrics.get(mode) || null;
  }
  
  // Get summary across all modes
  getSummary(): ModeSummary {
    const allMetrics = Array.from(this.metrics.values());
    return {
      totalSessions: allMetrics.reduce((sum, m) => sum + m.sessionCount, 0),
      totalDuration: allMetrics.reduce((sum, m) => sum + m.totalDuration, 0),
      mostUsedMode: this.getMostUsedMode(),
      modeBreakdown: this.getModeBreakdown()
    };
  }
}
```

### Display in UI

```
/mode status

Current Mode: 👨‍💻 Developer
Auto-Switch: Enabled
Confidence: 0.85

Session Stats:
├─ Duration: 45 minutes
├─ Files Modified: 12
├─ Lines Added: 234
├─ Lines Removed: 89
└─ Tools Used: write_file (15), read_file (23), shell (8)

Debugger Mode Stats:
├─ Bugs Analyzed: 3
├─ Root Causes Found: 3
├─ Fixes Applied: 2
└─ Avg Time to Fix: 8 minutes

Security Mode Stats:
├─ Vulnerabilities Found: 5
├─ Critical Issues: 1
└─ Fixes Applied: 5
```

---

## Enhancement 5: Mode-Specific Shortcuts

### Command Shortcuts

```bash
# Mode switching shortcuts
/assist      # Switch to assistant mode
/plan        # Switch to planning mode
/dev         # Switch to developer mode
/debug       # Switch to debugger mode
/secure      # Switch to security mode
/review      # Switch to reviewer mode
/perf        # Switch to performance mode
/proto       # Switch to prototype mode
/teach       # Switch to teacher mode

# Mode-specific actions
/debug trace         # Show stack trace analysis
/debug reproduce     # Help reproduce the bug
/debug bisect        # Binary search for bug introduction

/secure scan         # Run security scan
/secure audit        # Full security audit
/secure cve          # Check for known CVEs

/review checklist    # Show review checklist
/review diff         # Review recent changes
/review quality      # Code quality assessment

/perf profile        # Run performance profiling
/perf benchmark      # Run benchmarks
/perf analyze        # Analyze bottlenecks

/plan research       # Research best practices
/plan design         # Create design document
/plan estimate       # Estimate effort

/proto quick         # Quick prototype
/proto spike         # Spike solution
```

### Implementation

```typescript
interface ModeShortcut {
  command: string;
  mode: ModeType;
  action?: string;
  description: string;
}

const MODE_SHORTCUTS: ModeShortcut[] = [
  // Mode switching
  { command: '/assist', mode: 'assistant', description: 'Switch to assistant mode' },
  { command: '/plan', mode: 'planning', description: 'Switch to planning mode' },
  { command: '/dev', mode: 'developer', description: 'Switch to developer mode' },
  { command: '/debug', mode: 'debugger', description: 'Switch to debugger mode' },
  { command: '/secure', mode: 'security', description: 'Switch to security mode' },
  { command: '/review', mode: 'reviewer', description: 'Switch to reviewer mode' },
  { command: '/perf', mode: 'performance', description: 'Switch to performance mode' },
  { command: '/proto', mode: 'prototype', description: 'Switch to prototype mode' },
  { command: '/teach', mode: 'teacher', description: 'Switch to teacher mode' },
  
  // Debugger actions
  { command: '/debug trace', mode: 'debugger', action: 'trace', description: 'Analyze stack trace' },
  { command: '/debug reproduce', mode: 'debugger', action: 'reproduce', description: 'Help reproduce bug' },
  { command: '/debug bisect', mode: 'debugger', action: 'bisect', description: 'Find bug introduction' },
  
  // Security actions
  { command: '/secure scan', mode: 'security', action: 'scan', description: 'Quick security scan' },
  { command: '/secure audit', mode: 'security', action: 'audit', description: 'Full security audit' },
  { command: '/secure cve', mode: 'security', action: 'cve', description: 'Check for CVEs' },
  
  // Reviewer actions
  { command: '/review checklist', mode: 'reviewer', action: 'checklist', description: 'Show review checklist' },
  { command: '/review diff', mode: 'reviewer', action: 'diff', description: 'Review recent changes' },
  { command: '/review quality', mode: 'reviewer', action: 'quality', description: 'Code quality check' },
  
  // Performance actions
  { command: '/perf profile', mode: 'performance', action: 'profile', description: 'Run profiling' },
  { command: '/perf benchmark', mode: 'performance', action: 'benchmark', description: 'Run benchmarks' },
  { command: '/perf analyze', mode: 'performance', action: 'analyze', description: 'Analyze bottlenecks' },
];
```

---

## Enhancement 6: Improved Planning Mode Restrictions

### Current Restrictions (Too Strict)
- ❌ Cannot write ANY files

### Improved Restrictions (More Practical)


```typescript
interface PlanningModeFileRules {
  // Allowed file types (can write)
  allowedExtensions: string[];
  
  // Denied file types (cannot write)
  deniedExtensions: string[];
  
  // Allowed directories
  allowedDirectories: string[];
}

const PLANNING_MODE_FILE_RULES: PlanningModeFileRules = {
  // Can write documentation and design files
  allowedExtensions: [
    '.md',           // Markdown documentation
    '.txt',          // Text files
    '.mermaid',      // Mermaid diagrams
    '.plantuml',     // PlantUML diagrams
    '.drawio',       // Draw.io diagrams
    '.excalidraw',   // Excalidraw diagrams
    '.adr',          // Architecture Decision Records
    '.spec',         // Specification files
    '.design',       // Design documents
  ],
  
  // Cannot write source code or config
  deniedExtensions: [
    '.ts', '.tsx', '.js', '.jsx',  // TypeScript/JavaScript
    '.py', '.rb', '.go', '.rs',    // Other languages
    '.json', '.yaml', '.yml',      // Configuration
    '.sql', '.prisma',             // Database
    '.env', '.config',             // Environment/config
    '.sh', '.bash', '.ps1',        // Scripts
  ],
  
  // Can only write to docs directories
  allowedDirectories: [
    'docs/',
    '.docs/',
    'documentation/',
    'design/',
    'specs/',
    '.specs/',
    'adr/',
    '.adr/',
    'planning/',
  ]
};
```

### Updated Planning Mode Prompt

```markdown
You are a technical architect and planner. Your role is to help users design,
research, and plan their implementation before writing code.

# What You CAN Do
- Research best practices and technologies
- Design system architecture
- Create implementation plans
- Write documentation and design files
- Create diagrams (Mermaid, PlantUML)
- Write Architecture Decision Records (ADRs)
- Analyze existing codebase (read-only)

# What You CAN Write
- Documentation files (*.md, *.txt)
- Design diagrams (*.mermaid, *.plantuml, *.drawio)
- Architecture Decision Records (*.adr)
- Specification files (*.spec, *.design)
- Planning documents in docs/ or design/ directories

# What You CANNOT Write
- Source code (*.ts, *.js, *.py, etc.)
- Configuration files (*.json, *.yaml, *.env)
- Database schemas (*.sql, *.prisma)
- Shell scripts (*.sh, *.bash, *.ps1)

When planning is complete, suggest switching to Developer mode for implementation.
```

---

## Enhancement 7: Mode Confidence Display

### UI Implementation

```typescript
interface ModeConfidenceDisplay {
  currentMode: {
    mode: ModeType;
    icon: string;
    confidence: number;
    duration: number;  // How long in this mode
  };
  
  suggestedModes: {
    mode: ModeType;
    icon: string;
    confidence: number;
    reason: string;
  }[];
}
```

### Display in Right Panel

```
┌─────────────────────────────────────────┐
│ Current Mode                            │
├─────────────────────────────────────────┤
│ 👨‍💻 Developer                            │
│ Confidence: ████████░░ 0.85             │
│ Duration: 12 minutes                    │
│                                         │
│ Suggested Modes:                        │
│ ├─ 🐛 Debugger (0.72)                   │
│ │  "Multiple errors detected"          │
│ ├─ 📋 Planning (0.45)                   │
│ │  "Consider planning first"           │
│ └─ 🔒 Security (0.38)                   │
│    "Security review recommended"       │
└─────────────────────────────────────────┘
```

---

## Enhancement 8: Focus Mode

### Implementation

```typescript
interface FocusMode {
  enabled: boolean;
  lockedMode: ModeType;
  duration: number;  // milliseconds
  startTime: Date;
  endTime: Date;
}

class FocusModeManager {
  private focusMode: FocusMode | null = null;
  
  // Enable focus mode
  enableFocusMode(mode: ModeType, durationMinutes: number): void {
    const now = new Date();
    this.focusMode = {
      enabled: true,
      lockedMode: mode,
      duration: durationMinutes * 60 * 1000,
      startTime: now,
      endTime: new Date(now.getTime() + durationMinutes * 60 * 1000)
    };
  }
  
  // Check if mode switching is allowed
  canSwitchMode(): boolean {
    if (!this.focusMode?.enabled) return true;
    
    const now = new Date();
    if (now >= this.focusMode.endTime) {
      this.disableFocusMode();
      return true;
    }
    
    return false;
  }
  
  // Disable focus mode
  disableFocusMode(): void {
    this.focusMode = null;
  }
  
  // Get remaining time
  getRemainingTime(): number {
    if (!this.focusMode?.enabled) return 0;
    
    const now = new Date();
    return Math.max(0, this.focusMode.endTime.getTime() - now.getTime());
  }
}
```

### Commands

```bash
# Enable focus mode for 30 minutes
/mode focus developer 30

# Enable focus mode for 1 hour
/mode focus debugger 60

# Disable focus mode
/mode focus off

# Check focus mode status
/mode focus status
```

### UI Display

```
┌─────────────────────────────────────────┐
│ 🎯 Focus Mode Active                    │
├─────────────────────────────────────────┤
│ Locked to: 👨‍💻 Developer                │
│ Time Remaining: 23 minutes              │
│                                         │
│ Auto-switching disabled                 │
│ Manual switching disabled               │
│                                         │
│ [Exit Focus Mode]                       │
└─────────────────────────────────────────┘
```

---

## Enhancement 9: Hybrid Modes

### Implementation

```typescript
interface HybridMode {
  primaryMode: ModeType;
  secondaryModes: ModeType[];
  combinedPersona: string;
  combinedTools: string[];
  combinedPrompt: string;
}

class HybridModeManager {
  // Create hybrid mode
  createHybridMode(modes: ModeType[]): HybridMode {
    const [primary, ...secondary] = modes;
    
    return {
      primaryMode: primary,
      secondaryModes: secondary,
      combinedPersona: this.combinePersonas(modes),
      combinedTools: this.combineTools(modes),
      combinedPrompt: this.combinePrompts(modes)
    };
  }
  
  // Combine personas
  private combinePersonas(modes: ModeType[]): string {
    const personas = modes.map(m => MODE_TEMPLATES[m].persona);
    return personas.join(' + ');
  }
  
  // Combine tools (union of all allowed tools)
  private combineTools(modes: ModeType[]): string[] {
    const allTools = new Set<string>();
    
    for (const mode of modes) {
      const tools = TOOL_ACCESS_RULES[mode].allowedTools;
      tools.forEach(t => allTools.add(t));
    }
    
    return Array.from(allTools);
  }
  
  // Combine prompts
  private combinePrompts(modes: ModeType[]): string {
    const prompts = modes.map(m => MODE_TEMPLATES[m].template);
    return prompts.join('\n\n---\n\n');
  }
}
```

### Example Hybrid Modes

```typescript
const HYBRID_MODE_PRESETS = {
  'developer-security': {
    name: 'Secure Developer',
    modes: ['developer', 'security'],
    description: 'Full implementation with security awareness',
    icon: '👨‍💻🔒'
  },
  
  'developer-performance': {
    name: 'Performance-Focused Developer',
    modes: ['developer', 'performance'],
    description: 'Implementation with performance optimization',
    icon: '👨‍💻⚡'
  },
  
  'debugger-security': {
    name: 'Security Debugger',
    modes: ['debugger', 'security'],
    description: 'Debug with security vulnerability focus',
    icon: '🐛🔒'
  },
  
  'reviewer-security': {
    name: 'Security Reviewer',
    modes: ['reviewer', 'security'],
    description: 'Code review with security focus',
    icon: '👀🔒'
  }
};
```

### Commands

```bash
# Create hybrid mode
/mode hybrid developer security

# Use preset hybrid mode
/mode hybrid secure-developer

# List hybrid presets
/mode hybrid list

# Exit hybrid mode
/mode hybrid off
```

---

## Enhancement 10: Mode Memory (Project Preferences)

### Implementation

```typescript
interface ProjectModePreferences {
  projectPath: string;
  projectName: string;
  
  // Mode preferences
  defaultMode: ModeType;
  autoSwitchEnabled: boolean;
  
  // Custom confidence thresholds per mode
  customThresholds: Partial<Record<ModeType, number>>;
  
  // Disabled modes for this project
  disabledModes: ModeType[];
  
  // Preferred workflows
  preferredWorkflows: string[];
  
  // Mode-specific settings
  modeSettings: {
    planning?: {
      allowedDirectories: string[];
      requireApproval: boolean;
    };
    security?: {
      strictMode: boolean;
      autoScan: boolean;
    };
    performance?: {
      benchmarkThreshold: number;
    };
  };
}

class ProjectModeMemory {
  private preferences: Map<string, ProjectModePreferences> = new Map();
  
  // Load preferences for project
  loadPreferences(projectPath: string): ProjectModePreferences {
    const cached = this.preferences.get(projectPath);
    if (cached) return cached;
    
    // Load from disk
    const prefs = this.loadFromDisk(projectPath);
    this.preferences.set(projectPath, prefs);
    return prefs;
  }
  
  // Save preferences
  savePreferences(projectPath: string, prefs: ProjectModePreferences): void {
    this.preferences.set(projectPath, prefs);
    this.saveToDisk(projectPath, prefs);
  }
  
  // Update threshold for specific mode
  setModeThreshold(projectPath: string, mode: ModeType, threshold: number): void {
    const prefs = this.loadPreferences(projectPath);
    prefs.customThresholds[mode] = threshold;
    this.savePreferences(projectPath, prefs);
  }
  
  // Disable mode for project
  disableMode(projectPath: string, mode: ModeType): void {
    const prefs = this.loadPreferences(projectPath);
    if (!prefs.disabledModes.includes(mode)) {
      prefs.disabledModes.push(mode);
      this.savePreferences(projectPath, prefs);
    }
  }
}
```

### Storage Location

```
.ollm/mode-preferences.json
```

### Example Preferences

```json
{
  "/path/to/security-critical-app": {
    "projectName": "Banking App",
    "defaultMode": "developer",
    "autoSwitchEnabled": true,
    "customThresholds": {
      "security": 0.5,
      "reviewer": 0.6
    },
    "disabledModes": ["prototype"],
    "preferredWorkflows": ["security_hardening"],
    "modeSettings": {
      "security": {
        "strictMode": true,
        "autoScan": true
      }
    }
  },
  
  "/path/to/prototype-project": {
    "projectName": "Experiment",
    "defaultMode": "prototype",
    "autoSwitchEnabled": false,
    "customThresholds": {},
    "disabledModes": ["reviewer", "security"],
    "preferredWorkflows": [],
    "modeSettings": {}
  }
}
```

---

## Enhancement 11: Mode Transition Animations

### Implementation

```typescript
interface ModeTransitionAnimation {
  type: 'switching' | 'entering' | 'exiting';
  fromMode: ModeType | null;
  toMode: ModeType;
  message: string;
  duration: number;  // milliseconds
}

class ModeTransitionAnimator {
  // Show transition animation
  async showTransition(from: ModeType | null, to: ModeType): Promise<void> {
    const animation: ModeTransitionAnimation = {
      type: from ? 'switching' : 'entering',
      fromMode: from,
      toMode: to,
      message: this.getTransitionMessage(from, to),
      duration: 1500
    };
    
    await this.renderAnimation(animation);
  }
  
  // Get transition message
  private getTransitionMessage(from: ModeType | null, to: ModeType): string {
    const toInfo = MODE_DISPLAY_INFO[to];
    
    if (!from) {
      return `${toInfo.icon} Entering ${toInfo.persona} mode...`;
    }
    
    const fromInfo = MODE_DISPLAY_INFO[from];
    
    // Special messages for specific transitions
    if (from === 'developer' && to === 'debugger') {
      return '🐛 Switching to Debugger mode...\n   Analyzing error patterns...';
    }
    
    if (from === 'debugger' && to === 'developer') {
      return '👨‍💻 Returning to Developer mode...\n   💡 Applying debugger findings...';
    }
    
    if (from === 'planning' && to === 'developer') {
      return '👨‍💻 Switching to Developer mode...\n   📋 Plan loaded, ready to implement...';
    }
    
    if (to === 'security') {
      return '🔒 Switching to Security mode...\n   🔍 Preparing security audit...';
    }
    
    return `${toInfo.icon} Switching to ${toInfo.persona} mode...`;
  }
  
  // Render animation in UI
  private async renderAnimation(animation: ModeTransitionAnimation): Promise<void> {
    // Show animated transition in UI
    // Could use Ink spinner or custom animation
  }
}
```

### UI Display

```
┌─────────────────────────────────────────┐
│ [Switching to Debugger Mode...]         │
│ 🐛 Analyzing error patterns...          │
│ ⠋ Loading debugger tools...             │
└─────────────────────────────────────────┘

↓ (1.5 seconds later)

┌─────────────────────────────────────────┐
│ ✓ Debugger Mode Active                  │
│ 🐛 Ready to analyze bugs                │
└─────────────────────────────────────────┘
```

---

## Enhancement 12: RAG Integration with Codebase Indexing

### Complete RAG Architecture

The system includes full RAG (Retrieval-Augmented Generation) with codebase indexing using LanceDB:

```typescript
interface RAGSystem {
  // Core indexing
  codebaseIndex: CodebaseIndex;
  embeddingService: EmbeddingService;
  vectorStore: LanceDBVectorStore;
  
  // Mode-specific knowledge bases
  modeKnowledge: {
    debugger: LanceDBIndex;     // Common bugs, solutions
    security: LanceDBIndex;     // Vulnerabilities, fixes
    performance: LanceDBIndex;  // Optimization patterns
    planning: LanceDBIndex;     // Design patterns
  };
}

interface CodebaseIndex {
  // Lifecycle
  initialize(rootPath: string, options: IndexOptions): Promise<void>;
  shutdown(): Promise<void>;
  
  // Indexing operations
  indexWorkspace(): Promise<IndexStats>;
  updateFile(filePath: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
  
  // Search operations
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // Status
  getStats(): IndexStats;
  clear(): Promise<void>;
}

interface IndexOptions {
  extensions: string[];           // ['.ts', '.js', '.py']
  excludePatterns: string[];      // ['node_modules', 'dist']
  maxFileSize: number;            // Skip larger files
  chunkSize: number;              // Tokens per chunk
  chunkOverlap: number;           // Overlap between chunks
  autoIndex: boolean;             // Index on startup
}

interface SearchResult {
  filePath: string;
  content: string;
  score: number;                  // Similarity score (0-1)
  startLine: number;
  endLine: number;
  metadata: {
    language: string;
    lastModified: Date;
  };
}
```

### Embedding Service

```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  getDimensions(): number;
  getModel(): string;
}

// Local implementation using @xenova/transformers
class LocalEmbeddingService implements EmbeddingService {
  private model = 'Xenova/all-MiniLM-L6-v2';  // 384-dim
  
  async embed(text: string): Promise<number[]> {
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
  
  getDimensions(): number {
    return 384;
  }
}
```

### LanceDB Vector Store

```typescript
interface LanceDBVectorStore {
  // Storage operations
  upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void>;
  upsertBatch(items: VectorItem[]): Promise<void>;
  
  // Search operations
  searchByVector(vector: number[], topK: number, threshold?: number): Promise<VectorResult[]>;
  
  // Management
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

interface VectorMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  lastModified: number;
}
```

### Storage Location

```
~/.ollm/rag/
├── codebase.lance/          # Codebase index
├── knowledge/
│   ├── debugger.lance/      # Debugger knowledge
│   ├── security.lance/      # Security knowledge
│   ├── performance.lance/   # Performance knowledge
│   └── planning.lance/      # Planning knowledge
```

### Integration with Mode System

```typescript
// When entering a mode, load relevant RAG context
async onModeEnter(mode: ModeType, context: string): Promise<void> {
  if (this.ragSystem) {
    // Search codebase for relevant context
    const codebaseResults = await this.ragSystem.codebaseIndex.search(
      context,
      { topK: 5, threshold: 0.7 }
    );
    
    // Search mode-specific knowledge
    const knowledgeResults = await this.ragSystem.modeKnowledge[mode]?.search(
      context,
      { topK: 3, threshold: 0.75 }
    );
    
    // Inject RAG context into system prompt
    const ragContext = this.formatRAGContext(codebaseResults, knowledgeResults);
    this.modeManager.addContextToPrompt(ragContext);
  }
}

// When exiting specialized mode, index findings
async onModeExit(mode: ModeType, findings: any): Promise<void> {
  if (this.ragSystem && this.isSpecializedMode(mode)) {
    const knowledge = this.convertFindingsToDocuments(mode, findings);
    await this.ragSystem.modeKnowledge[mode].upsertBatch(knowledge);
  }
}
```

### Automatic Indexing

- Index workspace on startup (if enabled)
- Watch for file changes and update incrementally
- Respect .gitignore and exclude patterns
- Skip large files (configurable threshold)

### Configuration

```yaml
rag:
  enabled: true
  codebase:
    autoIndex: true
    extensions: ['.ts', '.js', '.py', '.md']
    excludePatterns: ['node_modules', 'dist', '.git']
    maxFileSize: 1048576  # 1MB
    chunkSize: 512        # tokens
    chunkOverlap: 50      # tokens
  embedding:
    provider: 'local'     # local | ollama
    model: 'all-MiniLM-L6-v2'
  search:
    topK: 5
    threshold: 0.7
```

---

## Enhancement 13: Structured Output Support

### Architecture

The system includes structured output with JSON schema enforcement for reliable mode outputs:

```typescript
interface StructuredOutputService {
  // Generate with schema enforcement
  generateWithSchema<T>(
    request: ProviderRequest,
    schema: JSONSchema,
    options?: StructuredOutputOptions
  ): Promise<T>;
  
  // Validate output against schema
  validate(output: string, schema: JSONSchema): ValidationResult<any>;
  
  // Extract JSON from mixed content
  extractJson(output: string): string | null;
}

interface StructuredOutputOptions {
  strict: boolean;                // Strict schema enforcement
  maxRetries: number;             // Retry on validation failure
  retryDelay: number;             // Delay between retries (ms)
}

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  expected: string;
  received: string;
}

// JSON Schema definition
interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  description?: string;
  additionalProperties?: boolean;
}

// Provider integration
interface ResponseFormat {
  type: 'text' | 'json' | 'json_schema';
  schema?: JSONSchema;
  strict?: boolean;
}
```

### Mode-Specific Schemas

Each specialized mode can define output schemas for structured responses:

```typescript
const MODE_OUTPUT_SCHEMAS: Record<ModeType, JSONSchema | null> = {
  debugger: {
    type: 'object',
    properties: {
      errors: { type: 'array', items: { type: 'string' } },
      rootCause: { type: 'string' },
      fixes: { type: 'array', items: { type: 'string' } }
    },
    required: ['errors', 'rootCause', 'fixes']
  },
  
  security: {
    type: 'object',
    properties: {
      vulnerabilities: { type: 'array', items: { type: 'string' } },
      severity: { type: 'array', items: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] } },
      recommendations: { type: 'array', items: { type: 'string' } }
    },
    required: ['vulnerabilities', 'recommendations']
  },
  
  reviewer: {
    type: 'object',
    properties: {
      issues: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      positives: { type: 'array', items: { type: 'string' } }
    },
    required: ['issues', 'suggestions']
  },
  
  performance: {
    type: 'object',
    properties: {
      bottlenecks: { type: 'array', items: { type: 'string' } },
      optimizations: { type: 'array', items: { type: 'string' } },
      estimatedImprovement: { type: 'string' }
    },
    required: ['bottlenecks', 'optimizations']
  },
  
  // Other modes don't require structured output
  assistant: null,
  planning: null,
  developer: null,
  tool: null,
  prototype: null,
  teacher: null
};
```

### Usage in Modes

```typescript
// When specialized mode completes analysis, use structured output
async analyzeWithStructuredOutput(mode: ModeType, context: string): Promise<any> {
  const schema = MODE_OUTPUT_SCHEMAS[mode];
  if (!schema) {
    // No structured output for this mode
    return this.generateNormalResponse(context);
  }
  
  // Generate with schema enforcement
  const result = await this.structuredOutputService.generateWithSchema(
    {
      model: this.currentModel,
      messages: this.buildMessages(context),
      systemPrompt: this.getSystemPrompt(mode)
    },
    schema,
    {
      strict: true,
      maxRetries: 3,
      retryDelay: 1000
    }
  );
  
  return result;
}
```

### Retry Logic

```typescript
async generateWithSchema<T>(
  request: ProviderRequest,
  schema: JSONSchema,
  options: StructuredOutputOptions
): Promise<T> {
  let attempts = 0;
  let lastError: ValidationError[] | null = null;
  
  while (attempts < options.maxRetries) {
    attempts++;
    
    // Generate response
    const response = await this.provider.chat({
      ...request,
      responseFormat: { type: 'json_schema', schema, strict: options.strict }
    });
    
    // Validate against schema
    const validation = this.validate(response.content, schema);
    
    if (validation.valid) {
      return validation.data as T;
    }
    
    lastError = validation.errors || null;
    
    if (attempts < options.maxRetries) {
      await this.delay(options.retryDelay);
    }
  }
  
  throw new ValidationError(
    `Failed to generate valid output after ${attempts} attempts`,
    lastError
  );
}
```

### Configuration

```yaml
structuredOutput:
  enabled: true
  defaultMaxRetries: 3
  defaultRetryDelay: 1000
  strict: true
  modes:
    debugger: true
    security: true
    reviewer: true
    performance: true
```

### Integration Points

- Mode entry: Enable structured output if mode has schema
- Mode exit: Validate and store structured findings
- Snapshot creation: Include structured findings in JSON format
- UI display: Parse and display structured output nicely

---

## Enhancement 12: RAG Integration Preparation

### LanceDB Integration Architecture

```typescript
interface RAGSystem {
  // Codebase indexing
  codebaseIndex: LanceDBIndex;
  
  // Documentation indexing
  docsIndex: LanceDBIndex;
  
  // Conversation memory (long-term)
  memoryIndex: LanceDBIndex;
  
  // Mode-specific knowledge bases
  modeKnowledge: {
    debugger: LanceDBIndex;     // Common bugs, solutions
    security: LanceDBIndex;     // Vulnerabilities, fixes
    performance: LanceDBIndex;  // Optimization patterns
    planning: LanceDBIndex;     // Design patterns, architectures
  };
}

interface LanceDBIndex {
  // Add documents to index
  add(documents: Document[]): Promise<void>;
  
  // Search index
  search(query: string, limit?: number): Promise<SearchResult[]>;
  
  // Update document
  update(id: string, document: Document): Promise<void>;
  
  // Delete document
  delete(id: string): Promise<void>;
  
  // Get index stats
  stats(): Promise<IndexStats>;
}

interface Document {
  id: string;
  content: string;
  metadata: {
    type: 'code' | 'docs' | 'conversation' | 'knowledge';
    mode?: ModeType;
    timestamp: Date;
    source: string;
    tags: string[];
  };
  embedding?: number[];  // Vector embedding
}

interface SearchResult {
  document: Document;
  score: number;  // Similarity score
  distance: number;  // Vector distance
}
```

### Mode-Specific RAG Usage

```typescript
class ModeRAGIntegration {
  constructor(private ragSystem: RAGSystem) {}
  
  // Get relevant context for current mode
  async getContextForMode(
    mode: ModeType,
    query: string
  ): Promise<Document[]> {
    switch (mode) {
      case 'debugger':
        // Search for similar bugs and solutions
        return this.ragSystem.modeKnowledge.debugger.search(query, 5);
      
      case 'security':
        // Search for similar vulnerabilities
        return this.ragSystem.modeKnowledge.security.search(query, 5);
      
      case 'performance':
        // Search for optimization patterns
        return this.ragSystem.modeKnowledge.performance.search(query, 5);
      
      case 'planning':
        // Search for design patterns
        return this.ragSystem.modeKnowledge.planning.search(query, 5);
      
      case 'developer':
        // Search codebase
        return this.ragSystem.codebaseIndex.search(query, 10);
      
      default:
        return [];
    }
  }
  
  // Index mode-specific knowledge
  async indexModeKnowledge(
    mode: ModeType,
    knowledge: Document[]
  ): Promise<void> {
    const index = this.ragSystem.modeKnowledge[mode];
    if (index) {
      await index.add(knowledge);
    }
  }
}
```

### LanceDB Setup

```typescript
import * as lancedb from 'vectordb';

class LanceDBSetup {
  private db: lancedb.Connection;
  
  async initialize(dbPath: string): Promise<void> {
    // Connect to LanceDB
    this.db = await lancedb.connect(dbPath);
    
    // Create tables for each index
    await this.createCodebaseTable();
    await this.createDocsTable();
    await this.createMemoryTable();
    await this.createModeKnowledgeTables();
  }
  
  private async createCodebaseTable(): Promise<void> {
    await this.db.createTable('codebase', [
      { name: 'id', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'file_path', type: 'string' },
      { name: 'language', type: 'string' },
      { name: 'embedding', type: 'vector(384)' }  // 384-dim embeddings
    ]);
  }
  
  private async createModeKnowledgeTables(): Promise<void> {
    const modes = ['debugger', 'security', 'performance', 'planning'];
    
    for (const mode of modes) {
      await this.db.createTable(`knowledge_${mode}`, [
        { name: 'id', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'tags', type: 'list<string>' },
        { name: 'embedding', type: 'vector(384)' }
      ]);
    }
  }
}
```

### Embedding Generation

```typescript
import { pipeline } from '@xenova/transformers';

class EmbeddingService {
  private model: any;
  
  async initialize(): Promise<void> {
    // Load embedding model (runs locally)
    this.model = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'  // 384-dim embeddings
    );
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });
    
    return Array.from(output.data);
  }
  
  async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.generateEmbedding(t)));
  }
}
```

### Storage Location

```
~/.ollm/rag/
├── codebase.lance/          # Codebase index
├── docs.lance/              # Documentation index
├── memory.lance/            # Conversation memory
└── knowledge/
    ├── debugger.lance/      # Debugger knowledge
    ├── security.lance/      # Security knowledge
    ├── performance.lance/   # Performance knowledge
    └── planning.lance/      # Planning knowledge
```

### Integration with Mode System

```typescript
// When entering a mode, load relevant RAG context
async onModeEnter(mode: ModeType, context: string): Promise<void> {
  if (this.ragSystem) {
    const relevantDocs = await this.ragIntegration.getContextForMode(
      mode,
      context
    );
    
    // Inject RAG context into system prompt
    const ragContext = this.formatRAGContext(relevantDocs);
    this.modeManager.addContextToPrompt(ragContext);
  }
}

// When exiting specialized mode, index findings
async onModeExit(mode: ModeType, findings: any): Promise<void> {
  if (this.ragSystem && this.isSpecializedMode(mode)) {
    const knowledge = this.convertFindingsToDocuments(mode, findings);
    await this.ragIntegration.indexModeKnowledge(mode, knowledge);
  }
}
```

---

## Implementation Priority

### Phase 1: Core Enhancements (High Priority)
1. ✅ Mode 9: Prototype Mode
2. ✅ Mode 10: Teacher Mode
3. ✅ Mode Transition Suggestions
4. ✅ Mode-Specific Shortcuts
5. ✅ Improved Planning Mode Restrictions

### Phase 2: Usability Enhancements (Medium Priority)
6. ✅ Mode Workflows
7. ✅ Mode Confidence Display
8. ✅ Mode-Specific Metrics

### Phase 3: Advanced Features (Lower Priority)
9. ✅ Focus Mode
10. ✅ Hybrid Modes
11. ✅ Mode Memory (Project Preferences)
12. ✅ Mode Transition Animations

### Phase 4: RAG Integration (Future)
13. ✅ LanceDB Setup
14. ✅ Embedding Service
15. ✅ Mode-Specific Knowledge Bases
16. ✅ RAG Context Injection

---

## Estimated Effort

| Enhancement | Estimated Time |
|-------------|----------------|
| Prototype Mode | 2-3 hours |
| Teacher Mode | 2-3 hours |
| Mode Transition Suggestions | 3-4 hours |
| Mode Workflows | 4-5 hours |
| Mode-Specific Metrics | 3-4 hours |
| Mode Confidence Display | 2-3 hours |
| Mode-Specific Shortcuts | 2-3 hours |
| Improved Planning Restrictions | 2-3 hours |
| Focus Mode | 2-3 hours |
| Hybrid Modes | 4-5 hours |
| Mode Memory | 3-4 hours |
| Mode Transition Animations | 2-3 hours |
| RAG Integration (LanceDB) | 8-10 hours |
| **Total** | **39-53 hours** |

---

## Success Criteria

### Must Have ✅
- [x] Prototype and Teacher modes implemented
- [x] Mode transition suggestions working
- [x] Mode-specific shortcuts functional
- [x] Planning mode can write docs/design files
- [x] Mode workflows guide users through tasks

### Should Have 🎯
- [x] Mode confidence displayed in UI
- [x] Mode-specific metrics tracked
- [x] Focus mode prevents interruptions
- [x] Hybrid modes combine capabilities

### Nice to Have 💡
- [x] Mode memory per project
- [x] Smooth transition animations
- [x] RAG integration ready (LanceDB)

---

**Status:** Enhancement spec complete  
**Ready for:** Integration into design.md and tasks.md
