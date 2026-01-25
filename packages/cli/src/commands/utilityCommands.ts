/**
 * Utility Commands
 * 
 * Implements utility commands:
 * - /help - Show help information
 * - /exit - Exit the CLI
 * - /home - Return to launch screen (already implemented in homeCommand.ts)
 */

import type { Command, CommandResult } from './types.js';
import { SettingsService } from '../config/settingsService.js';
import { profileManager } from '../features/profiles/ProfileManager.js';
import { calculateContextSizing } from '../features/context/contextSizing.js';
import { getLastGPUInfo } from '../features/context/gpuHintStore.js';
import { deriveGPUPlacementHints, type GPUPlacementHints } from '../features/context/gpuHints.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';
import type { ContextMessage, GPUInfo } from '@ollm/core';

const MAX_CONTEXT_SNIPPET = 6;

function formatContextSnippet(messages: ContextMessage[]): string {
  const snippet = messages.slice(-MAX_CONTEXT_SNIPPET);
  return snippet
    .map((msg) => {
      const preview = (msg.content ?? '').replace(/\s+/g, ' ').trim();
      const truncated = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;
      return `[${msg.role.toUpperCase()}] ${truncated || '<empty>'}`;
    })
    .join('\n');
}

function buildPromptPreviewMessage(data: {
  mode: string;
  modelId: string;
  systemPrompt: string;
  snippet: string;
  usage: { currentTokens: number; maxTokens: number; percentage: number };
  contextSizing: ReturnType<typeof calculateContextSizing>;
  temperature: number;
  gpuHints?: GPUPlacementHints | null;
  gpuInfo?: GPUInfo | null;
}): string {
  const { mode, modelId, systemPrompt, snippet, usage, contextSizing, temperature } = data;
  const gpuLine = data.gpuHints
    ? `GPU hints: num_gpu=${data.gpuHints.num_gpu}, gpu_layers=${data.gpuHints.gpu_layers}`
    : 'GPU hints: unavailable';
  const formatGB = (value: number): string => (value / (1024 * 1024 * 1024)).toFixed(1);
  const gpuInfoLine = data.gpuInfo
    ? `GPU info: ${data.gpuInfo.model ?? data.gpuInfo.vendor ?? 'Unknown'} - ${formatGB(data.gpuInfo.vramTotal)} GB total / ${formatGB(data.gpuInfo.vramFree)} GB free`
    : 'GPU info: unavailable';
  return [
    '=== Test Prompt Dump ===',
    `Mode: ${mode}`,
    `Model: ${modelId}`,
    `Context usage: ${usage.currentTokens} / ${usage.maxTokens} (${Math.round(usage.percentage)}%)`,
    `Effective context cap (num_ctx): ${contextSizing.ollamaContextSize} (${Math.round(contextSizing.ratio * 100)}% of allowed ${contextSizing.allowed})`,
    `Temperature: ${temperature}`,
    gpuLine,
    gpuInfoLine,
    '',
    'System Prompt:',
    systemPrompt || '<empty>',
    '',
    'Context snippet (latest messages):',
    snippet || '(no messages tracked yet)',
    '',
    'AI prompt payload would include the system prompt above followed by the conversation snippet.'
  ].join('\n');
}

/**
 * /help - Show help information
 * 
 * Requirements: 19.12
 */
export const helpCommand: Command = {
  name: '/help',
  aliases: ['/?'],
  description: 'Show help information',
  usage: '/help [command]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0];
      return {
        success: true,
        message: `Help for ${commandName}:\n\nNo detailed help available yet.`,
      };
    }

    // Show general help
    return {
      success: true,
      message: 'OLLM CLI - Available Commands:\n\n' +
        'Session Management:\n' +
        '  /new              - Create new session\n' +
        '  /clear            - Clear chat history\n' +
        '  /compact          - Compress context\n' +
        '  /session          - Manage sessions (save, list, resume)\n' +
        '  /context          - Show context information\n\n' +
        'Model & Provider:\n' +
        '  /model            - Manage models (list, use, pull, rm, info)\n' +
        '  /provider         - Manage providers (list, use)\n\n' +
        'MCP (Model Context Protocol):\n' +
        '  /mcp              - List MCP servers and status\n' +
        '  /mcp health       - Check server health status\n' +
        '  /mcp restart      - Restart an MCP server\n' +
        '  /mcp oauth        - Manage OAuth authentication\n\n' +
        'Extensions:\n' +
        '  /extensions       - Manage extensions (search, install, list)\n' +
        '  /ext search       - Search extension marketplace\n' +
        '  /ext install      - Install an extension\n\n' +
        'Development:\n' +
        '  /git              - Git operations (status, commit, undo)\n' +
        '  /review           - Manage diff reviews (enable, disable, pending)\n\n' +
        'Customization:\n' +
        '  /theme            - Manage themes (list, use, preview)\n' +
        '  /hooks            - Manage hooks (list, debug)\n\n' +
        'Display:\n' +
        '  /metrics          - Manage metrics (show, toggle, reset)\n' +
        '  /reasoning        - Manage reasoning display (toggle, expand, collapse)\n\n' +
        'Utility:\n' +
        '  /help             - Show this help\n' +
        '  /home             - Return to launch screen\n' +
        '  /exit             - Exit the CLI\n\n' +
        'Use /help <command> for detailed information about a specific command.',
    };
  },
};

/**
 * /exit - Exit the CLI
 * 
 * Requirements: 19.12
 */
export const exitCommand: Command = {
  name: '/exit',
  aliases: ['/quit', '/q'],
  description: 'Exit the CLI',
  usage: '/exit',
  handler: async (): Promise<CommandResult> => {
    return {
      success: true,
      action: 'exit',
      message: 'Exiting...',
    };
  },
};

export const testPromptCommand: Command = {
  name: '/test prompt',
  description: 'Dump the current prompt/context details as a system message',
  usage: '/test prompt',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = getGlobalContextManager();
      if (!manager) {
        return { success: false, message: 'Context Manager not initialized yet.' };
      }

      const contextMessages = await manager.getContext();
      const systemPrompt = manager.getSystemPrompt();

      const settings = SettingsService.getInstance().getSettings();
      const modelId = settings.llm?.model ?? 'llama3.2:3b';
      const modelEntry = profileManager.getModelEntry(modelId);
      const requestedContextSize = settings.llm?.contextSize ?? modelEntry.default_context ?? 4096;
      const contextSizing = calculateContextSizing(requestedContextSize, modelEntry);
      const temperature = settings.llm?.temperature ?? 0.1;
      const snippet = formatContextSnippet(contextMessages);
      const lastGPUInfo = getLastGPUInfo();
      const gpuHints = deriveGPUPlacementHints(lastGPUInfo, contextSizing.ollamaContextSize);
      const preview = buildPromptPreviewMessage({
        mode: manager.getCurrentMode(),
        modelId,
        systemPrompt,
        snippet,
        usage: manager.getUsage(),
        contextSizing,
        temperature,
        gpuHints,
        gpuInfo: lastGPUInfo,
      });

      const addSystemMessage = globalThis.__ollmAddSystemMessage;
      if (typeof addSystemMessage === 'function') {
        addSystemMessage(preview);
      }

      return {
        success: true,
        message: 'Prompt preview posted as system message for debugging.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to build prompt preview: ${message}` };
    }
  },
};

/**
 * All utility commands
 * 
 * Note: /home is already implemented in homeCommand.ts
 */
export const utilityCommands: Command[] = [
  helpCommand,
  exitCommand,
  testPromptCommand,
];
