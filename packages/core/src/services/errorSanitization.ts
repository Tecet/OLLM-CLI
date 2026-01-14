/**
 * Error Message Sanitization Utility
 *
 * Scans error messages for sensitive patterns and redacts them to prevent
 * API keys, secrets, tokens, and other credentials from appearing in logs.
 */

// @ts-ignore - picomatch doesn't have type definitions
import picomatch from 'picomatch';

/**
 * Patterns that indicate sensitive data in error messages
 * These patterns match common formats for API keys, tokens, and secrets
 */
const SENSITIVE_PATTERNS = [
  // Environment variable patterns
  '*_KEY=*',
  '*_SECRET=*',
  '*_TOKEN=*',
  '*_PASSWORD=*',
  '*_CREDENTIAL=*',
  'AWS_*=*',
  'GITHUB_*=*',
  'OPENAI_*=*',
  'ANTHROPIC_*=*',

  // Common key formats
  'Bearer *',
  'Basic *',
  'api_key=*',
  'apiKey=*',
  'access_token=*',
  'accessToken=*',
  'client_secret=*',
  'clientSecret=*',
];

/**
 * Regular expressions for detecting sensitive data patterns
 */
const SENSITIVE_REGEXES = [
  // API keys (alphanumeric strings of 20+ characters)
  /\b[A-Za-z0-9]{20,}\b/g,

  // JWT tokens (three base64 segments separated by dots)
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,

  // AWS access keys (AKIA followed by 16 alphanumeric characters)
  /\bAKIA[A-Z0-9]{16}\b/g,

  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_ followed by alphanumeric)
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,

  // Generic secrets (quoted strings that look like keys)
  /"[A-Za-z0-9+/=]{32,}"/g,
  /'[A-Za-z0-9+/=]{32,}'/g,

  // Base64 encoded strings (likely secrets)
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

/**
 * Replacement text for redacted sensitive data
 */
const REDACTED_TEXT = '[REDACTED]';

/**
 * Sanitize an error message by removing sensitive data
 *
 * @param message - The error message to sanitize
 * @returns The sanitized error message with sensitive data redacted
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) {
    return message;
  }

  let sanitized = message;

  // Apply regex-based redaction
  for (const regex of SENSITIVE_REGEXES) {
    sanitized = sanitized.replace(regex, REDACTED_TEXT);
  }

  // Apply pattern-based redaction for key=value pairs
  // Look for patterns like KEY_NAME=value and redact the value
  const keyValuePattern = /([A-Z_]+(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z_]*)=([^\s,;]+)/gi;
  sanitized = sanitized.replace(keyValuePattern, (match, key, value) => {
    return `${key}=${REDACTED_TEXT}`;
  });

  return sanitized;
}

/**
 * Sanitize an Error object by redacting sensitive data from its message
 *
 * @param error - The error to sanitize
 * @returns A new Error with sanitized message
 */
export function sanitizeError(error: Error): Error {
  const sanitizedMessage = sanitizeErrorMessage(error.message);
  const sanitizedError = new Error(sanitizedMessage);
  sanitizedError.name = error.name;
  sanitizedError.stack = error.stack
    ? sanitizeErrorMessage(error.stack)
    : undefined;
  return sanitizedError;
}

/**
 * Sanitize any value that might contain sensitive data
 * Handles strings, errors, and objects
 *
 * @param value - The value to sanitize
 * @returns The sanitized value
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeErrorMessage(value);
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (typeof value === 'object' && value !== null) {
    // For objects, sanitize string properties
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Check if a string contains potentially sensitive data
 *
 * @param text - The text to check
 * @returns True if the text appears to contain sensitive data
 */
export function containsSensitiveData(text: string): boolean {
  if (!text) {
    return false;
  }

  // Check against regex patterns
  // Note: We reset lastIndex before each test because the regexes have the 'g' flag
  // which causes .test() to maintain state between calls
  for (const regex of SENSITIVE_REGEXES) {
    regex.lastIndex = 0; // Reset the regex state
    if (regex.test(text)) {
      return true;
    }
  }

  // Check for key=value patterns
  const keyValuePattern = /([A-Z_]+(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z_]*)=/i;
  if (keyValuePattern.test(text)) {
    return true;
  }

  return false;
}
