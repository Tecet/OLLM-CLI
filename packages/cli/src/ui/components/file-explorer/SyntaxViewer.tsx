/**
 * SyntaxViewer Component
 *
 * Provides syntax-highlighted read-only viewing of files using shiki.
 * Supports common programming languages and configuration formats.
 *
 * Requirements: 5.4, 5.5
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { codeToHtml, bundledLanguages } from 'shiki';

/**
 * Props for SyntaxViewer component
 */
export interface SyntaxViewerProps {
  /** Absolute path to the file being viewed */
  filePath: string;
  /** File content to display */
  content: string;
  /** Optional language override (auto-detected from extension if not provided) */
  language?: string;
  /** Optional theme (defaults to 'github-dark') */
  theme?: string;
  /** Whether to show line numbers (defaults to true) */
  showLineNumbers?: boolean;
}

/**
 * Language mapping from file extensions to shiki language identifiers
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Programming languages
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  r: 'r',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',

  // Configuration formats
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',

  // Markup and documentation
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Data formats
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',

  // Other
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

/**
 * Detect language from file path extension
 */
function detectLanguage(filePath: string): string | null {
  // Check if it's a special filename first (e.g., Dockerfile, Makefile)
  // Use both / and \ as path separators for cross-platform compatibility
  const filename = filePath.split(/[/\\]/).pop()?.toLowerCase();
  if (filename === 'dockerfile') return 'dockerfile';
  if (filename === 'makefile') return 'makefile';

  // Then check extension
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension || extension === filename) return null; // No extension or filename is the extension

  return EXTENSION_TO_LANGUAGE[extension] || null;
}

/**
 * Check if a language is supported by shiki
 */
function isLanguageSupported(language: string): boolean {
  return language in bundledLanguages;
}

/**
 * Convert ANSI-styled HTML to plain text for terminal rendering
 * Shiki outputs HTML, so we need to extract the text content
 */
function htmlToText(html: string): string {
  // Remove HTML tags but preserve line breaks
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text;
}

/**
 * SyntaxViewer component for displaying syntax-highlighted code
 */
export const SyntaxViewer: React.FC<SyntaxViewerProps> = ({
  filePath,
  content,
  language: languageOverride,
  theme = 'github-dark',
  showLineNumbers = true,
}) => {
  const [highlightedContent, setHighlightedContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const highlightCode = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Determine language
        const detectedLanguage = languageOverride || detectLanguage(filePath);

        if (!detectedLanguage) {
          // No language detected, display as plain text
          setHighlightedContent(content);
          setIsLoading(false);
          return;
        }

        // Check if language is supported
        if (!isLanguageSupported(detectedLanguage)) {
          // Language not supported, display as plain text
          setHighlightedContent(content);
          setIsLoading(false);
          return;
        }

        // Highlight code using shiki
        const html = await codeToHtml(content, {
          lang: detectedLanguage,
          theme: theme,
        });

        // Convert HTML to plain text for terminal display
        const text = htmlToText(html);
        setHighlightedContent(text);
      } catch (err) {
        // If highlighting fails, fall back to plain text
        console.error('Syntax highlighting error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHighlightedContent(content);
      } finally {
        setIsLoading(false);
      }
    };

    highlightCode();
  }, [filePath, content, languageOverride, theme]);

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="gray">Loading syntax highlighting...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">⚠ Syntax highlighting failed: {error}</Text>
        <Text color="gray">Displaying as plain text:</Text>
        <Box marginTop={1}>
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  // Split content into lines for line number display
  const lines = highlightedContent.split('\n');

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan" bold>
          📄 {filePath.split(/[/\\]/).pop()}
        </Text>
        <Text color="gray"> ({detectLanguage(filePath) || 'text'})</Text>
      </Box>

      <Box flexDirection="column">
        {lines.map((line, index) => (
          <Box key={index}>
            {showLineNumbers && (
              <Box width={4} marginRight={1}>
                <Text color="gray">{(index + 1).toString().padStart(3, ' ')}</Text>
              </Box>
            )}
            <Text>{line}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(bundledLanguages);
}

/**
 * Check if a file can be syntax highlighted based on its extension
 */
export function canHighlightFile(filePath: string): boolean {
  const language = detectLanguage(filePath);
  return language !== null && isLanguageSupported(language);
}
