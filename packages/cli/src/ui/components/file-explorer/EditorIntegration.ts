/**
 * EditorIntegration Service
 * 
 * Handles spawning external text editors for file editing.
 * Supports $EDITOR environment variable with fallback to platform defaults.
 * 
 * Requirements:
 * - 5.1: Spawn editor specified in $EDITOR environment variable
 * - 5.2: Fall back to nano (Unix) or notepad (Windows)
 * - 5.3: Reload file content after editor exits
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { platform } from 'os';
import { PathSanitizer } from './PathSanitizer.js';

/**
 * Result of opening a file in an editor
 */
export interface EditorResult {
  /** Whether the editor exited successfully */
  success: boolean;
  /** Exit code from the editor process */
  exitCode: number | null;
  /** Error message if the editor failed to spawn or crashed */
  error?: string;
}

/**
 * EditorIntegration service for spawning external text editors
 */
export class EditorIntegration {
  private pathSanitizer: PathSanitizer;
  private currentEditorProcess: any = null;

  constructor(pathSanitizer?: PathSanitizer) {
    this.pathSanitizer = pathSanitizer || new PathSanitizer();
  }

  /**
   * Get the editor command to use
   * 
   * Checks $EDITOR environment variable first, then falls back to:
   * - nano on Unix-like systems (Linux, macOS)
   * - notepad on Windows
   * 
   * @returns The editor command to execute
   */
  getEditorCommand(): string {
    // Check $EDITOR environment variable
    const editorEnv = process.env.EDITOR;
    if (editorEnv && editorEnv.trim()) {
      return editorEnv.trim();
    }

    // Fall back to platform defaults
    const currentPlatform = platform();
    if (currentPlatform === 'win32') {
      return 'notepad';
    } else {
      // Unix-like systems (Linux, macOS, etc.)
      return 'nano';
    }
  }

  /**
   * Open a file in an external editor
   * 
   * Spawns the editor process and waits for it to exit.
   * The editor is spawned with stdio: 'inherit' to allow terminal interaction.
   * 
   * @param filePath - Absolute path to the file to edit
   * @returns Promise that resolves when the editor exits
   * @throws Error if the file path is unsafe or the editor fails to spawn
   */
  async openInEditor(filePath: string): Promise<EditorResult> {
    // Validate path safety
    if (!this.pathSanitizer.isPathSafe(filePath)) {
      throw new Error(`Unsafe file path: ${filePath}`);
    }

    const editorCommand = this.getEditorCommand();

    return new Promise((resolve, reject) => {
      try {
        // Spawn the editor process
        // Use stdio: 'inherit' to allow the editor to interact with the terminal
        this.currentEditorProcess = spawn(editorCommand, [filePath], {
          stdio: 'inherit',
          shell: true,
        });

        // Handle process exit
        this.currentEditorProcess.on('exit', (code: number | null) => {
          this.currentEditorProcess = null;
          
          if (code === 0 || code === null) {
            resolve({
              success: true,
              exitCode: code,
            });
          } else {
            resolve({
              success: false,
              exitCode: code,
              error: `Editor exited with code ${code}`,
            });
          }
        });

        // Handle process errors (e.g., editor not found)
        this.currentEditorProcess.on('error', (err: Error) => {
          this.currentEditorProcess = null;
          reject(new Error(`Failed to spawn editor '${editorCommand}': ${err.message}`));
        });
      } catch (err) {
        this.currentEditorProcess = null;
        reject(err);
      }
    });
  }

  /**
   * Wait for the current editor process to exit
   * 
   * This is useful when you need to wait for an editor that was spawned
   * but you don't have the promise from openInEditor.
   * 
   * @returns Promise that resolves when the editor exits
   */
  async waitForEditorExit(): Promise<void> {
    if (!this.currentEditorProcess) {
      return;
    }

    return new Promise((resolve) => {
      this.currentEditorProcess.on('exit', () => {
        resolve();
      });
    });
  }

  /**
   * Reload file content after editing
   * 
   * Reads the file from disk and returns its content.
   * This should be called after the editor exits to get the updated content.
   * 
   * @param filePath - Absolute path to the file to reload
   * @returns Promise that resolves with the file content
   * @throws Error if the file cannot be read
   */
  async reloadFile(filePath: string): Promise<string> {
    // Validate path safety
    if (!this.pathSanitizer.isPathSafe(filePath)) {
      throw new Error(`Unsafe file path: ${filePath}`);
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (err) {
      throw new Error(`Failed to reload file '${filePath}': ${(err as Error).message}`);
    }
  }
}
