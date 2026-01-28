import { promises as fs } from 'fs';
import * as path from 'path';

import { PromptModeManager } from '../prompts/PromptModeManager.js';

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';

export interface MemoryDumpParams {
  content: string;
  filename?: string;
  [key: string]: unknown;
}

export class MemoryDumpTool implements DeclarativeTool<MemoryDumpParams, ToolResult> {
  name = 'write_memory_dump';
  displayName = 'Write Memory Dump';
  schema: ToolSchema = {
    name: 'write_memory_dump',
    description:
      'Writes a "brain dump" of your internal reasoning. Use this ONLY when you are in a specialized analysis mode (Debugger, Security, Planning) and need to offload complex context. NEVER use this tool in Assistant mode, on startup, or for simple greetings.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            'The internal thought process, analysis, or detailed plan to offload from context.',
        },
        filename: {
          type: 'string',
          description: 'Optional filename suffix (e.g. "debug_analysis"). Defaults to timestamp.',
        },
      },
      required: ['content'],
    },
  };

  constructor(private modeManager?: PromptModeManager) {}

  createInvocation(
    params: MemoryDumpParams,
    _context: ToolContext
  ): ToolInvocation<MemoryDumpParams, ToolResult> {
    return new MemoryDumpInvocation(params, this.modeManager);
  }
}

export class MemoryDumpInvocation implements ToolInvocation<MemoryDumpParams, ToolResult> {
  constructor(
    public params: MemoryDumpParams,
    private modeManager?: PromptModeManager
  ) {}

  getDescription(): string {
    return `Writing memory dump${this.params.filename ? ` (${this.params.filename})` : ''}`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(_abortSignal: AbortSignal): Promise<false> {
    return false;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Safety check: Prevent memory dump in assistant context
      const currentMode = this.modeManager?.getCurrentMode();
      // const previousMode = this.modeManager?.getPreviousMode();

      // Handle "Tool" mode transition: if we are in 'tool' mode, check what we came from
      // const effectiveMode = (currentMode === 'tool' && previousMode) ? previousMode : currentMode;

      console.log(`[DEBUG] MemoryDumpInvocation. mode: ${currentMode}`);

      // 1. Basic Mode Guard
      if (!currentMode || currentMode === 'assistant') {
        return {
          llmContent: `Memory dump is disabled in ${currentMode || 'undefined'} mode.`,
          returnDisplay: `Error: Memory dump is disabled in ${currentMode || 'undefined'} mode.`,
          error: {
            message: `Memory dump is disabled in ${currentMode || 'undefined'} mode.`,
            type: 'ToolAccessDenied',
          },
        };
      }

      // 2. Greeting Heuristic Guard (Redundant safety)
      // Since MemoryDumpTool doesn't usually have access to history, we rely on the mode guard mostly.
      // However, we can add a check for very short content or keywords if available.
      if (
        this.params.content.length < 20 &&
        (this.params.content.toLowerCase().includes('hi') ||
          this.params.content.toLowerCase().includes('hello'))
      ) {
        return {
          llmContent: `Memory dump refused. Content appears to be a greeting or too short for a brain dump.`,
          returnDisplay: `Refused: Brain dump too short/greeting.`,
          error: {
            message: `Memory dump heuristic guard triggered.`,
            type: 'GuardRefusal',
          },
        };
      }
      const dumpDir = path.join(process.cwd(), '.ollm', 'memory');
      await fs.mkdir(dumpDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = this.params.filename
        ? `${timestamp}_${this.params.filename}`
        : `dump_${timestamp}`;
      const filePath = path.join(dumpDir, `${name}.md`);

      await fs.writeFile(filePath, this.params.content, 'utf8');

      const absolutePath = path.resolve(filePath);
      const msg = `Memory dump written to ${absolutePath}. Use 'read_file' if you need to recall this later.`;
      return {
        llmContent: msg,
        returnDisplay: msg,
      };
    } catch (error) {
      const err = error as Error;
      return {
        llmContent: `Failed to write memory dump: ${err.message}`,
        returnDisplay: `Error: ${err.message}`,
        error: {
          message: err.message,
          type: 'MemoryDumpError',
        },
      };
    }
  }
}
