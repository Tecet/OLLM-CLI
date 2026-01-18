import type { ToolSchema, Message } from '../provider/types.js';

export interface ReActParseResult {
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
  hasInvalidJson?: boolean; // Flag for invalid JSON in Action Input
}

export class ReActToolHandler {
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
    const normalizedOutput = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedOutput.split('\n');
    const sections: Record<string, string[]> = {};
    const sectionsPresent = new Set<string>();
    let currentSection: string | null = null;
    const singleLineSections = new Set(['Action']);

    for (const line of lines) {
      const match = line.match(/^(Thought|Action|Action Input|Final Answer):\s*(.*)$/);
      if (match) {
        currentSection = match[1];
        sectionsPresent.add(currentSection);
        sections[currentSection] = [match[2] ?? ''];
        continue;
      }
      if (currentSection) {
        if (singleLineSections.has(currentSection)) {
          continue;
        }
        sections[currentSection].push(line);
      }
    }

    if (!sectionsPresent.has('Thought')) {
      return {};
    }

    const thought = sections.Thought?.join('\n');
    const action = sections.Action?.join('\n');
    const actionInputStr = sections['Action Input']?.join('\n');
    const finalAnswer = sections['Final Answer']?.join('\n');

    let actionInput: Record<string, unknown> | undefined;
    let hasInvalidJson = false;

    if (actionInputStr !== undefined) {
      const trimmedInput = actionInputStr.trim();
      if (trimmedInput.length === 0) {
        hasInvalidJson = true;
      } else {
        try {
          actionInput = JSON.parse(trimmedInput);
        } catch (_error) {
          // Requirement 10.3: Detect invalid JSON in Action Input
          hasInvalidJson = true;
        }
      }
    }

    // Helper to trim but preserve undefined if result is empty
    const trimOrUndefined = (str: string | undefined): string | undefined => {
      if (str === undefined) return undefined;
      const trimmed = str.trim();
      return trimmed.length > 0 ? trimmed : '';
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
