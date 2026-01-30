/**
 * Utility Commands
 *
 * Implements utility commands:
 * - /help - Show help information
 * - /exit - Exit the CLI
 * - /home - Return to launch screen (already implemented in homeCommand.ts)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { ContextTier, OperationalMode, TieredPromptStore } from '@ollm/core';

import { SettingsService } from '../config/settingsService.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';
import { deriveGPUPlacementHints } from '../features/context/gpuHints.js';
import { getLastGPUInfo } from '../features/context/gpuHintStore.js';
import { profileManager } from '../features/profiles/ProfileManager.js';
import { getGlobalFocusedFiles } from '../ui/components/file-explorer/FileFocusContext.js';
import { injectFocusedFiles } from '../ui/components/file-explorer/FocusedFilesInjector.js';

import type { Command, CommandResult } from './types.js';
import type { ContextMessage } from '@ollm/core';

function resolveTierForSize(size: number): ContextTier {
  if (size < 8192) return ContextTier.TIER_1_MINIMAL;
  if (size < 16384) return ContextTier.TIER_2_BASIC;
  if (size < 32768) return ContextTier.TIER_3_STANDARD;
  if (size < 65536) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

function toOperationalMode(mode: string): OperationalMode {
  switch (mode) {
    case 'assistant':
      return OperationalMode.ASSISTANT;
    case 'planning':
      return OperationalMode.PLANNING;
    case 'debugger':
      return OperationalMode.DEBUGGER;
    case 'developer':
    default:
      return OperationalMode.DEVELOPER;
  }
}

function tierToKey(tier: ContextTier): string {
  switch (tier) {
    case ContextTier.TIER_1_MINIMAL:
      return 'tier1';
    case ContextTier.TIER_2_BASIC:
      return 'tier2';
    case ContextTier.TIER_3_STANDARD:
      return 'tier3';
    case ContextTier.TIER_4_PREMIUM:
    case ContextTier.TIER_5_ULTRA:
      return 'tier4';
    default:
      return 'tier3';
  }
}

function loadTierPromptWithFallback(mode: OperationalMode, tier: ContextTier): string {
  try {
    const store = new TieredPromptStore();
    store.load();
    const fromStore = store.get(mode, tier);
    if (fromStore) {
      return fromStore;
    }
  } catch (_error) {
    // Ignore and fall back to direct file lookup.
  }

  const tierKey = tierToKey(tier);
  const candidates = [
    join(process.cwd(), 'packages', 'core', 'dist', 'prompts', 'templates', mode, `${tierKey}.txt`),
    join(process.cwd(), 'packages', 'core', 'src', 'prompts', 'templates', mode, `${tierKey}.txt`),
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, 'utf8').trim();
        if (content) {
          return content;
        }
      }
    } catch (_e) {
      // ignore and keep trying
    }
  }

  return '';
}

function stripSection(source: string, section: string): string {
  if (!section) return source;
  const trimmed = source.trim();
  const target = section.trim();
  if (!target) return source;
  const index = trimmed.indexOf(target);
  if (index === -1) return source;
  const before = trimmed.slice(0, index).trim();
  const after = trimmed.slice(index + target.length).trim();
  return [before, after].filter(Boolean).join('\n\n').trim();
}

function buildStructuredContent(input: {
  systemPrompt: string;
  tierPrompt: string;
  toolNote: string | null;
  userMessages: string[];
  toolNames: string[];
}): Record<string, string[]> {
  let rules = input.systemPrompt;
  rules = stripSection(rules, input.tierPrompt);
  if (input.toolNote) {
    rules = stripSection(rules, input.toolNote);
  }

  return {
    rules: rules ? [rules] : [],
    systemPrompt: input.tierPrompt ? [input.tierPrompt] : [],
    userMessage: input.userMessages,
    directives: input.toolNote ? [input.toolNote] : [],
    tools: input.toolNames,
  };
}

function formatTierLabel(tier: ContextTier): string {
  switch (tier) {
    case ContextTier.TIER_1_MINIMAL:
      return 'Tier 1';
    case ContextTier.TIER_2_BASIC:
      return 'Tier 2';
    case ContextTier.TIER_3_STANDARD:
      return 'Tier 3';
    case ContextTier.TIER_4_PREMIUM:
      return 'Tier 4';
    case ContextTier.TIER_5_ULTRA:
      return 'Tier 5';
    default:
      return 'Tier';
  }
}

function formatModeLabel(mode: string): string {
  if (!mode) return 'Mode';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function buildPromptPreviewMessage(input: {
  optionsText: string;
  systemHeader: string;
  systemPrompt: string;
  rules: string;
  mockUserMessage: string;
  payloadJson: string;
  showPayload: boolean;
}): string {
  const spacer = '\n\n';
  const payloadSpacer = '\n\n\n';
  const payloadBlock = input.showPayload
    ? `=== Ollama Payload (JSON) ===\n${input.payloadJson}`
    : '=== Ollama Payload (collapsed) ===\nUse `/test prompt --full` to show the full JSON payload.';

  return [
    '=== Options ===',
    input.optionsText,
    spacer,
    `=== ${input.systemHeader} ===`,
    input.systemPrompt || '<empty>',
    spacer,
    '=== Rules ===',
    input.rules || '<empty>',
    spacer,
    '=== Mock User Message ===',
    input.mockUserMessage,
    payloadSpacer,
    payloadBlock,
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
      message:
        'OLLM CLI - Available Commands:\n\n' +
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
        'System Testing:\n' +
        '  Prompts:\n' +
        '    /test prompt           - Show current prompt/context details\n' +
        '    /test prompt --full    - Include full Ollama payload JSON\n' +
        '    /test prompt --budget  - Include prompt budget validation\n\n' +
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
  usage: '/test prompt [--full] [--budget]',
  handler: async (args: string[] = []): Promise<CommandResult> => {
    try {
      const showPayload = args.includes('--full');
      const showBudget = args.includes('--budget');
      
      const manager = getGlobalContextManager();
      if (!manager) {
        return { success: false, message: 'Context Manager not initialized yet.' };
      }

      const contextMessages = await manager.getContext();

      const settings = SettingsService.getInstance().getSettings();
      const modelId = settings.llm?.model ?? 'llama3.2:3b';
      const modelEntry = profileManager.getModelEntry(modelId);
      
      // Get the actual Ollama context limit from the context manager
      // This is the 85% pre-calculated value that gets sent to Ollama
      const ollamaContextSize = manager.getOllamaContextLimit?.() ?? 
        Math.floor((manager.getUsage().maxTokens || 8192) * 0.85);
      
      const temperature = settings.llm?.temperature ?? 0.1;
      const forcedNumGpu = settings.llm?.forceNumGpu;
      const history = contextMessages
        .filter((m: ContextMessage) => m.role !== 'system')
        .map((m: ContextMessage) => ({
          ...m,
          content: m.content || '',
        }));
      const lastGPUInfo = getLastGPUInfo();
      const gpuHints = deriveGPUPlacementHints(lastGPUInfo, ollamaContextSize);
      const effectiveNumGpu = Number.isFinite(forcedNumGpu) ? forcedNumGpu : gpuHints?.num_gpu;
      const coreManager = manager.getManager?.();
      const coreMode = manager.getCurrentMode?.() ?? coreManager?.getMode?.() ?? 'unknown';
      const effectiveTierEnum = resolveTierForSize(manager.getUsage().maxTokens);
      const expectedTierPrompt = loadTierPromptWithFallback(
        toOperationalMode(coreMode),
        effectiveTierEnum
      );
      let systemPrompt = manager.getSystemPrompt();
      const modelSupportsTools = modelEntry?.tool_support ?? false;
      
      // Get tools for current mode from settings
      const allowedTools = modelSupportsTools 
        ? SettingsService.getInstance().getToolsForMode(coreMode)
        : [];
      
      const toolNote = modelSupportsTools
        ? ''
        : 'Note: This model does not support function calling. Do not attempt to use tools or make tool calls.';

      if (
        !modelSupportsTools &&
        !systemPrompt.includes('Note: This model does not support function calling')
      ) {
        systemPrompt += `\n\n${toolNote}`;
      }

      // Inject focused files for accurate preview
      const focusedFiles = getGlobalFocusedFiles();
      if (focusedFiles.length > 0) {
        systemPrompt = injectFocusedFiles(focusedFiles, systemPrompt);
      }

      const profile = profileManager.findProfile(modelId);
      const thinkingEnabled = profile?.thinking_enabled ?? false;
      const structuredContent = buildStructuredContent({
        systemPrompt,
        tierPrompt: expectedTierPrompt,
        toolNote,
        userMessages: history.filter((m) => m.role === 'user').map((m) => m.content || ''),
        toolNames: allowedTools,
      });
      
      const payloadJson = JSON.stringify(
        {
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...history.map((m) => ({
              role: m.role,
              content: m.content,
              tool_calls: m.toolCalls?.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.args,
                },
              })),
              tool_call_id: m.toolCallId,
            })),
          ],
          tools: [],  // Note: Tools would be populated by provider in actual request
          options: {
            num_ctx: ollamaContextSize,
            temperature: temperature,
            num_gpu: effectiveNumGpu ?? null,
            num_gpu_layers: gpuHints?.gpu_layers ?? null,
          },
          stream: true,
          think: thinkingEnabled,
        },
        null,
        2
      );

      const optionsText = [
        `Model:                    ${modelId}`,
        `Mode:                     ${coreMode}`,
        `Context usage:            ${manager.getUsage().currentTokens} / ${manager.getUsage().maxTokens} (${Math.round(manager.getUsage().percentage)}%)`,
        `Effective context cap:    ${ollamaContextSize} (85% of ${manager.getUsage().maxTokens})`,
        `Temperature:              ${temperature}`,
        `Model supports tools:     ${modelSupportsTools ? 'YES' : 'NO'}`,
        `Tools for this mode:      ${allowedTools.length > 0 ? `${allowedTools.length} tools` : 'NONE'}`,
        `GPU hints:                ${gpuHints ? `num_gpu=${gpuHints.num_gpu}, num_gpu_layers=${gpuHints.gpu_layers}` : 'unavailable'}`,
        `GPU override (settings):  ${Number.isFinite(forcedNumGpu) ? forcedNumGpu : 'none'}`,
        `GPU info:                 ${lastGPUInfo ? `${lastGPUInfo.model ?? lastGPUInfo.vendor ?? 'Unknown'} - ${(lastGPUInfo.vramTotal / (1024 * 1024 * 1024)).toFixed(1)} GB total / ${(lastGPUInfo.vramFree / (1024 * 1024 * 1024)).toFixed(1)} GB free` : 'unavailable'}`,
      ].join('\n');
      
      // Add tools section if any
      let toolsSection = '';
      if (allowedTools.length > 0) {
        toolsSection = `\n\n=== Available Tools (${allowedTools.length}) ===\n${allowedTools.join(', ')}`;
      } else if (modelSupportsTools) {
        toolsSection = `\n\n=== Available Tools ===\nNONE - No tools enabled for ${coreMode} mode`;
      } else {
        toolsSection = `\n\n=== Available Tools ===\nNOT SUPPORTED - Model does not support function calling`;
      }
      
      const systemHeader = `${formatModeLabel(coreMode)} ${formatTierLabel(effectiveTierEnum)}`;
      const preview = buildPromptPreviewMessage({
        optionsText,
        systemHeader,
        systemPrompt,
        rules: structuredContent.rules.join('\n\n') + toolsSection,
        mockUserMessage:
          'Here is a short mock user message for testing prompt structure and output formatting.',
        payloadJson,
        showPayload,
      });

      const addSystemMessage = globalThis.__ollmAddSystemMessage;
      if (typeof addSystemMessage === 'function') {
        addSystemMessage(preview);
        
        // If --budget flag is present, run budget validation
        if (showBudget) {
          try {
            const { execSync } = await import('child_process');
            const budgetOutput = execSync('npm run validate:prompts', {
              encoding: 'utf-8',
              cwd: process.cwd(),
            });
            
            // Format budget output as a system message
            const budgetMessage = `\`\`\`\n${budgetOutput}\n\`\`\``;
            addSystemMessage(budgetMessage);
          } catch (error) {
            // Budget validation failed (exit code 1), but we still want to show the output
            const err = error as { stdout?: string; stderr?: string };
            const output = err.stdout || err.stderr || 'Budget validation failed';
            const budgetMessage = `\`\`\`\n${output}\n\`\`\``;
            addSystemMessage(budgetMessage);
          }
        }
      }

      return {
        success: true,
        message: showBudget 
          ? 'Prompt preview and budget validation posted as system messages.'
          : 'Prompt preview posted as system message for debugging.',
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
export const utilityCommands: Command[] = [helpCommand, exitCommand, testPromptCommand];
