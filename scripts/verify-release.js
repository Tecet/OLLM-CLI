#!/usr/bin/env node

/**
 * Release Verification Script
 * 
 * This script verifies that a published npm package is working correctly by:
 * 1. Checking npm registry for the published version
 * 2. Installing the package in a temporary directory
 * 3. Verifying the ollm command is available
 * 4. Verifying ollm --version returns the correct version
 * 5. Running a basic smoke test
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { execSync, spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PACKAGE_NAME = '@ollm/cli';
const COMMAND_NAME = 'ollm';

/**
 * Execute a command and return the output
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {string} Command output
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Log a step with formatting
 * @param {string} message - Message to log
 */
function logStep(message) {
  console.log(`\n✓ ${message}`);
}

/**
 * Log an error with formatting
 * @param {string} message - Error message
 */
function logError(message) {
  console.error(`\n✗ ${message}`);
}

/**
 * Exit with error
 * @param {string} message - Error message
 * @param {number} code - Exit code
 */
function exitWithError(message, code = 1) {
  logError(message);
  process.exit(code);
}

/**
 * Step 1: Check npm registry for published version
 * Requirement 11.1
 */
function checkNpmRegistry() {
  console.log('\n=== Step 1: Checking npm registry ===');
  
  try {
    const output = exec(`npm info ${PACKAGE_NAME} version`);
    
    if (!output) {
      exitWithError(`Package ${PACKAGE_NAME} not found on npm registry`);
    }
    
    logStep(`Package ${PACKAGE_NAME} found on npm registry (version: ${output})`);
    return output;
  } catch (error) {
    exitWithError(`Failed to check npm registry: ${error.message}`);
  }
}

/**
 * Step 2: Test installation in temp directory
 * Requirement 11.2
 */
function testInstallation(version) {
  console.log('\n=== Step 2: Testing installation ===');
  
  let tempDir;
  
  try {
    // Create temporary directory
    tempDir = mkdtempSync(join(tmpdir(), 'ollm-verify-'));
    logStep(`Created temporary directory: ${tempDir}`);
    
    // Install package globally with custom prefix
    const npmPrefix = join(tempDir, 'npm-global');
    console.log(`Installing ${PACKAGE_NAME}@${version}...`);
    
    exec(`npm install -g ${PACKAGE_NAME}@${version} --prefix "${npmPrefix}"`, {
      cwd: tempDir,
    });
    
    logStep(`Successfully installed ${PACKAGE_NAME}@${version}`);
    
    return { tempDir, npmPrefix };
  } catch (error) {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Warning: Failed to cleanup temp directory: ${cleanupError.message}`);
      }
    }
    exitWithError(`Installation failed: ${error.message}`);
  }
}

/**
 * Step 3: Verify ollm command is available
 * Requirement 11.3
 */
function verifyCommandAvailable(npmPrefix) {
  console.log('\n=== Step 3: Verifying command availability ===');
  
  try {
    // Construct the path to the installed binary
    const binPath = process.platform === 'win32'
      ? join(npmPrefix, COMMAND_NAME + '.cmd')
      : join(npmPrefix, 'bin', COMMAND_NAME);
    
    // Check if the command exists by trying to execute it with --help
    const env = {
      ...process.env,
      PATH: `${join(npmPrefix, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    };
    
    exec(`${COMMAND_NAME} --help`, { env });
    
    logStep(`Command '${COMMAND_NAME}' is available and executable`);
    return env;
  } catch (error) {
    exitWithError(`Command '${COMMAND_NAME}' is not available: ${error.message}`);
  }
}

/**
 * Step 4: Verify ollm --version returns correct version
 * Requirement 11.4
 */
function verifyVersion(env, expectedVersion) {
  console.log('\n=== Step 4: Verifying version ===');
  
  try {
    const output = exec(`${COMMAND_NAME} --version`, { env });
    
    // The version output might include the package name or just the version
    // Extract version number from output
    const versionMatch = output.match(/\d+\.\d+\.\d+/);
    
    if (!versionMatch) {
      exitWithError(`Could not parse version from output: ${output}`);
    }
    
    const actualVersion = versionMatch[0];
    
    if (actualVersion !== expectedVersion) {
      exitWithError(
        `Version mismatch: expected ${expectedVersion}, got ${actualVersion}`
      );
    }
    
    logStep(`Version verified: ${actualVersion}`);
  } catch (error) {
    exitWithError(`Version check failed: ${error.message}`);
  }
}

/**
 * Step 5: Run basic smoke test
 * Requirement 11.5
 */
function runSmokeTest(env) {
  console.log('\n=== Step 5: Running smoke test ===');
  
  return new Promise((resolve, reject) => {
    // Run a simple command with a timeout
    // Note: This is a basic test - in a real scenario, you might want to test
    // with an actual Ollama instance, but for verification we just check
    // that the command can be invoked
    
    const child = spawn(COMMAND_NAME, ['--help'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set a timeout for the command
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Smoke test timed out after 10 seconds'));
    }, 10000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        logStep('Smoke test passed: command executed successfully');
        resolve();
      } else {
        reject(new Error(`Smoke test failed with exit code ${code}\nStderr: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Smoke test failed: ${error.message}`));
    });
  });
}

/**
 * Cleanup temporary directory
 */
function cleanup(tempDir) {
  if (tempDir) {
    try {
      console.log('\n=== Cleanup ===');
      rmSync(tempDir, { recursive: true, force: true });
      logStep('Cleaned up temporary directory');
    } catch (error) {
      console.warn(`Warning: Failed to cleanup temp directory: ${error.message}`);
    }
  }
}

/**
 * Main verification flow
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         OLLM CLI Release Verification Script              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  let tempDir;
  
  try {
    // Step 1: Check npm registry
    const version = checkNpmRegistry();
    
    // Step 2: Test installation
    const { tempDir: td, npmPrefix } = testInstallation(version);
    tempDir = td;
    
    // Step 3: Verify command availability
    const env = verifyCommandAvailable(npmPrefix);
    
    // Step 4: Verify version
    verifyVersion(env, version);
    
    // Step 5: Run smoke test
    await runSmokeTest(env);
    
    // Success!
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ✓ ALL CHECKS PASSED                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nPackage ${PACKAGE_NAME}@${version} is working correctly!\n`);
    
    cleanup(tempDir);
    process.exit(0);
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                  ✗ VERIFICATION FAILED                     ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error(`\nError: ${error.message}\n`);
    
    cleanup(tempDir);
    process.exit(1);
  }
}

// Run the verification
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
