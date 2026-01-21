/**
 * Unit tests for FocusedFilesPanel component
 * 
 * Tests the display of focused files with paths, sizes, truncation warnings,
 * and total content size.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { FocusedFilesPanel } from '../../FocusedFilesPanel.js';
import { FileFocusProvider } from '../../FileFocusContext.js';
import type { FocusedFile } from '../../types.js';

describe('FocusedFilesPanel', () => {
  const mockFile1: FocusedFile = {
    path: '/home/user/project/src/index.ts',
    content: 'console.log("test");',
    truncated: false,
    size: 21,
  };

  const mockFile2: FocusedFile = {
    path: '/home/user/project/src/utils/helper.ts',
    content: 'export function helper() {}',
    truncated: false,
    size: 27,
  };

  const mockLargeFile: FocusedFile = {
    path: '/home/user/project/src/large.ts',
    content: 'x'.repeat(8192),
    truncated: true,
    size: 10000,
  };

  it('should render empty state when no files are focused', () => {
    const { lastFrame } = render(
      <FileFocusProvider>
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Focused Files');
    expect(output).toContain('No files focused');
    expect(output).toContain("Press 'f' on a file to focus it");
  });

  it('should render single focused file with path and size', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFile1.path, mockFile1],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: mockFile1.content.length,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Focused Files');
    expect(output).toContain('(1 file)');
    expect(output).toContain('📌');
    expect(output).toContain('index.ts');
    expect(output).toContain('Size: 21 B');
    expect(output).toContain('Total content size:');
  });

  it('should render multiple focused files', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFile1.path, mockFile1],
      [mockFile2.path, mockFile2],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: mockFile1.content.length + mockFile2.content.length,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('(2 files)');
    expect(output).toContain('index.ts');
    expect(output).toContain('helper.ts');
  });

  it('should display truncation warning for large files', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockLargeFile.path, mockLargeFile],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: mockLargeFile.content.length,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('large.ts');
    expect(output).toContain('⚠');
    expect(output).toContain('Truncated');
    expect(output).toContain('8.0 KB');
  });

  it('should display total content size', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFile1.path, mockFile1],
      [mockFile2.path, mockFile2],
    ]);

    const totalSize = mockFile1.content.length + mockFile2.content.length;

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Total content size:');
    expect(output).toContain('47 B'); // Actual content length
  });

  it('should use custom title when provided', () => {
    const { lastFrame } = render(
      <FileFocusProvider>
        <FocusedFilesPanel title="My Custom Title" />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('My Custom Title');
    expect(output).not.toContain('Focused Files');
  });

  it('should hide details when showDetails is false', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFile1.path, mockFile1],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: mockFile1.content.length,
        }}
      >
        <FocusedFilesPanel showDetails={false} />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('index.ts');
    expect(output).not.toContain('Size:');
    expect(output).not.toContain('Total content size:');
  });

  it('should format bytes correctly for different sizes', () => {
    const files = [
      { ...mockFile1, size: 500 },
      { ...mockFile2, size: 1500, content: 'x'.repeat(1500) },
      { ...mockLargeFile, size: 1024 * 1024, content: 'x'.repeat(1024 * 1024) },
    ];

    const initialFiles = new Map<string, FocusedFile>([
      [files[0].path, files[0]],
      [files[1].path, files[1]],
      [files[2].path, files[2]],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: files[0].size + files[1].size + files[2].size,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('500 B');
    expect(output).toContain('1.5 KB');
    expect(output).toContain('1.0 MB');
  });

  it('should display focus indicator for all files', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFile1.path, mockFile1],
      [mockFile2.path, mockFile2],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: mockFile1.content.length + mockFile2.content.length,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    // Count occurrences of the pin emoji (should be 2, one for each file)
    const pinCount = (output.match(/📌/g) || []).length;
    expect(pinCount).toBe(2);
  });

  it('should shorten long paths for display', () => {
    const longPathFile: FocusedFile = {
      path: '/very/long/path/to/some/deeply/nested/directory/file.ts',
      content: 'test',
      truncated: false,
      size: 4,
    };

    const initialFiles = new Map<string, FocusedFile>([
      [longPathFile.path, longPathFile],
    ]);

    const { lastFrame } = render(
      <FileFocusProvider
        initialState={{
          focusedFiles: initialFiles,
          totalSize: longPathFile.content.length,
        }}
      >
        <FocusedFilesPanel />
      </FileFocusProvider>
    );

    const output = lastFrame();
    // Should show ellipsis for long paths
    expect(output).toContain('...');
    expect(output).toContain('file.ts');
  });
});
