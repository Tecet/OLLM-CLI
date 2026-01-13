/**
 * HookTranslator converts between system data and hook protocol
 * 
 * Handles conversion of system events and data to the JSON format expected
 * by hooks, and parses hook output back into system format.
 */

import type { HookEvent, HookInput, HookOutput } from './types.js';

/**
 * Translator for hook protocol communication
 */
export class HookTranslator {
  /**
   * Convert system data to hook input format
   * 
   * @param event - The hook event type
   * @param data - Event-specific data
   * @returns Hook input in JSON-serializable format
   */
  toHookInput(event: HookEvent, data: unknown): HookInput {
    // Ensure data is an object
    const eventData = this.normalizeData(data);
    
    return {
      event,
      data: eventData,
    };
  }

  /**
   * Parse hook output from JSON string
   * 
   * @param json - JSON string from hook stdout
   * @returns Parsed hook output
   * @throws Error if JSON is malformed or invalid
   */
  parseHookOutput(json: string): HookOutput {
    try {
      const parsed = JSON.parse(json);
      
      if (!this.validateOutput(parsed)) {
        throw new Error('Invalid hook output structure');
      }
      
      return parsed as HookOutput;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Malformed JSON in hook output: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate hook output structure
   * 
   * @param output - Parsed output to validate
   * @returns true if output is valid
   */
  validateOutput(output: unknown): boolean {
    // Output must be an object
    if (typeof output !== 'object' || output === null) {
      return false;
    }

    const obj = output as Record<string, unknown>;

    // Must have 'continue' field as boolean
    if (typeof obj.continue !== 'boolean') {
      return false;
    }

    // If systemMessage is present and not null, it must be a string
    if ('systemMessage' in obj && obj.systemMessage !== null && typeof obj.systemMessage !== 'string') {
      return false;
    }

    // If data is present and not null, it must be an object (not an array)
    if ('data' in obj && obj.data !== null) {
      if (typeof obj.data !== 'object' || Array.isArray(obj.data)) {
        return false;
      }
    }

    // If error is present and not null, it must be a string
    if ('error' in obj && obj.error !== null && typeof obj.error !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Normalize data to ensure it's a valid object
   * 
   * @param data - Data to normalize
   * @returns Normalized data object
   */
  private normalizeData(data: unknown): Record<string, unknown> {
    // If data is null or undefined, return empty object
    if (data === null || data === undefined) {
      return {};
    }

    // If data is already an object (and not an array), return it
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }

    // For primitives or arrays, wrap in an object
    return { value: data };
  }

  /**
   * Serialize hook input to JSON string
   * 
   * @param input - Hook input to serialize
   * @returns JSON string
   */
  serializeInput(input: HookInput): string {
    return JSON.stringify(input, null, 2);
  }

  /**
   * Create hook input for specific event types with proper data structure
   * 
   * @param event - The hook event type
   * @param data - Event-specific data
   * @returns Hook input with properly structured data
   */
  createEventInput(event: HookEvent, data: Record<string, unknown>): HookInput {
    // Validate and structure data based on event type
    const structuredData = this.structureEventData(event, data);
    
    return {
      event,
      data: structuredData,
    };
  }

  /**
   * Structure event data according to event type requirements
   * 
   * @param event - The hook event type
   * @param data - Raw event data
   * @returns Structured event data
   */
  private structureEventData(event: HookEvent, data: Record<string, unknown>): Record<string, unknown> {
    // Structure data based on event type requirements
    switch (event) {
      case 'session_start':
        return this.structureSessionStartData(data);
      case 'session_end':
        return this.structureSessionEndData(data);
      case 'before_agent':
        return this.structureBeforeAgentData(data);
      case 'after_agent':
        return this.structureAfterAgentData(data);
      case 'before_model':
        return this.structureBeforeModelData(data);
      case 'after_model':
        return this.structureAfterModelData(data);
      case 'before_tool_selection':
        return this.structureBeforeToolSelectionData(data);
      case 'before_tool':
        return this.structureBeforeToolData(data);
      case 'after_tool':
        return this.structureAfterToolData(data);
      default:
        return { ...data };
    }
  }

  /**
   * Structure data for session_start event
   * Requirements: 9.1 - WHEN a session_start event occurs, THE Hook_Runner SHALL provide session_id
   */
  private structureSessionStartData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      session_id: data.session_id ?? data.sessionId,
    };
  }

  /**
   * Structure data for session_end event
   * Requirements: 9.2 - WHEN a session_end event occurs, THE Hook_Runner SHALL provide session_id and messages
   */
  private structureSessionEndData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      session_id: data.session_id ?? data.sessionId,
      messages: data.messages ?? [],
    };
  }

  /**
   * Structure data for before_agent event
   * Requirements: 9.3 - WHEN a before_agent event occurs, THE Hook_Runner SHALL provide prompt and context
   */
  private structureBeforeAgentData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      prompt: data.prompt,
      context: data.context,
    };
  }

  /**
   * Structure data for after_agent event
   * Requirements: 9.4 - WHEN an after_agent event occurs, THE Hook_Runner SHALL provide response and tool_calls
   */
  private structureAfterAgentData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      response: data.response,
      tool_calls: data.tool_calls ?? data.toolCalls ?? [],
    };
  }

  /**
   * Structure data for before_model event
   * Requirements: 9.5 - WHEN a before_model event occurs, THE Hook_Runner SHALL provide messages and model
   */
  private structureBeforeModelData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      messages: data.messages ?? [],
      model: data.model,
    };
  }

  /**
   * Structure data for after_model event
   * Requirements: 9.6 - WHEN an after_model event occurs, THE Hook_Runner SHALL provide response and tokens
   */
  private structureAfterModelData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      response: data.response,
      tokens: data.tokens,
    };
  }

  /**
   * Structure data for before_tool_selection event
   * Requirements: 9.7 - WHEN a before_tool_selection event occurs, THE Hook_Runner SHALL provide available_tools
   */
  private structureBeforeToolSelectionData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      available_tools: data.available_tools ?? data.availableTools ?? [],
    };
  }

  /**
   * Structure data for before_tool event
   * Requirements: 9.8 - WHEN a before_tool event occurs, THE Hook_Runner SHALL provide tool_name and args
   */
  private structureBeforeToolData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      tool_name: data.tool_name ?? data.toolName,
      args: data.args ?? data.arguments,
    };
  }

  /**
   * Structure data for after_tool event
   * Requirements: 9.9 - WHEN an after_tool event occurs, THE Hook_Runner SHALL provide tool_name and result
   */
  private structureAfterToolData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      tool_name: data.tool_name ?? data.toolName,
      result: data.result,
    };
  }
}

