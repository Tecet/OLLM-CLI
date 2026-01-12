import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShellExecutionService } from '../shellExecutionService.js';
import { EnvironmentSanitizationService } from '../environmentSanitization.js';

describe('ShellExecutionService', () => {
  let service: ShellExecutionService;
  let sanitizationService: EnvironmentSanitizationService;

  beforeEach(() => {
    sanitizationService = new EnvironmentSanitizationService();
    service = new ShellExecutionService(sanitizationService);
  });

  describe('execute', () => {
    it('should execute a simple command and return output', async () => {
      const result = await service.execute({
        command: 'echo "hello world"',
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('hello world');
    });

    it('should execute command in specified working directory', async () => {
      const result = await service.execute({
        command: process.platform === 'win32' ? 'cd' : 'pwd',
        cwd: process.cwd(),
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.output.trim()).toContain(process.cwd());
    });

    it('should capture stderr output', async () => {
      // Use a command that writes to stderr
      const result = await service.execute({
        command: 'node -e "console.error(\'error message\')"',
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('error message');
      expect(result.error).toContain('error message');
    });

    it('should return non-zero exit code for failed commands', async () => {
      const result = await service.execute({
        command: 'exit 1',
        timeout: 5000,
      });

      expect(result.exitCode).toBe(1);
    });

    it('should stream output via callback', async () => {
      const chunks: string[] = [];
      
      await service.execute({
        command: 'echo "line1" && echo "line2"',
        timeout: 5000,
        onOutput: (chunk: string) => chunks.push(chunk),
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('line1');
      expect(chunks.join('')).toContain('line2');
    });

    it('should timeout long-running commands', async () => {
      const command = process.platform === 'win32' 
        ? 'powershell -Command "Start-Sleep -Seconds 10"'
        : 'sleep 10';
      
      await expect(
        service.execute({
          command,
          timeout: 100,
        })
      ).rejects.toThrow('Command timed out after 100ms');
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      const command = process.platform === 'win32' 
        ? 'powershell -Command "Start-Sleep -Seconds 10"'
        : 'sleep 10';
      
      // Start a long-running command
      const promise = service.execute({
        command,
        timeout: 30000,
        abortSignal: abortController.signal,
      });

      // Abort after a short delay
      setTimeout(() => abortController.abort(), 100);

      await expect(promise).rejects.toThrow('Command cancelled');
    });

    it('should reject if abort signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      await expect(
        service.execute({
          command: 'echo "test"',
          timeout: 5000,
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow('Command cancelled');
    });

    it('should handle command not found errors', async () => {
      const result = await service.execute({
        command: 'nonexistentcommand12345',
        timeout: 5000,
      });

      // On Windows, shell commands that don't exist return exit code 1
      // On Unix, they may throw an error
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle idle timeout', async () => {
      // Command that outputs once then waits
      const command = process.platform === 'win32'
        ? 'powershell -Command "Write-Output start; Start-Sleep -Seconds 5"'
        : 'echo "start" && sleep 5';
      
      await expect(
        service.execute({
          command,
          timeout: 30000,
          idleTimeout: 500,
        })
      ).rejects.toThrow('Command idle timeout after 500ms of no output');
    });
  });

  describe('background execution', () => {
    it('should start background process and return immediately', async () => {
      const command = process.platform === 'win32'
        ? 'powershell -Command "Start-Sleep -Seconds 5"'
        : 'sleep 5';
      
      const result = await service.execute({
        command,
        timeout: 1000,
        background: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.processId).toBeDefined();
      expect(result.processId).toBeGreaterThan(0);
      expect(result.output).toContain('Background process started');
    });
  });

  describe('environment sanitization', () => {
    it('should sanitize sensitive environment variables', async () => {
      // Set a sensitive env var
      const originalEnv = process.env.TEST_SECRET;
      process.env.TEST_SECRET = 'my-secret-value';

      try {
        const envVarSyntax = process.platform === 'win32' ? '%TEST_SECRET%' : '$TEST_SECRET';
        const result = await service.execute({
          command: `echo ${envVarSyntax}`,
          timeout: 5000,
        });

        // The sensitive variable should be removed, so the shell will output the variable name itself
        // (since the variable doesn't exist in the sanitized environment)
        expect(result.output).not.toContain('my-secret-value');
        // On Windows, undefined variables are echoed as %VAR%, on Unix as empty or $VAR
        if (process.platform === 'win32') {
          expect(result.output).toContain('%TEST_SECRET%');
        }
      } finally {
        // Restore original env
        if (originalEnv !== undefined) {
          process.env.TEST_SECRET = originalEnv;
        } else {
          delete process.env.TEST_SECRET;
        }
      }
    });

    it('should allow non-sensitive environment variables', async () => {
      const envVarSyntax = process.platform === 'win32' ? '%PATH%' : '$PATH';
      const result = await service.execute({
        command: `echo ${envVarSyntax}`,
        timeout: 5000,
      });

      // PATH should be preserved and expanded
      expect(result.output.trim()).not.toBe(envVarSyntax);
      // Should contain actual path content, not the variable syntax
      if (process.platform === 'win32') {
        expect(result.output).not.toContain('%PATH%');
      } else {
        expect(result.output).not.toContain('$PATH');
      }
    });
  });
});
