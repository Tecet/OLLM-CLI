import type { ToolSchema, Message } from '../provider/types.js';

export interface ReActParseResult {
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
  hasInvalidJson?: boolean; // Flag for invalid JSON in Action Input
}

export class ReActToolHandler {
  private static readonly REACT_PATTERN =
    /Thought:\s*(.+?)\n(?:Action:\s*(.+?)\n)?(?:Action Input:\s*(.+?)\n)?(?:Final Answer:\s*(.+))?/s;

  static formatToolsAsInstructions(tools: ToolSchema[]): string {
    const toolDescriptions = tools
      .map((tool) => {
        return `- ${tool.name}: ${tool.description || 'No description'}
  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`;
      })
      .join('\n');

    return `You have access to the following tools:

${toolDescriptions}

To use a tool, respond in this exact format:

Thought: [Your reasoning about what to do]
Action: [tool_name]
Action Input: [JSON object with parameters]

After receiving the tool result, you'll see:
Observation: [tool result]

You can then continue with more Thought/Action/Observation cycles.

When you have the final answer, respond with:
Final Answer: [Your response to the user]`;
  }

  static parseReActOutput(output: string): ReActParseResult {
    const match = output.match(this.REACT_PATTERN);
    if (!match) {
      return {};
    }

    const [, thought, action, actionInputStr, finalAnswer] = match;

    let actionInput: Record<string, unknown> | undefined;
    let hasInvalidJson = false;

    if (actionInputStr) {
      try {
        actionInput = JSON.parse(actionInputStr.trim());
      } catch (error) {
        // Requirement 10.3: Detect invalid JSON in Action Input
        hasInvalidJson = true;
      }
    }

    // Helper to trim but preserve undefined if result is empty
    const trimOrUndefined = (str: string | undefined): string | undefined => {
      if (!str) return undefined;
      const trimmed = str.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    return {
      thought: trimOrUndefined(thought),
      action: trimOrUndefined(action),
      actionInput,
      finalAnswer: trimOrUndefined(finalAnswer),
      hasInvalidJson,
    };
  }

  static formatObservation(result: unknown): string {
    return `Observation: ${JSON.stringify(result)}`;
  }

  static validateActionInput(
    actionInput: unknown
  ): actionInput is Record<string, unknown> {
    return (
      typeof actionInput === 'object' &&
      actionInput !== null &&
      !Array.isArray(actionInput)
    );
  }

  /**
   * Create a correction request message for invalid JSON in ReAct Action Input.
   * Requirement 10.3: Add correction request to conversation
   * @param invalidInput The invalid JSON string that failed to parse
   * @returns A user message requesting JSON correction
   */
  static createJsonCorrectionMessage(invalidInput: string): Message {
    return {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Error: Action Input must be valid JSON. The following input could not be parsed:

${invalidInput}

Please provide the Action Input as a valid JSON object. For example:
Action Input: {"param1": "value1", "param2": "value2"}`,
        },
      ],
    };
  }
}
