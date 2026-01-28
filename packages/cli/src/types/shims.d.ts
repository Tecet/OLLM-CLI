// Temporary narrow shims to unblock CLI TypeScript build
// Replace with proper exports from `@ollm/ollm-cli-core` as alignment progresses

declare module '@ollm/ollm-cli-core/hooks' {
  export type Hook = any;
  export type HookEvent = string;
  export type HookConfig = any;
  export type HookRegistry = any;
  export interface HookDebugger {
    [key: string]: any;
  }
  export function getHookDebugger(): HookDebugger;
  export function setHookDebugger(debuggerInstance: HookDebugger): void;
}

declare module '@ollm/ollm-cli-core/mcp' {
  export type MCPClient = any;
  export type MCPServerConfig = any;
  export type MCPServerStatus = any;
  export type MCPTool = any;
  export type MCPRequest = any;
  export type MCPResponse = any;
  export type MCPError = any;
  export type MCPHealthMonitor = any;
}

declare module '@ollm/ollm-cli-core/prompts' {
  export type PromptDefinition = any;
  export type ContextAnalyzer = any;
  export type HybridModeManager = any;
}

declare module '@ollm/ollm-bridge' {
  const bridge: any;
  export default bridge;
}
