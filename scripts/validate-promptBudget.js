#!/usr/bin/env node

/**
 * Prompt Budget Validation Script
 *
 * Validates that all prompt templates fit within their tier budgets.
 * Analyzes both template-only and full prompt sizes (template + mandates).
 *
 * Usage:
 *   node scripts/validate-promptBudget.js
 *   npm run validate:prompts
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tier budgets (updated 2026-01-29)
const TIER_BUDGETS = {
  tier1: 450, // Was 400, increased for mandates (267 tokens)
  tier2: 700, // Was 500, increased for mandates
  tier3: 1000,
  tier4: 1500,
  tier5: 1500,
};

// Approximate token count (4 chars = 1 token)
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// Read mandates content
function getMandatesTokens() {
  const mandatesPath = join(
    __dirname,
    '../packages/core/src/prompts/templates/system/CoreMandates.txt'
  );
  const content = readFileSync(mandatesPath, 'utf-8');
  return countTokens(content);
}

// Read sanity checks content
function getSanityTokens() {
  const sanityPath = join(
    __dirname,
    '../packages/core/src/prompts/templates/system/SanityChecks.txt'
  );
  const content = readFileSync(sanityPath, 'utf-8');
  return countTokens(content);
}

// Parse tier from filename (e.g., "tier1.txt" -> "tier1")
function parseTier(filename) {
  const match = filename.match(/^tier(\d+)\.txt$/);
  return match ? `tier${match[1]}` : null;
}

// Get mode from directory name
function _getMode(dirPath) {
  const parts = dirPath.split(/[/\\]/);
  return parts[parts.length - 1];
}

// Analyze a single template file
function analyzeTemplate(filepath, filename, mode) {
  const content = readFileSync(filepath, 'utf-8');
  const tier = parseTier(filename);

  if (!tier) {
    return null;
  }

  const templateTokens = countTokens(content);
  const budget = TIER_BUDGETS[tier];

  return {
    tier,
    mode,
    templateTokens,
    budget,
    templateUsage: ((templateTokens / budget) * 100).toFixed(0),
    templateAvailable: budget - templateTokens,
  };
}

// Main analysis
function main() {
  console.log('🔍 Prompt Budget Validation\n');
  console.log('='.repeat(80));

  const templatesDir = join(__dirname, '../packages/core/src/prompts/templates');

  // Get all mode directories
  const modeDirs = readdirSync(templatesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (modeDirs.length === 0) {
    console.error('❌ No mode directories found in', templatesDir);
    process.exit(1);
  }

  // Get mandates and sanity token counts
  const mandatesTokens = getMandatesTokens();
  const sanityTokens = getSanityTokens();

  console.log(`\n📊 Component Sizes:`);
  console.log(`   Mandates: ~${mandatesTokens} tokens (always included)`);
  console.log(`   Sanity Checks: ~${sanityTokens} tokens (optional)`);
  console.log(`   Skills: Variable (depends on active skills)`);
  console.log(`   Tools/Hooks: Not currently added\n`);

  // Group by tier
  const byTier = {};

  // Scan all mode directories
  for (const modeDir of modeDirs) {
    const modePath = join(templatesDir, modeDir);
    const files = readdirSync(modePath).filter((f) => f.endsWith('.txt'));

    for (const file of files) {
      const filepath = join(modePath, file);
      const result = analyzeTemplate(filepath, file, modeDir);

      if (!result) continue;

      if (!byTier[result.tier]) {
        byTier[result.tier] = [];
      }
      byTier[result.tier].push(result);
    }
  }

  // Analyze each tier
  let hasErrors = false;
  let hasWarnings = false;

  for (const [tier, results] of Object.entries(byTier).sort()) {
    const budget = TIER_BUDGETS[tier];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 ${tier.toUpperCase()} (Budget: ${budget} tokens)`);
    console.log('='.repeat(80));

    console.log('\n📄 Template Only:');
    console.log('─'.repeat(80));
    console.log(
      'Mode'.padEnd(15),
      'Tokens'.padEnd(10),
      'Usage'.padEnd(10),
      'Available'.padEnd(12),
      'Status'
    );
    console.log('─'.repeat(80));

    for (const result of results.sort((a, b) => a.mode.localeCompare(b.mode))) {
      const status =
        result.templateTokens > budget
          ? '❌ EXCEEDS'
          : result.templateUsage >= 80
            ? '⚠️  High'
            : '✅ Good';

      console.log(
        result.mode.padEnd(15),
        result.templateTokens.toString().padEnd(10),
        `${result.templateUsage}%`.padEnd(10),
        result.templateAvailable.toString().padEnd(12),
        status
      );
    }

    console.log('\n📝 Full Prompt (Template + Mandates ~' + mandatesTokens + ' tokens):');
    console.log('─'.repeat(80));
    console.log(
      'Mode'.padEnd(15),
      'Total'.padEnd(10),
      'Usage'.padEnd(10),
      'Available'.padEnd(12),
      'Status'
    );
    console.log('─'.repeat(80));

    for (const result of results.sort((a, b) => a.mode.localeCompare(b.mode))) {
      const fullTokens = result.templateTokens + mandatesTokens;
      const fullUsage = ((fullTokens / budget) * 100).toFixed(0);
      const fullAvailable = budget - fullTokens;

      let status;
      if (fullTokens > budget) {
        status = '❌ EXCEEDS';
        hasErrors = true;
      } else if (fullUsage >= 90) {
        status = '⚠️  Tight';
        hasWarnings = true;
      } else {
        status = '✅ Good';
      }

      console.log(
        result.mode.padEnd(15),
        `~${fullTokens}`.padEnd(10),
        `${fullUsage}%`.padEnd(10),
        fullAvailable.toString().padEnd(12),
        status
      );
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary');
  console.log('='.repeat(80));

  if (hasErrors) {
    console.log('\n❌ VALIDATION FAILED');
    console.log('   Some prompts exceed their tier budgets.');
    console.log('   Action required: Increase tier budgets or simplify templates.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  WARNINGS FOUND');
    console.log('   Some prompts are very tight (>90% utilization).');
    console.log('   Consider increasing budgets or monitoring for issues.');
    process.exit(0);
  } else {
    console.log('\n✅ ALL PROMPTS VALID');
    console.log('   All prompts fit within their tier budgets.');
    process.exit(0);
  }
}

// Run
try {
  main();
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
