import React from 'react';
import { render, Text } from 'ink';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package.json path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Version component
const VersionDisplay: React.FC = () => <Text>{version}</Text>;

// Help component
const HelpDisplay: React.FC = () => (
  <>
    <Text bold>OLLM CLI - Local-first command-line interface for open-source LLMs</Text>
    <Text></Text>
    <Text bold>Usage:</Text>
    <Text> ollm [options]</Text>
    <Text></Text>
    <Text bold>Options:</Text>
    <Text> --version Show version number</Text>
    <Text> --help Show help information</Text>
  </>
);

// Parse arguments
const argv = yargs(hideBin(process.argv))
  .version(false) // Disable yargs built-in version
  .help(false) // Disable yargs built-in help
  .option('version', {
    type: 'boolean',
    description: 'Show version number',
  })
  .option('help', {
    type: 'boolean',
    description: 'Show help information',
  })
  .strict()
  .fail((msg, err) => {
    if (err) throw err;
    console.error(`Error: ${msg}`);
    process.exit(1);
  })
  .parseSync();

// Handle flags
if (argv.version) {
  render(<VersionDisplay />);
  process.exit(0);
}

if (argv.help) {
  render(<HelpDisplay />);
  process.exit(0);
}

// Default: show help if no flags provided
render(<HelpDisplay />);
process.exit(0);
