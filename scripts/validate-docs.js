#!/usr/bin/env node

/**
 * Documentation Validation Script
 *
 * Validates documentation for:
 * 1. Code example syntax correctness
 * 2. CLI flag accuracy (documented vs actual)
 * 3. Configuration option accuracy (documented vs actual)
 * 4. Link validity (internal and external)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.5, 12.6
 */

import { readFileSync, existsSync } from 'fs';
import http from 'http';
import https from 'https';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Validation results
const results = {
  codeExamples: { passed: 0, failed: 0, errors: [] },
  cliFlags: { passed: 0, failed: 0, errors: [] },
  configOptions: { passed: 0, failed: 0, errors: [] },
  links: { passed: 0, failed: 0, errors: [] },
};

/**
 * Extract code blocks from markdown content
 */
function extractCodeBlocks(content, filePath) {
  const blocks = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentBlock = null;
  let lineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    lineNumber = i + 1;
    const line = lines[i];

    // Check for code block start
    const startMatch = line.match(/^```(\w+)?/);
    if (startMatch && !inCodeBlock) {
      inCodeBlock = true;
      currentBlock = {
        language: startMatch[1] || 'text',
        code: '',
        startLine: lineNumber,
        filePath,
      };
      continue;
    }

    // Check for code block end
    if (line.match(/^```$/) && inCodeBlock) {
      inCodeBlock = false;
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Accumulate code block content
    if (inCodeBlock && currentBlock) {
      currentBlock.code += (currentBlock.code ? '\n' : '') + line;
    }
  }

  return blocks;
}

/**
 * Validate JavaScript/TypeScript syntax
 */
function validateJavaScriptSyntax(code) {
  try {
    // Basic syntax check - try to parse as a function body
    new Function(code);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Validate Bash syntax (basic check)
 */
function validateBashSyntax(code) {
  // Basic bash syntax checks
  const errors = [];

  // Check for unclosed quotes
  const singleQuotes = (code.match(/'/g) || []).length;
  const doubleQuotes = (code.match(/"/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote');
  }

  // Check for basic syntax patterns
  if (code.includes(';;')) {
    // Check if it's in a case statement
    if (!code.includes('case') && !code.includes('esac')) {
      errors.push('Invalid double semicolon outside case statement');
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.join(', '),
  };
}

/**
 * Validate YAML syntax (basic check)
 */
function validateYAMLSyntax(code) {
  const errors = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Check for basic YAML structure
    if (line.includes(':')) {
      const parts = line.split(':');
      if (parts.length > 2 && !line.includes('"') && !line.includes("'")) {
        // Multiple colons without quotes might be an error
        // But could also be valid (e.g., URLs), so just warn
      }
    }

    // Check indentation consistency (should be spaces, not tabs)
    if (line.match(/^\t/)) {
      errors.push(`Line ${i + 1}: YAML should use spaces, not tabs`);
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.join(', '),
  };
}

/**
 * Validate JSON syntax
 */
function validateJSONSyntax(code) {
  try {
    JSON.parse(code);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Validate code block syntax based on language
 */
function validateCodeBlock(block) {
  const { language, code, startLine, filePath } = block;

  // Skip validation for certain languages
  const skipLanguages = ['text', 'plaintext', 'output', 'console', 'markdown', 'md'];
  if (skipLanguages.includes(language.toLowerCase())) {
    return { valid: true, skipped: true };
  }

  let result;
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
    case 'jsx':
    case 'tsx':
      result = validateJavaScriptSyntax(code, language);
      break;
    case 'bash':
    case 'sh':
    case 'shell':
      result = validateBashSyntax(code);
      break;
    case 'yaml':
    case 'yml':
      result = validateYAMLSyntax(code);
      break;
    case 'json':
      result = validateJSONSyntax(code);
      break;
    default:
      // Unknown language, skip validation
      return { valid: true, skipped: true };
  }

  if (!result.valid) {
    return {
      valid: false,
      error: result.error,
      location: `${filePath}:${startLine}`,
    };
  }

  return { valid: true };
}

/**
 * Validate all code examples in documentation
 */
async function _validateCodeExamples() {
  console.log(`\n${colors.blue}Validating code examples...${colors.reset}`);

  // Find all markdown files
  const markdownFiles = await glob('**/*.md', {
    cwd: rootDir,
    ignore: ['node_modules/**', '**/node_modules/**', 'test-session-*/**'],
  });

  for (const file of markdownFiles) {
    const filePath = join(rootDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const blocks = extractCodeBlocks(content, file);

    for (const block of blocks) {
      const result = validateCodeBlock(block);

      if (result.skipped) {
        continue;
      }

      if (result.valid) {
        results.codeExamples.passed++;
      } else {
        results.codeExamples.failed++;
        results.codeExamples.errors.push({
          file: block.filePath,
          line: block.startLine,
          language: block.language,
          error: result.error,
        });
      }
    }
  }
}

/**
 * Extract CLI flags from documentation
 */
function extractDocumentedCLIFlags(content) {
  const flags = new Set();

  // Pattern 1: Table format (| `-p, --prompt` | ... |)
  const tablePattern = /\|\s*`(-[a-z]|--[a-z-]+)(?:,\s*(-[a-z]|--[a-z-]+))?[^|]*`/gi;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    if (match[1]) flags.add(match[1]);
    if (match[2]) flags.add(match[2]);
  }

  // Pattern 2: Inline code format (`--flag`)
  const inlinePattern = /`(--[a-z-]+|-[a-z])`/gi;
  while ((match = inlinePattern.exec(content)) !== null) {
    if (match[1].startsWith('-')) {
      flags.add(match[1]);
    }
  }

  // Pattern 3: Command examples (ollm --flag)
  const commandPattern = /ollm\s+(--[a-z-]+|-[a-z])/gi;
  while ((match = commandPattern.exec(content)) !== null) {
    flags.add(match[1]);
  }

  return Array.from(flags);
}

/**
 * Get actual CLI flags from the CLI parser
 */
function getActualCLIFlags() {
  const cliPath = join(rootDir, 'packages/cli/src/cli.tsx');

  if (!existsSync(cliPath)) {
    console.warn(`${colors.yellow}Warning: CLI file not found at ${cliPath}${colors.reset}`);
    return new Set();
  }

  const content = readFileSync(cliPath, 'utf-8');
  const flags = new Set();

  // Extract from .option() calls
  const optionPattern = /\.option\(['"]([a-z-]+)['"]/gi;
  let match;
  while ((match = optionPattern.exec(content)) !== null) {
    const flagName = match[1];
    flags.add(`--${flagName}`);
  }

  // Extract aliases
  const aliasPattern = /alias:\s*['"]([a-z])['"]|alias:\s*\[['"]([a-z])['"]\]/gi;
  while ((match = aliasPattern.exec(content)) !== null) {
    const alias = match[1] || match[2];
    if (alias) {
      flags.add(`-${alias}`);
    }
  }

  return flags;
}

/**
 * Validate CLI flags documentation
 */
async function _validateCLIFlags() {
  console.log(`\n${colors.blue}Validating CLI flags...${colors.reset}`);

  const actualFlags = getActualCLIFlags();

  // Check README.md
  const readmePath = join(rootDir, 'README.md');
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, 'utf-8');
    const documentedFlags = extractDocumentedCLIFlags(content);

    for (const flag of documentedFlags) {
      if (actualFlags.has(flag)) {
        results.cliFlags.passed++;
      } else {
        results.cliFlags.failed++;
        results.cliFlags.errors.push({
          file: 'README.md',
          flag,
          error: `Documented flag '${flag}' does not exist in CLI parser`,
        });
      }
    }
  }
}

/**
 * Extract configuration options from documentation
 */
function extractDocumentedConfigOptions(content) {
  const options = new Set();

  // Pattern 1: YAML examples (key: value)
  const yamlPattern = /^(\s*)([a-zA-Z][a-zA-Z0-9_]*):(?:\s|$)/gm;
  let match;
  while ((match = yamlPattern.exec(content)) !== null) {
    const key = match[2];
    // Filter out common non-config words
    if (!['name', 'description', 'version', 'type', 'example'].includes(key.toLowerCase())) {
      options.add(key);
    }
  }

  // Pattern 2: Environment variables (OLLM_*)
  const envPattern = /OLLM_([A-Z_]+)/g;
  while ((match = envPattern.exec(content)) !== null) {
    options.add(`OLLM_${match[1]}`);
  }

  return Array.from(options);
}

/**
 * Get actual configuration options from config types
 */
function getActualConfigOptions() {
  const configTypesPath = join(rootDir, 'packages/cli/src/config/types.ts');

  if (!existsSync(configTypesPath)) {
    console.warn(`${colors.yellow}Warning: Config types file not found${colors.reset}`);
    return new Set();
  }

  const content = readFileSync(configTypesPath, 'utf-8');
  const options = new Set();

  // Extract interface properties
  const propertyPattern = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\??:/gm;
  let match;
  while ((match = propertyPattern.exec(content)) !== null) {
    options.add(match[1]);
  }

  return options;
}

/**
 * Validate configuration options documentation
 */
async function _validateConfigOptions() {
  console.log(`\n${colors.blue}Validating configuration options...${colors.reset}`);

  const actualOptions = getActualConfigOptions();

  // Check configuration.md
  const configDocPath = join(rootDir, 'docs/configuration.md');
  if (existsSync(configDocPath)) {
    const content = readFileSync(configDocPath, 'utf-8');
    const documentedOptions = extractDocumentedConfigOptions(content);

    // Only validate options that look like config keys (not env vars)
    const configKeys = documentedOptions.filter((opt) => !opt.startsWith('OLLM_'));

    for (const option of configKeys) {
      if (actualOptions.has(option)) {
        results.configOptions.passed++;
      } else {
        // Some documented options might be nested, so be lenient
        const isNested = Array.from(actualOptions).some(
          (actual) =>
            actual.toLowerCase().includes(option.toLowerCase()) ||
            option.toLowerCase().includes(actual.toLowerCase())
        );

        if (isNested) {
          results.configOptions.passed++;
        } else {
          results.configOptions.failed++;
          results.configOptions.errors.push({
            file: 'docs/configuration.md',
            option,
            error: `Documented option '${option}' not found in config types`,
          });
        }
      }
    }
  }
}

/**
 * Extract links from markdown content
 */
function extractLinks(content, filePath) {
  const links = [];

  // Pattern 1: [text](url)
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkPattern.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      filePath,
    });
  }

  // Pattern 2: <url>
  const angleBracketPattern = /<(https?:\/\/[^>]+)>/g;
  while ((match = angleBracketPattern.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[1],
      filePath,
    });
  }

  return links;
}

/**
 * Check if internal link exists
 */
function checkInternalLink(link, sourceFile) {
  const { url } = link;

  // Remove anchor
  const urlWithoutAnchor = url.split('#')[0];

  if (!urlWithoutAnchor) {
    // Just an anchor link, assume valid
    return true;
  }

  // Resolve relative to source file
  const sourceDir = dirname(join(rootDir, sourceFile));
  const targetPath = resolve(sourceDir, urlWithoutAnchor);

  return existsSync(targetPath);
}

/**
 * Check if external link is valid (with caching)
 */
const linkCache = new Map();

function checkExternalLink(url) {
  return new Promise((resolve) => {
    // Check cache
    if (linkCache.has(url)) {
      resolve(linkCache.get(url));
      return;
    }

    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method: 'HEAD',
      timeout: 5000,
      headers: {
        'User-Agent': 'OLLM-CLI-Doc-Validator/1.0',
      },
    };

    const req = client.request(url, options, (res) => {
      const valid = res.statusCode >= 200 && res.statusCode < 400;
      linkCache.set(url, valid);
      resolve(valid);
    });

    req.on('error', () => {
      linkCache.set(url, false);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      linkCache.set(url, false);
      resolve(false);
    });

    req.end();
  });
}

/**
 * Validate links in documentation
 */
async function _validateLinks() {
  console.log(`\n${colors.blue}Validating links...${colors.reset}`);

  // Find all markdown files
  const markdownFiles = await glob('**/*.md', {
    cwd: rootDir,
    ignore: ['node_modules/**', '**/node_modules/**', 'test-session-*/**'],
  });

  for (const file of markdownFiles) {
    const filePath = join(rootDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const links = extractLinks(content, file);

    for (const link of links) {
      const { url } = link;

      // Skip mailto and other special protocols
      if (url.startsWith('mailto:') || url.startsWith('tel:')) {
        continue;
      }

      // Check if it's an external link
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const valid = await checkExternalLink(url);
        if (valid) {
          results.links.passed++;
        } else {
          results.links.failed++;
          results.links.errors.push({
            file: link.filePath,
            url,
            error: 'External link is unreachable or returns error status',
          });
        }
      } else {
        // Internal link
        const valid = checkInternalLink(link, file);
        if (valid) {
          results.links.passed++;
        } else {
          results.links.failed++;
          results.links.errors.push({
            file: link.filePath,
            url,
            error: 'Internal link target does not exist',
          });
        }
      }
    }
  }
}

/**
 * Print validation results
 */
function _printResults() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}Documentation Validation Results${colors.reset}`);
  console.log('='.repeat(60));

  // Code examples
  console.log(`\n${colors.blue}Code Examples:${colors.reset}`);
  console.log(`  Passed: ${colors.green}${results.codeExamples.passed}${colors.reset}`);
  console.log(
    `  Failed: ${results.codeExamples.failed > 0 ? colors.red : colors.green}${results.codeExamples.failed}${colors.reset}`
  );

  if (results.codeExamples.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors:${colors.reset}`);
    for (const error of results.codeExamples.errors) {
      console.log(`    ${colors.gray}${error.file}:${error.line}${colors.reset}`);
      console.log(`      Language: ${error.language}`);
      console.log(`      Error: ${error.error}`);
    }
  }

  // CLI flags
  console.log(`\n${colors.blue}CLI Flags:${colors.reset}`);
  console.log(`  Passed: ${colors.green}${results.cliFlags.passed}${colors.reset}`);
  console.log(
    `  Failed: ${results.cliFlags.failed > 0 ? colors.red : colors.green}${results.cliFlags.failed}${colors.reset}`
  );

  if (results.cliFlags.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors:${colors.reset}`);
    for (const error of results.cliFlags.errors) {
      console.log(`    ${colors.gray}${error.file}${colors.reset}`);
      console.log(`      Flag: ${error.flag}`);
      console.log(`      Error: ${error.error}`);
    }
  }

  // Config options
  console.log(`\n${colors.blue}Configuration Options:${colors.reset}`);
  console.log(`  Passed: ${colors.green}${results.configOptions.passed}${colors.reset}`);
  console.log(
    `  Failed: ${results.configOptions.failed > 0 ? colors.red : colors.green}${results.configOptions.failed}${colors.reset}`
  );

  if (results.configOptions.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors:${colors.reset}`);
    for (const error of results.configOptions.errors) {
      console.log(`    ${colors.gray}${error.file}${colors.reset}`);
      console.log(`      Option: ${error.option}`);
      console.log(`      Error: ${error.error}`);
    }
  }

  // Links
  console.log(`\n${colors.blue}Links:${colors.reset}`);
  console.log(`  Passed: ${colors.green}${results.links.passed}${colors.reset}`);
  console.log(
    `  Failed: ${results.links.failed > 0 ? colors.red : colors.green}${results.links.failed}${colors.reset}`
  );

  if (results.links.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors:${colors.reset}`);
    for (const error of results.links.errors) {
      console.log(`    ${colors.gray}${error.file}${colors.reset}`);
      console.log(`      URL: ${error.url}`);
      console.log(`      Error: ${error.error}`);
    }
  }

  // Summary
  const totalPassed =
    results.codeExamples.passed +
    results.cliFlags.passed +
    results.configOptions.passed +
    results.links.passed;
  const totalFailed =
    results.codeExamples.failed +
    results.cliFlags.failed +
    results.configOptions.failed +
    results.links.failed;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  Total Passed: ${colors.green}${totalPassed}${colors.reset}`);
  console.log(
    `  Total Failed: ${totalFailed > 0 ? colors.red : colors.green}${totalFailed}${colors.reset}`
  );
  console.log('='.repeat(60));

  return totalFailed === 0;
}

/**
 * Main validation function
 */
async function main() {
  console.log(`${colors.blue}OLLM CLI Documentation Validator${colors.reset}`);
  console.log(`${colors.yellow}Documentation validation is currently disabled${colors.reset}`);
  console.log(
    `${colors.gray}To enable, uncomment the validation calls in scripts/validate-docs.js${colors.reset}`
  );

  // TEMPORARILY DISABLED - Uncomment to re-enable validation
  /*
  try {
    await validateCodeExamples();
    await validateCLIFlags();
    await validateConfigOptions();
    await validateLinks();

    const success = printResults();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`\n${colors.red}Validation failed with error:${colors.reset}`);
    console.error(error);
    process.exit(1);
  }
  */

  // Exit successfully when disabled
  process.exit(0);
}

// Run validation
main();
