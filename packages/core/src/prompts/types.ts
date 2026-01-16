export interface PromptDefinition {
  /** Unique identifier for the prompt */
  id: string;
  /** Human-readable name */
  name: string;
  /** The content of the prompt (template string) */
  content: string;
  /** Description for UI/Debugging */
  description?: string;
  /** List of tool names this prompt depends on */
  requiredTools?: string[];
  /** Tags for categorization (e.g. 'sanity', 'skill', 'core') */
  tags?: string[];
  /** Source of the prompt (static, mcp, config) */
  source: 'static' | 'mcp' | 'config';
  /** If from MCP, the server name */
  serverName?: string;
}

export interface PromptTemplateParams {
  [key: string]: string | number | boolean | undefined;
}

export interface RegisteredPrompt extends PromptDefinition {
  /** Timestamp when registered */
  registeredAt: number;
}
