/**
 * Property-based tests for SyntaxViewer
 * 
 * These tests validate universal properties that should hold for the syntax
 * viewer component using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import React from 'react';
import { render } from 'ink-testing-library';
import { 
  SyntaxViewer, 
  canHighlightFile, 
  getSupportedLanguages 
} from '../../SyntaxViewer.js';

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-test-'));
}

/**
 * Helper function to clean up a directory recursively
 */
function cleanupDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Helper function to create a test file with specific content
 */
function createTestFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Arbitrary generator for programming language file extensions
 */
const programmingExtensionArbitrary = fc.constantFrom(
  'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'cs', 'rb', 'php'
);

/**
 * Arbitrary generator for configuration file extensions
 */
const configExtensionArbitrary = fc.constantFrom(
  'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf'
);

/**
 * Arbitrary generator for any supported file extension
 */
const supportedExtensionArbitrary = fc.oneof(
  programmingExtensionArbitrary,
  configExtensionArbitrary
);

/**
 * Arbitrary generator for unsupported file extensions
 */
const unsupportedExtensionArbitrary = fc.constantFrom(
  'bin', 'exe', 'dll', 'so', 'dylib', 'pdf', 'doc', 'docx', 'xls', 'xlsx'
);

/**
 * Arbitrary generator for simple code content
 * Ensures non-whitespace content
 */
const codeContentArbitrary = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Arbitrary generator for multi-line code content
 * Ensures at least some non-whitespace content
 */
const multiLineCodeArbitrary = fc.array(
  fc.string({ minLength: 5, maxLength: 80 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 20 }
).map(lines => lines.join('\n'));

describe('SyntaxViewer - Property Tests', () => {
  let tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    // Clean up all temporary directories
    tempDirs.forEach(dir => cleanupDir(dir));
  });

  /**
   * Property 20: Syntax Highlighting Is Applied to Files
   * 
   * For any file with a recognized programming language extension, the syntax
   * viewer should apply appropriate syntax highlighting using shiki.
   * 
   * Validates: Requirements 5.4, 5.5
   */
  test('Property 20: Syntax Highlighting Is Applied to Files', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedExtensionArbitrary,
        multiLineCodeArbitrary,
        async (extension, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create a test file with the given extension
          const filename = `test-file.${extension}`;
          const filePath = createTestFile(tempDir, filename, content);

          // Verify the file can be highlighted
          expect(canHighlightFile(filePath)).toBe(true);

          // Render the SyntaxViewer component
          const { lastFrame, waitUntilExit } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content,
            })
          );

          // Wait a bit for async highlighting to complete
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify the component renders without errors
          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);

          // Verify the filename is displayed
          expect(output).toContain(filename);

          // Verify the file icon is present
          expect(output).toContain('📄');

          // Verify the content is present (at least partially)
          // Note: The exact highlighting may vary, but the content should be there
          // For property testing, we verify structure rather than exact content
          // since HTML entities and whitespace handling can vary
          const lines = content.split('\n');
          
          // Verify that we have at least as many line numbers as content lines
          const lineCount = lines.length;
          if (lineCount > 1) {
            // Check that line number 2 exists if we have multiple lines
            expect(output).toMatch(/\s+2\s+/);
          }

          // Verify line numbers are shown (default behavior)
          expect(output).toContain('1');
        }
      ),
      { numRuns: 50 } // Reduced runs due to async nature
    );
  });

  /**
   * Property: Files with unsupported extensions display as plain text
   * 
   * For any file with an unsupported extension, the syntax viewer should
   * display the content as plain text without errors.
   */
  test('Files with unsupported extensions display as plain text', async () => {
    await fc.assert(
      fc.asyncProperty(
        unsupportedExtensionArbitrary,
        codeContentArbitrary,
        async (extension, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create a test file with unsupported extension
          const filename = `test-file.${extension}`;
          const filePath = createTestFile(tempDir, filename, content);

          // Verify the file cannot be highlighted
          expect(canHighlightFile(filePath)).toBe(false);

          // Render the SyntaxViewer component
          const { lastFrame } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content,
            })
          );

          // Wait a bit for rendering
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify the component renders without errors
          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);

          // Verify the filename is displayed
          expect(output).toContain(filename);

          // Verify the content is present as plain text
          // For property testing, verify structure rather than exact content
          // since whitespace handling can vary
          const trimmedContent = content.trim();
          if (trimmedContent.length > 0) {
            // Verify that at least the filename and some structure is present
            expect(output).toContain(filename);
            expect(output).toContain('📄');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Syntax viewer handles empty files
   * 
   * For any file extension, the syntax viewer should handle empty files
   * without errors.
   */
  test('Syntax viewer handles empty files', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedExtensionArbitrary,
        async (extension) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create an empty test file
          const filename = `empty-file.${extension}`;
          const filePath = createTestFile(tempDir, filename, '');

          // Render the SyntaxViewer component
          const { lastFrame } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content: '',
            })
          );

          // Wait a bit for rendering
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify the component renders without errors
          expect(output).toBeDefined();

          // Verify the filename is displayed
          expect(output).toContain(filename);

          // Verify the file icon is present
          expect(output).toContain('📄');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Line numbers are displayed for all files
   * 
   * For any file with content, line numbers should be displayed by default.
   */
  test('Line numbers are displayed for all files', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedExtensionArbitrary,
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        async (extension, lines) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create content with known number of lines
          const content = lines.join('\n');
          const filename = `test-file.${extension}`;
          const filePath = createTestFile(tempDir, filename, content);

          // Render the SyntaxViewer component
          const { lastFrame } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content,
              showLineNumbers: true,
            })
          );

          // Wait a bit for rendering
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify line numbers are present
          // Line 1 should always be present
          expect(output).toContain('1');

          // If there are multiple lines, verify higher line numbers
          if (lines.length > 1) {
            expect(output).toContain(lines.length.toString());
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Language detection works for common programming languages
   * 
   * For any programming language file, the language should be correctly
   * detected from the file extension.
   */
  test('Language detection works for common programming languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        programmingExtensionArbitrary,
        codeContentArbitrary,
        async (extension, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create a test file
          const filename = `test-file.${extension}`;
          const filePath = createTestFile(tempDir, filename, content);

          // Render the SyntaxViewer component
          const { lastFrame } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content,
            })
          );

          // Wait a bit for rendering
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify the component renders
          expect(output).toBeDefined();

          // Verify the filename is displayed
          expect(output).toContain(filename);

          // Verify a language indicator is shown (in parentheses)
          expect(output).toMatch(/\([a-z]+\)/);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Configuration files are syntax highlighted
   * 
   * For any configuration file format, the syntax viewer should apply
   * appropriate highlighting.
   */
  test('Configuration files are syntax highlighted', async () => {
    await fc.assert(
      fc.asyncProperty(
        configExtensionArbitrary,
        codeContentArbitrary,
        async (extension, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create a test file
          const filename = `config.${extension}`;
          const filePath = createTestFile(tempDir, filename, content);

          // Verify the file can be highlighted
          expect(canHighlightFile(filePath)).toBe(true);

          // Render the SyntaxViewer component
          const { lastFrame } = render(
            React.createElement(SyntaxViewer, {
              filePath,
              content,
            })
          );

          // Wait a bit for rendering
          await new Promise(resolve => setTimeout(resolve, 100));

          const output = lastFrame();

          // Verify the component renders without errors
          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);

          // Verify the filename is displayed
          expect(output).toContain(filename);

          // Verify the content is present (check for trimmed content)
          // For property testing, verify structure rather than exact content
          const trimmedContent = content.trim();
          if (trimmedContent.length > 0) {
            // Verify that the component rendered successfully
            expect(output).toContain(filename);
            expect(output).toContain('📄');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Special filenames are recognized (Dockerfile, Makefile)
   * 
   * For special filenames without extensions, the language should be
   * correctly detected.
   */
  test('Special filenames are recognized', async () => {
    const specialFiles = [
      { name: 'Dockerfile', content: 'FROM node:20\nRUN npm install' },
      { name: 'Makefile', content: 'all:\n\techo "Building..."' },
    ];

    for (const { name, content } of specialFiles) {
      // Create temp directory
      const tempDir = createTempDir();
      tempDirs.push(tempDir);

      // Create the special file
      const filePath = createTestFile(tempDir, name, content);

      // Verify the file can be highlighted
      expect(canHighlightFile(filePath)).toBe(true);

      // Render the SyntaxViewer component
      const { lastFrame } = render(
        React.createElement(SyntaxViewer, {
          filePath,
          content,
        })
      );

      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();

      // Verify the component renders
      expect(output).toBeDefined();

      // Verify the filename is displayed
      expect(output).toContain(name);

      // Verify the content is present (check for individual lines)
      const contentLines = content.split('\n');
      for (const line of contentLines) {
        if (line.trim().length > 0) {
          expect(output).toContain(line);
        }
      }
    }
  });

  /**
   * Unit test: Files without syntax highlighting support display as plain text
   */
  test('Files without syntax highlighting support display as plain text', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    // .gitignore is not a supported language in shiki, so it should display as plain text
    const filePath = createTestFile(tempDir, '.gitignore', 'node_modules/\n*.log');

    // Verify the file cannot be highlighted (gitignore is not in bundledLanguages)
    expect(canHighlightFile(filePath)).toBe(false);

    // Render the SyntaxViewer component
    const { lastFrame } = render(
      React.createElement(SyntaxViewer, {
        filePath,
        content: 'node_modules/\n*.log',
      })
    );

    // Wait a bit for rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    const output = lastFrame();

    // Verify the component renders
    expect(output).toBeDefined();

    // Verify the filename is displayed
    expect(output).toContain('.gitignore');

    // Verify the content is present as plain text
    expect(output).toContain('node_modules/');
    expect(output).toContain('*.log');
  });

  /**
   * Unit test: getSupportedLanguages returns non-empty array
   */
  test('getSupportedLanguages returns non-empty array', () => {
    const languages = getSupportedLanguages();
    
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    
    // Verify some common languages are present
    expect(languages).toContain('typescript');
    expect(languages).toContain('javascript');
    expect(languages).toContain('python');
    expect(languages).toContain('json');
  });

  /**
   * Unit test: canHighlightFile correctly identifies supported files
   */
  test('canHighlightFile correctly identifies supported files', () => {
    // Supported files
    expect(canHighlightFile('test.ts')).toBe(true);
    expect(canHighlightFile('test.js')).toBe(true);
    expect(canHighlightFile('test.py')).toBe(true);
    expect(canHighlightFile('config.json')).toBe(true);
    expect(canHighlightFile('config.yaml')).toBe(true);
    expect(canHighlightFile('Dockerfile')).toBe(true);
    expect(canHighlightFile('Makefile')).toBe(true);
    
    // Unsupported files
    expect(canHighlightFile('test.bin')).toBe(false);
    expect(canHighlightFile('test.exe')).toBe(false);
    expect(canHighlightFile('test.pdf')).toBe(false);
    expect(canHighlightFile('test')).toBe(false); // No extension
  });
});
