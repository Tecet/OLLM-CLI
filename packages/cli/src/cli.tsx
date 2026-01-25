import { readFileSync , appendFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import React from 'react';
import { render, Text } from 'ink';
import { hideBin } from 'yargs/helpers';
import Yargs from 'yargs/yargs';

import { loadConfig } from './config/configLoader.js';
import { patchStdio, createWorkingStdio } from './utils/stdio.js';

import type { Config } from './config/types.js';


// Get package.json path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// CLI Options interface
export interface CLIOptions {
  // Execution mode
  prompt?: string;
  
  // Model selection
  model?: string;
  provider?: string;
  host?: string;
  
  // Model management
  listModels?: boolean;
  pullModel?: string;
  removeModel?: string;
  modelInfo?: string;
  
  // Output control
  output?: 'text' | 'json' | 'stream-json';
  reviewDiffs?: boolean;
  noReview?: boolean;
  debug?: boolean;
  noColor?: boolean;
  
  // Configuration
  config?: string;
  session?: string;
  
  // Info
  version?: boolean;
  help?: boolean;
}

// Version component
const VersionDisplay: React.FC = () => <Text>{version}</Text>;

// Help component
const HelpDisplay: React.FC = () => (
  <>
    <Text bold>OLLM CLI - Local-first command-line interface for open-source LLMs</Text>
    <Text></Text>
    <Text bold>Usage:</Text>
    <Text>  ollm [options]</Text>
    <Text></Text>
    <Text bold>Execution Mode:</Text>
    <Text>  -p, --prompt &lt;text&gt;        Execute single prompt (non-interactive)</Text>
    <Text></Text>
    <Text bold>Model Selection:</Text>
    <Text>  -m, --model &lt;name&gt;         Select model to use</Text>
    <Text>  --provider &lt;name&gt;          Select provider (ollama, vllm, openai-compatible)</Text>
    <Text>  --host &lt;url&gt;              Provider endpoint URL</Text>
    <Text></Text>
    <Text bold>Model Management:</Text>
    <Text>  --list-models             List available models</Text>
    <Text>  --pull-model &lt;name&gt;       Download/pull a model</Text>
    <Text>  --remove-model &lt;name&gt;     Remove a model</Text>
    <Text>  --model-info &lt;name&gt;       Show model details</Text>
    <Text></Text>
    <Text bold>Output Control:</Text>
    <Text>  -o, --output &lt;format&gt;     Output format: text, json, stream-json</Text>
    <Text>  --review-diffs            Enable diff review mode</Text>
    <Text>  --no-review               Disable diff review mode</Text>
    <Text>  --debug                   Enable debug output</Text>
    <Text>  --no-color                Disable colored output</Text>
    <Text></Text>
    <Text bold>Configuration:</Text>
    <Text>  -c, --config &lt;path&gt;       Custom config file path</Text>
    <Text>  -s, --session &lt;id&gt;        Resume session by ID</Text>
    <Text></Text>
    <Text bold>Information:</Text>
    <Text>  -v, --version             Show version number</Text>
    <Text>  -h, --help                Show this help message</Text>
  </>
);

export interface RunOptions {
  exitOnComplete?: boolean;
}

export async function mainCLI(argvOverride?: string[], runOptions?: RunOptions) {
  const rawArgv = argvOverride ? [process.execPath, 'cli', ...argvOverride] : process.argv;

  // Parse arguments
  const argv = Yargs(hideBin(rawArgv))
    .parserConfiguration({} as any)
    .version(false)
    .help(false)
    .strict()
    .fail((msg, err) => {
      if (err) throw err;
      console.error(`Error: ${msg}`);
      if (runOptions?.exitOnComplete ?? true) process.exit(1);
      throw new Error(msg);
    })
  // Execution mode
  .option('prompt', {
    alias: 'p',
    type: 'string',
    description: 'Execute single prompt (non-interactive)',
  })
  // Model selection
  .option('model', {
    alias: 'm',
    type: 'string',
    description: 'Select model to use',
  })
  .option('provider', {
    type: 'string',
    description: 'Select provider',
  })
  .option('host', {
    type: 'string',
    description: 'Provider endpoint URL',
  })
  // Model management
  .option('list-models', {
    type: 'boolean',
    description: 'List available models',
  })
  .option('pull-model', {
    type: 'string',
    description: 'Download/pull a model',
  })
  .option('remove-model', {
    type: 'string',
    description: 'Remove a model',
  })
  .option('model-info', {
    type: 'string',
    description: 'Show model details',
  })
  // Output control
  .option('output', {
    alias: 'o',
    type: 'string',
    choices: ['text', 'json', 'stream-json'],
    description: 'Output format',
  })
  .option('review-diffs', {
    type: 'boolean',
    description: 'Enable diff review mode',
  })
  .option('no-review', {
    type: 'boolean',
    description: 'Disable diff review mode',
  })
  .option('debug', {
    type: 'boolean',
    description: 'Enable debug output',
  })
  .option('no-color', {
    type: 'boolean',
    description: 'Disable colored output',
  })
  // Configuration
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Custom config file path',
  })
  .option('session', {
    alias: 's',
    type: 'string',
    description: 'Resume session by ID',
  })
  // Information
  .option('version', {
    alias: 'v',
    type: 'boolean',
    description: 'Show version number',
  })
  .option('help', {
    alias: 'h',
    type: 'boolean',
    description: 'Show help information',
  })
    .parseSync();

  // Handle version flag
  if (argv.version) {
    render(<VersionDisplay />);
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

  // Handle help flag
  if (argv.help) {
    render(<HelpDisplay />);
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

// Load configuration
let config: Config;
try {
  const cliOverrides: any = {};
  
  // Apply CLI overrides
  if (argv.model) {
    cliOverrides.model = { ...(cliOverrides.model ?? {}), default: argv.model };
  }
  
  if (argv.provider) {
    cliOverrides.provider = { ...(cliOverrides.provider ?? {}), default: argv.provider };
  }
  
  if (argv.host) {
    // Apply host to the selected provider
    const provider = argv.provider || 'ollama';
    if (provider === 'ollama') {
      cliOverrides.provider = {
        ...(cliOverrides.provider ?? {}),
        ollama: { host: argv.host, timeout: 30000 },
      };
    } else if (provider === 'vllm') {
      cliOverrides.provider = {
        ...(cliOverrides.provider ?? {}),
        vllm: { host: argv.host },
      };
    } else if (provider === 'openai-compatible') {
      cliOverrides.provider = {
        ...(cliOverrides.provider ?? {}),
        openaiCompatible: { host: argv.host },
      };
    }
  }
  
  if (argv.reviewDiffs !== undefined) {
    cliOverrides.review = { ...(cliOverrides.review ?? {}), enabled: argv.reviewDiffs };
  }
  
  if (argv.noReview !== undefined) {
    cliOverrides.review = { ...(cliOverrides.review ?? {}), enabled: !argv.noReview };
  }
  
  config = loadConfig({
    configPath: argv.config,
    cliOverrides: Object.keys(cliOverrides).length > 0 ? cliOverrides : undefined,
  });
  } catch (error) {
    console.error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
    if (runOptions?.exitOnComplete ?? true) process.exit(1);
    throw error;
  }

// TODO: Implement model management commands
  if (argv.listModels) {
    console.log('Model management not yet implemented');
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

  if (argv.pullModel) {
    console.log(`Pull model not yet implemented: ${argv.pullModel}`);
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

  if (argv.removeModel) {
    console.log(`Remove model not yet implemented: ${argv.removeModel}`);
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

  if (argv.modelInfo) {
    console.log(`Model info not yet implemented: ${argv.modelInfo}`);
    if (runOptions?.exitOnComplete ?? true) process.exit(0);
    return 0;
  }

// Handle non-interactive mode
if (argv.prompt) {
  const { NonInteractiveRunner, readStdin } = await import('./nonInteractive.js');
  
  const runner = new NonInteractiveRunner();
  
  // Check if prompt should come from stdin
  let prompt = argv.prompt;
  if (prompt === '-') {
    const stdinContent = await readStdin();
    if (stdinContent) {
      prompt = stdinContent;
    } else {
      console.error('Error: No input provided via stdin');
      process.exit(1);
    }
  }
  
    try {
      const result = await runner.run({
        prompt,
        model: argv.model,
        provider: argv.provider,
        output: (argv.output as 'text' | 'json' | 'stream-json') || 'text',
        config,
      });

      // Output result
      const output = runner.formatOutput(result, (argv.output as 'text' | 'json' | 'stream-json') || 'text');
      if (output) {
        console.log(output);
      }

      if (runOptions?.exitOnComplete ?? true) process.exit(0);
      return 0;
    } catch (error) {
      runner.handleError(error instanceof Error ? error : new Error(String(error)));
      if (runOptions?.exitOnComplete ?? true) return 1;
      return 1;
    }
}

// Ink requires a TTY-capable stdin for raw mode input handling.
if (!process.stdin.isTTY) {
  console.error('Error: interactive mode requires a TTY-capable stdin.');
  console.error('Tip: use --prompt for non-interactive mode.');
  if (runOptions?.exitOnComplete ?? true) process.exit(1);
  throw new Error('TTY required');
}

// Interactive mode - render the TUI
const { App } = await import('./ui/App.js');

// Patch stdio to prevent stray output from corrupting the TUI
// This redirects all stdout/stderr to an event bus (currently silenced)
// preventing flickering and "jitter" caused by background logs.
patchStdio();
const inkStdio = createWorkingStdio();

// Ensure logs directory exists and register global error handlers so crashes
// are captured to disk for debugging when running the interactive TUI.
try {
  const logDir = join(__dirname, '..', '..', 'logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `cli-errors.log`);

  process.on('uncaughtException', (err) => {
    try {
      const msg = `[uncaughtException] ${new Date().toISOString()} ${err instanceof Error ? err.stack || err.message : String(err)}\n`;
      appendFileSync(logPath, msg);
      console.error(msg);
    } catch {
      // ignore
    }
    // Keep process running briefly to flush logs
    setTimeout(() => process.exit(1), 50);
  });

  process.on('unhandledRejection', (reason) => {
    try {
      const msg = `[unhandledRejection] ${new Date().toISOString()} ${reason instanceof Error ? reason.stack || reason.message : JSON.stringify(reason)}\n`;
      appendFileSync(logPath, msg);
      console.error(msg);
    } catch {
      // ignore
    }
  });
} catch {
  // ignore logging setup errors
}

  render(<App config={config} />, {
  stdout: inkStdio.stdout as typeof process.stdout,
  stderr: inkStdio.stderr as typeof process.stderr,
  // Ink 6.x options
  incrementalRendering: true,
  maxFps: 30,
  patchConsole: false, 
  exitOnCtrlC: true,
  alternateBuffer: true,
} as any);

  return 0;
}

export default mainCLI;

// Call mainCLI when run as a script (not when imported as a module)
// Check if this file is being run directly
// Convert process.argv[1] to a file:// URL for comparison
const scriptPath = process.argv[1];
const scriptUrl = new URL(`file:///${scriptPath.replace(/\\/g, '/')}`).href;
const isMainModule = import.meta.url === scriptUrl;

if (isMainModule) {
  mainCLI().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
