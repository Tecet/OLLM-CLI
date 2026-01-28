/**
 * FocusedFilesInjector - Utility for injecting focused files into LLM prompts
 *
 * This module provides functions to format focused file content for LLM consumption.
 * It creates a structured section that the LLM can easily parse and reference.
 */

import type { FocusedFile } from './types.js';

/**
 * Maximum file size for focus (8KB)
 */
const MAX_FILE_SIZE = 8 * 1024;

/**
 * Inject focused files into a prompt
 *
 * Creates a structured section with all focused file content that the LLM
 * can reference when answering questions.
 *
 * Format:
 * ```
 * ## Focused Files
 *
 * The following files have been focused for your reference:
 *
 * ### File: /path/to/file1.ts
 * ```typescript
 * [content]
 * ```
 * *Note: File truncated at 8192 bytes (original size: 15000 bytes)*
 *
 * ### File: /path/to/file2.ts
 * ```typescript
 * [content]
 * ```
 * ```
 *
 * @param focusedFiles - Array of focused files
 * @param basePrompt - Optional base prompt to append to (default: empty string)
 * @returns Formatted prompt with focused files section
 */
export function injectFocusedFiles(focusedFiles: FocusedFile[], basePrompt: string = ''): string {
  // If no focused files, return base prompt unchanged
  if (focusedFiles.length === 0) {
    return basePrompt;
  }

  // Build the focused files section
  const focusedSection = buildFocusedFilesSection(focusedFiles);

  // If there's a base prompt, append focused files section
  if (basePrompt) {
    return `${basePrompt}\n\n${focusedSection}`;
  }

  // Otherwise, just return the focused files section
  return focusedSection;
}

/**
 * Build the focused files section
 *
 * @param focusedFiles - Array of focused files
 * @returns Formatted focused files section
 */
function buildFocusedFilesSection(focusedFiles: FocusedFile[]): string {
  const fileBlocks = focusedFiles.map((file) => {
    const truncationWarning = file.truncated
      ? `\n*Note: File truncated at ${MAX_FILE_SIZE} bytes (original size: ${file.size} bytes)*\n`
      : '';

    // Detect language from file extension for syntax highlighting hint
    const language = detectLanguage(file.path);

    return `### File: ${file.path}${truncationWarning}\n\`\`\`${language}\n${file.content}\n\`\`\``;
  });

  return `## Focused Files

The following files have been focused for your reference. You can refer to them when answering questions or making suggestions.

${fileBlocks.join('\n\n')}`;
}

/**
 * Detect programming language from file path
 *
 * @param filePath - Path to the file
 * @returns Language identifier for syntax highlighting
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'text',
  };

  return languageMap[ext || ''] || 'text';
}

/**
 * Get a summary of focused files for display
 *
 * @param focusedFiles - Array of focused files
 * @returns Summary string (e.g., "3 files (24.5 KB)")
 */
export function getFocusedFilesSummary(focusedFiles: FocusedFile[]): string {
  if (focusedFiles.length === 0) {
    return 'No files focused';
  }

  const totalSize = focusedFiles.reduce((sum, file) => sum + file.size, 0);
  const sizeKB = (totalSize / 1024).toFixed(1);

  const fileWord = focusedFiles.length === 1 ? 'file' : 'files';

  return `${focusedFiles.length} ${fileWord} (${sizeKB} KB)`;
}

/**
 * Check if focused files exceed a size threshold
 *
 * @param focusedFiles - Array of focused files
 * @param thresholdBytes - Threshold in bytes (default: 32KB)
 * @returns true if total size exceeds threshold
 */
export function exceedsSizeThreshold(
  focusedFiles: FocusedFile[],
  thresholdBytes: number = 32 * 1024
): boolean {
  const totalSize = focusedFiles.reduce((sum, file) => sum + file.size, 0);
  return totalSize > thresholdBytes;
}
