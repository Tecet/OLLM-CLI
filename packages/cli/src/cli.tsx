import React from 'react';
import { render, Text } from 'ink';
import Yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig } from './config/configLoader.js';
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

// Parse arguments
const argv = Yargs(hideBin(process.argv))
  .version(false)
  .help(false)
  .strict()
  .fail((msg, err) => {
    if (err) throw err;
    console.error(`Error: ${msg}`);
    process.exit(1);
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
  process.exit(0);
}

// Handle help flag
if (argv.help) {
  render(<HelpDisplay />);
  process.exit(0);
}

// Load configuration
let config: Config;
try {
  const cliOverrides: Partial<Config> = {};
  
  // Apply CLI overrides
  if (argv.model) {
    cliOverrides.model = { ...cliOverrides.model, default: argv.model } as any;
  }
  
  if (argv.provider) {
    cliOverrides.provider = { ...cliOverrides.provider, default: argv.provider } as any;
  }
  
  if (argv.host) {
    // Apply host to the selected provider
    const provider = argv.provider || 'ollama';
    if (provider === 'ollama') {
      cliOverrides.provider = {
        ...cliOverrides.provider,
        ollama: { host: argv.host, timeout: 30000 },
      } as any;
    } else if (provider === 'vllm') {
      cliOverrides.provider = {
        ...cliOverrides.provider,
        vllm: { host: argv.host },
      } as any;
    } else if (provider === 'openai-compatible') {
      cliOverrides.provider = {
        ...cliOverrides.provider,
        openaiCompatible: { host: argv.host },
      } as any;
    }
  }
  
  if (argv.reviewDiffs !== undefined) {
    cliOverrides.review = { ...cliOverrides.review, enabled: argv.reviewDiffs } as any;
  }
  
  if (argv.noReview !== undefined) {
    cliOverrides.review = { ...cliOverrides.review, enabled: !argv.noReview } as any;
  }
  
  config = loadConfig({
    configPath: argv.config,
    cliOverrides: Object.keys(cliOverrides).length > 0 ? cliOverrides : undefined,
  });
} catch (error) {
  console.error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// TODO: Implement model management commands
if (argv.listModels) {
  console.log('Model management not yet implemented');
  process.exit(0);
}

if (argv.pullModel) {
  console.log(`Pull model not yet implemented: ${argv.pullModel}`);
  process.exit(0);
}

if (argv.removeModel) {
  console.log(`Remove model not yet implemented: ${argv.removeModel}`);
  process.exit(0);
}

if (argv.modelInfo) {
  console.log(`Model info not yet implemented: ${argv.modelInfo}`);
  process.exit(0);
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
    
    process.exit(0);
  } catch (error) {
    runner.handleError(error instanceof Error ? error : new Error(String(error)));
  }
}

// Interactive mode - render the TUI
const { App } = await import('./ui/App.js');
render(<App config={config} />, {
  // Ink 6.x anti-flicker options for smooth animation rendering
  incrementalRendering: true,
  maxFps: 30  // Higher FPS for fast animation
});
