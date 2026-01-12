/**
 * Tests for Error Sanitization
 * Feature: services-sessions
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizeErrorMessage,
  sanitizeError,
  sanitizeValue,
  containsSensitiveData,
} from '../errorSanitization.js';

describe('Error Sanitization', () => {
  describe('Property 28: Sensitive data exclusion from errors', () => {
    /**
     * Feature: services-sessions, Property 28: Sensitive data exclusion from errors
     *
     * For any error message or log output from any service, it should not contain
     * values matching sensitive patterns (*_KEY, *_SECRET, *_TOKEN, *_PASSWORD, API keys, etc.).
     *
     * Validates: Requirements 10.7
     */
    it('should remove sensitive data from error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate error messages with embedded sensitive data
          fc.record({
            prefix: fc.string({ minLength: 0, maxLength: 20 }),
            suffix: fc.string({ minLength: 0, maxLength: 20 }),
            sensitiveType: fc.constantFrom('API_KEY', 'SECRET', 'TOKEN'),
            sensitiveValue: fc.oneof(
              // API key format (20-30 alphanumeric characters)
              fc.hexaString({ minLength: 20, maxLength: 30 }),
              // AWS access key format
              fc.hexaString({ minLength: 16, maxLength: 16 })
                .map((s) => `AKIA${s.toUpperCase()}`)
            ),
          }),
          async ({ prefix, suffix, sensitiveType, sensitiveValue }) => {
            // Create error message with sensitive data
            const errorMessage = `${prefix} ${sensitiveType}=${sensitiveValue} ${suffix}`;

            // Sanitize the error message
            const sanitized = sanitizeErrorMessage(errorMessage);

            // The sanitized message should not contain the sensitive value
            expect(sanitized).not.toContain(sensitiveValue);

            // The sanitized message should contain [REDACTED]
            expect(sanitized).toContain('[REDACTED]');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should remove sensitive environment variables from error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            varName: fc.oneof(
              fc.hexaString({ minLength: 4, maxLength: 10 })
                .map((s) => `${s.toUpperCase()}_KEY`),
              fc.hexaString({ minLength: 4, maxLength: 10 })
                .map((s) => `${s.toUpperCase()}_SECRET`)
            ),
            varValue: fc.hexaString({ minLength: 10, maxLength: 30 }),
            context: fc.string({ minLength: 5, maxLength: 30 }),
          }),
          async ({ varName, varValue, context }) => {
            // Create error message with environment variable
            const errorMessage = `${context} ${varName}=${varValue}`;

            // Sanitize the error message
            const sanitized = sanitizeErrorMessage(errorMessage);

            // The sanitized message should not contain the variable value
            expect(sanitized).not.toContain(varValue);

            // The sanitized message should contain [REDACTED]
            expect(sanitized).toContain('[REDACTED]');

            // The variable name should still be present (for debugging)
            expect(sanitized).toContain(varName);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should sanitize Error objects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            message: fc.string({ minLength: 5, maxLength: 30 }),
            sensitiveValue: fc.hexaString({ minLength: 20, maxLength: 30 }),
          }),
          async ({ message, sensitiveValue }) => {
            // Create an error with sensitive data
            const errorMessage = `${message} API_KEY=${sensitiveValue}`;
            const error = new Error(errorMessage);

            // Sanitize the error
            const sanitized = sanitizeError(error);

            // The sanitized error message should not contain the sensitive value
            expect(sanitized.message).not.toContain(sensitiveValue);

            // The sanitized error message should contain [REDACTED]
            expect(sanitized.message).toContain('[REDACTED]');

            // The error name should be preserved
            expect(sanitized.name).toBe(error.name);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should sanitize nested objects with sensitive data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Filter out special JavaScript property names that could cause issues
            normalKey: fc.string({ minLength: 1, maxLength: 10 })
              .filter(s => !['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty'].includes(s)),
            normalValue: fc.string({ minLength: 1, maxLength: 20 }),
            sensitiveValue: fc.hexaString({ minLength: 20, maxLength: 30 }),
          }),
          async ({ normalKey, normalValue, sensitiveValue }) => {
            // Create an object with sensitive data
            const obj = {
              [normalKey]: normalValue,
              error: `Failed with API_KEY=${sensitiveValue}`,
            };

            // Sanitize the object
            const sanitized = sanitizeValue(obj) as Record<string, any>;

            // Normal values should be preserved
            expect(sanitized[normalKey]).toBe(normalValue);

            // Sensitive values should be redacted
            expect(sanitized.error).not.toContain(sensitiveValue);
            expect(sanitized.error).toContain('[REDACTED]');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect sensitive data in strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // AWS access key format (always detected)
            fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 16, maxLength: 16 })
              .map((s) => `AKIA${s}`),
            // Environment variable with sensitive name (KEY=value pattern - always detected)
            fc.tuple(
              fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')), { minLength: 4, maxLength: 10 }),
              fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 10, maxLength: 20 })
            ).map(([name, value]) => `${name}_KEY=${value}`),
            // SECRET= pattern
            fc.tuple(
              fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')), { minLength: 4, maxLength: 10 }),
              fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 10, maxLength: 20 })
            ).map(([name, value]) => `${name}_SECRET=${value}`)
          ),
          async (sensitiveString) => {
            // The string should be detected as containing sensitive data
            expect(containsSensitiveData(sensitiveString)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not detect normal strings as sensitive', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Normal variable assignments only
          fc.tuple(
            fc.constantFrom('NODE_ENV', 'DEBUG', 'PORT', 'HOSTNAME', 'USER', 'HOME'),
            fc.oneof(
              fc.constantFrom('development', 'production', 'test'),
              fc.integer({ min: 1000, max: 9999 }).map(String),
              fc.string({ minLength: 3, maxLength: 10 })
            )
          ),
          async ([name, value]) => {
            const normalString = `${name}=${value}`;
            
            // The string should not be detected as containing sensitive data
            expect(containsSensitiveData(normalString)).toBe(false);

            // Sanitizing should return the same string
            const sanitized = sanitizeErrorMessage(normalString);
            expect(sanitized).toBe(normalString);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should redact API keys in error messages', () => {
      const message = 'Failed to connect: API_KEY=sk_test_1234567890abcdefghij';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('sk_test_1234567890abcdefghij');
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).toContain('API_KEY');
    });

    it('should redact JWT tokens', () => {
      const message = 'Auth failed with token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact AWS access keys', () => {
      const message = 'AWS error: AKIAIOSFODNN7EXAMPLE';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact GitHub tokens', () => {
      const message = 'GitHub API error with token ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact multiple sensitive values in one message', () => {
      const message = 'Error: API_KEY=secret123 and AWS_SECRET_ACCESS_KEY=anothersecret456';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('anothersecret456');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should preserve non-sensitive parts of the message', () => {
      const message = 'Connection failed to database with PASSWORD=abcdef1234567890ABCDEF';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toContain('Connection failed to database');
      expect(sanitized).toContain('PASSWORD');
      expect(sanitized).not.toContain('abcdef1234567890ABCDEF');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should handle empty or null messages', () => {
      expect(sanitizeErrorMessage('')).toBe('');
      expect(sanitizeErrorMessage(null as any)).toBe(null);
      expect(sanitizeErrorMessage(undefined as any)).toBe(undefined);
    });

    it('should sanitize error stack traces', () => {
      const error = new Error('Failed with API_KEY=sk_test_1234567890abcdefghij');
      const sanitized = sanitizeError(error);

      expect(sanitized.message).not.toContain('sk_test_1234567890abcdefghij');
      if (sanitized.stack) {
        expect(sanitized.stack).not.toContain('sk_test_1234567890abcdefghij');
      }
    });

    it('should handle various sensitive patterns', () => {
      const patterns = [
        'DATABASE_PASSWORD=mypass123',
        'AUTH_TOKEN=bearer_token_here',
        'SERVICE_CREDENTIAL=cred123',
        'GITHUB_API_KEY=ghp_token',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
      ];

      for (const pattern of patterns) {
        const sanitized = sanitizeErrorMessage(`Error: ${pattern}`);
        expect(sanitized).toContain('[REDACTED]');
        expect(sanitized).not.toMatch(/=\w+/); // Should not have =value pattern
      }
    });

    it('should detect sensitive data correctly', () => {
      expect(containsSensitiveData('API_KEY=secret')).toBe(true);
      expect(containsSensitiveData('AKIAIOSFODNN7EXAMPLE')).toBe(true);
      expect(containsSensitiveData('ghp_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(containsSensitiveData('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc')).toBe(true);
    });

    it('should not detect normal text as sensitive', () => {
      expect(containsSensitiveData('Normal error message')).toBe(false);
      expect(containsSensitiveData('NODE_ENV=development')).toBe(false);
      expect(containsSensitiveData('PORT=3000')).toBe(false);
      expect(containsSensitiveData('Short text')).toBe(false);
    });
  });
});
