/**
 * Read Reasoning Tool
 * 
 * Allows reasoning models to review their past thinking processes
 * after context rollover.
 */

import type { DeclarativeTool, ToolSchema, ToolContext, ToolResult } from './types.js';
import type { ReasoningManagerImpl } from '../context/reasoningManager.js';
import type { ReasoningTrace } from '../context/reasoningTypes.js';

/**
 * Parameters for read reasoning tool
 */
export interface ReadReasoningParams {
  goalId?: string;
  traceId?: string;
  limit?: number;
  includeArchived?: boolean;
}

/**
 * Read Reasoning Traces Tool
 * Allows LLM to review past reasoning after context rollover
 */
export class ReadReasoningTool implements DeclarativeTool<unknown, unknown> {
  name = 'read_reasoning';
  displayName = 'Read Past Reasoning';
  
  schema: ToolSchema = {
    name: 'read_reasoning',
    description: 'Review your past thinking processes and reasoning traces. Use this after context rollover to recall your previous analysis and decisions.',
    parameters: {
      type: 'object',
      properties: {
        goalId: {
          type: 'string',
          description: 'Get reasoning traces for a specific goal'
        },
        traceId: {
          type: 'string',
          description: 'Get a specific reasoning trace by ID'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of traces to return (default: 5)'
        },
        includeArchived: {
          type: 'boolean',
          description: 'Include archived traces (summaries only, default: false)'
        }
      }
    }
  };

  async execute(
    params: ReadReasoningParams,
    context: ToolContext
  ): Promise<ToolResult> {
    const reasoningManager = (context as { reasoningManager?: ReasoningManagerImpl }).reasoningManager;
    
    if (!reasoningManager) {
      return {
        llmContent: 'Reasoning manager not available',
        returnDisplay: '⚠ Reasoning traces not available'
      };
    }

    // Get specific trace
    if (params.traceId) {
      const trace = reasoningManager.getTrace(params.traceId);
      if (!trace) {
        return {
          llmContent: `Reasoning trace not found: ${params.traceId}`,
          returnDisplay: `⚠ Trace not found: ${params.traceId}`
        };
      }

      return {
        llmContent: this.formatTrace(trace),
        returnDisplay: `✓ Retrieved reasoning trace from ${trace.timestamp.toISOString()}`
      };
    }

    // Get traces for goal
    if (params.goalId) {
      const traces = reasoningManager.getTracesForGoal(params.goalId);
      const limit = params.limit || 5;
      const limited = traces.slice(-limit);

      if (limited.length === 0) {
        return {
          llmContent: `No reasoning traces found for goal: ${params.goalId}`,
          returnDisplay: `⚠ No traces for goal: ${params.goalId}`
        };
      }

      const formatted = limited.map(t => this.formatTrace(t)).join('\n\n---\n\n');
      return {
        llmContent: formatted,
        returnDisplay: `✓ Retrieved ${limited.length} reasoning trace(s) for goal`
      };
    }

    // Get recent traces
    const storage = reasoningManager.getReasoningStorage();
    const limit = params.limit || 5;
    const traces = storage.recent.slice(0, limit);

    if (traces.length === 0) {
      return {
        llmContent: 'No reasoning traces available',
        returnDisplay: '⚠ No reasoning traces found'
      };
    }

    let formatted = traces.map(t => this.formatTrace(t)).join('\n\n---\n\n');

    // Include archived if requested
    if (params.includeArchived && storage.archived.length > 0) {
      formatted += '\n\n## Archived Traces (Summaries)\n\n';
      formatted += storage.archived
        .map(a => `- ${a.timestamp.toISOString()}: ${a.summary}`)
        .join('\n');
    }

    return {
      llmContent: formatted,
      returnDisplay: `✓ Retrieved ${traces.length} recent reasoning trace(s)`
    };
  }

  private formatTrace(trace: ReasoningTrace): string {
    let output = `## Reasoning Trace (${trace.timestamp.toISOString()})\n\n`;
    
    if (trace.context.goalId) {
      output += `**Goal:** ${trace.context.goalId}\n`;
    }
    
    output += `**Model:** ${trace.metadata.modelName}\n`;
    output += `**Thinking Tokens:** ${trace.metadata.thinkingTokens}\n\n`;
    
    output += `### Thinking Process\n\n${trace.thinking}\n\n`;
    
    if (trace.structured) {
      output += `### Structured Analysis\n\n`;
      
      if (trace.structured.alternatives.length > 0) {
        output += `**Alternatives Considered:**\n`;
        trace.structured.alternatives.forEach((alt, i) => {
          output += `${i + 1}. ${alt}\n`;
        });
        output += '\n';
      }
      
      if (trace.structured.chosenApproach) {
        output += `**Chosen Approach:** ${trace.structured.chosenApproach}\n\n`;
      }
      
      if (trace.structured.rationale) {
        output += `**Rationale:** ${trace.structured.rationale}\n\n`;
      }
      
      if (trace.structured.keyInsights.length > 0) {
        output += `**Key Insights:**\n`;
        trace.structured.keyInsights.forEach((insight) => {
          output += `- ${insight}\n`;
        });
        output += '\n';
      }
      
      output += `**Confidence:** ${trace.structured.confidence}%\n`;
    }
    
    return output;
  }
}
