/**
 * FocusSystem - File focus management for LLM context injection
 * 
 * This service manages the focused files list, which represents files that are
 * "pinned" to the LLM context. When files are focused, their content is read,
 * truncated if necessary, and injected into LLM prompts.
 * 
 * Key responsibilities:
 * - Manage focused files list
 * - Read and truncate file content (8KB limit)
 * - Inject focused content into LLM prompts
 * - Sanitize content before injection
 * - Persist focused files across sessions
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 10.5
 */

import * as fs from 'fs/promises';

import { handleError } from './ErrorHandler.js';
import { PathSanitizer } from './PathSanitizer.js';
import { FocusedFile } from './types.js';

import type { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus.js';

/**
 * Maximum file size for focus (8KB)
 */
const MAX_FILE_SIZE = 8 * 1024; // 8KB in bytes

/**
 * FocusSystem service for managing focused files
 */
export class FocusSystem {
  private focusedFiles: Map<string, FocusedFile>;
  private pathSanitizer: PathSanitizer;
  private messageBus?: MessageBus;

  constructor(messageBus?: MessageBus) {
    this.focusedFiles = new Map();
    this.pathSanitizer = new PathSanitizer();
    this.messageBus = messageBus;
  }

  /**
   * Focus a file - read its content and add to focus list
   * 
   * This method:
   * 1. Validates the path for safety
   * 2. Reads the file content
   * 3. Truncates if exceeds 8KB
   * 4. Sanitizes the content
   * 5. Adds to focused files map
   * 
   * @param filePath - Absolute path to the file to focus
   * @returns The focused file with content
   * @throws {Error} If file cannot be read or path is invalid
   */
  async focusFile(filePath: string): Promise<FocusedFile> {
    // Validate and sanitize the path
    const sanitizedPath = this.pathSanitizer.sanitize(filePath);

    // Check if file exists and is readable
    try {
      const stats = await fs.stat(sanitizedPath);
      
      if (!stats.isFile()) {
        throw new Error(`Cannot focus directory: ${sanitizedPath}`);
      }

      // Read file content
      const buffer = await fs.readFile(sanitizedPath);
      const fileSize = buffer.length;
      
      // Determine if truncation is needed
      const truncated = fileSize > MAX_FILE_SIZE;
      const contentBuffer = truncated ? buffer.slice(0, MAX_FILE_SIZE) : buffer;
      
      // Convert to string and sanitize
      let content = contentBuffer.toString('utf-8');
      content = this.sanitizeContent(content);

      // Create focused file object
      const focusedFile: FocusedFile = {
        path: sanitizedPath,
        content,
        truncated,
        size: fileSize,
      };

      // Add to focused files map
      this.focusedFiles.set(sanitizedPath, focusedFile);

      // Emit hook event (using generic event type)
      if (this.messageBus) {
        await this.messageBus.emit('fileEdited' as any, { path: sanitizedPath, size: fileSize });
      }

      return focusedFile;
    } catch (error) {
      const errorInfo = handleError(error, {
        operation: 'focusFile',
        filePath: sanitizedPath,
      });
      
      throw new Error(`Failed to focus file ${sanitizedPath}: ${errorInfo.message}`);
    }
  }

  /**
   * Unfocus a file - remove it from the focus list
   * 
   * @param filePath - Absolute path to the file to unfocus
   */
  unfocusFile(filePath: string): void {
    // Sanitize the path to ensure we're using the same key
    const sanitizedPath = this.pathSanitizer.sanitize(filePath);
    this.focusedFiles.delete(sanitizedPath);

    // Emit hook event (using generic event type)
    if (this.messageBus) {
      this.messageBus.emitSync('fileEdited' as any, { path: sanitizedPath });
    }
  }

  /**
   * Get all focused files
   * 
   * @returns Array of all focused files
   */
  getFocusedFiles(): FocusedFile[] {
    return Array.from(this.focusedFiles.values());
  }

  /**
   * Get the focused files map
   * 
   * @returns Map of file paths to FocusedFile objects
   */
  getFocusedFilesMap(): Map<string, FocusedFile> {
    return this.focusedFiles;
  }

  /**
   * Get total size of all focused files
   * 
   * @returns Total size in bytes
   */
  getTotalFocusedSize(): number {
    let total = 0;
    for (const file of this.focusedFiles.values()) {
      total += file.size;
    }
    return total;
  }

  /**
   * Clear all focused files
   */
  clearAllFocused(): void {
    this.focusedFiles.clear();
  }

  /**
   * Check if a file is currently focused
   * 
   * @param filePath - Absolute path to check
   * @returns true if the file is focused, false otherwise
   */
  isFocused(filePath: string): boolean {
    const sanitizedPath = this.pathSanitizer.sanitize(filePath);
    return this.focusedFiles.has(sanitizedPath);
  }

  /**
   * Inject focused file content into an LLM prompt
   * 
   * This method prepends all focused file content to the prompt in a
   * structured format that the LLM can understand.
   * 
   * Format:
   * ```
   * ## Focused Files
   * 
   * ### File: /path/to/file1.ts
   * [content]
   * 
   * ### File: /path/to/file2.ts
   * [content]
   * 
   * ## User Prompt
   * [original prompt]
   * ```
   * 
   * @param prompt - The original user prompt
   * @returns The prompt with focused file content injected
   */
  injectIntoPrompt(prompt: string): string {
    const focusedFiles = this.getFocusedFiles();

    // If no focused files, return original prompt
    if (focusedFiles.length === 0) {
      return prompt;
    }

    // Build the focused files section
    const focusedSection = focusedFiles
      .map((file) => {
        const truncationWarning = file.truncated
          ? `\n*Note: File truncated at ${MAX_FILE_SIZE} bytes (original size: ${file.size} bytes)*\n`
          : '';
        
        return `### File: ${file.path}${truncationWarning}\n\`\`\`\n${file.content}\n\`\`\``;
      })
      .join('\n\n');

    // Combine focused files with user prompt
    return `## Focused Files\n\n${focusedSection}\n\n## User Prompt\n${prompt}`;
  }

  /**
   * Sanitize file content before LLM injection
   * 
   * This method prevents prompt injection attacks by:
   * 1. Removing null bytes
   * 2. Normalizing line endings
   * 3. Escaping potential prompt injection sequences
   * 
   * @param content - The raw file content
   * @returns Sanitized content safe for LLM injection
   */
  private sanitizeContent(content: string): string {
    // Remove null bytes
    let sanitized = content.replace(/\0/g, '');

    // Normalize line endings to \n
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Note: We don't escape markdown code blocks or other formatting
    // because the content is already wrapped in code blocks in injectIntoPrompt
    // The LLM should be able to handle the content as-is within the structured format

    return sanitized;
  }

  /**
   * Get total size of all focused files
   * 
   * @returns Total size in bytes
   */
  getTotalSize(): number {
    return this.getFocusedFiles().reduce((total, file) => total + file.size, 0);
  }

  /**
   * Clear all focused files
   */
  clearAll(): void {
    this.focusedFiles.clear();
  }

  /**
   * Get the number of focused files
   * 
   * @returns Count of focused files
   */
  getCount(): number {
    return this.focusedFiles.size;
  }
}
