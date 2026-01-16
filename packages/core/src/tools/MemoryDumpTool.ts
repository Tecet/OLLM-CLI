
import { promises as fs } from 'fs';
import * as path from 'path';
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
}

export class MemoryDumpTool implements DeclarativeTool<MemoryDumpParams, ToolResult> {
  name = 'write_memory_dump';
  displayName = 'Write Memory Dump';
  schema: ToolSchema = {
    name: 'write_memory_dump',
    description: 'Writes a "brain dump" of your current thoughts, confusion, or plan to a file. Use this when you are stuck, confused, or need to rethink your approach without consuming context window.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The thought process, analysis, or plan to write.',
        },
        filename: {
          type: 'string',
          description: 'Optional filename suffix (e.g. "debug_analysis"). Defaults to timestamp.',
        }
      },
      required: ['content'],
    },
  };

  createInvocation(
    params: MemoryDumpParams,
    _context: ToolContext
  ): ToolInvocation<MemoryDumpParams, ToolResult> {
    return new MemoryDumpInvocation(params);
  }
}

export class MemoryDumpInvocation implements ToolInvocation<MemoryDumpParams, ToolResult> {
  constructor(public params: MemoryDumpParams) {}

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
      const dumpDir = path.join(process.cwd(), '.ollm', 'memory');
      await fs.mkdir(dumpDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = this.params.filename ? `${timestamp}_${this.params.filename}` : `dump_${timestamp}`;
      const filePath = path.join(dumpDir, `${name}.md`);

      await fs.writeFile(filePath, this.params.content, 'utf8');

      const msg = `Memory dump written to ${filePath}. Use 'read_file' if you need to recall this later.`;
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
           type: 'MemoryDumpError'
         }
       };
    }
  }
}
