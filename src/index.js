#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { scanner } from './scanner.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

function showBanner() {
  const art = figlet.textSync('VulnCheck', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
  });
  console.log('\n' + gradient(['#ff0040', '#ff6b35', '#ffcc00'])(art));
  console.log(
    boxen(
      chalk.bold.white('🔍  AI-Powered Security Scanner') +
      chalk.gray('  v' + pkg.version) + '\n' +
      chalk.gray('  Powered by Google Gemini · Find bugs before attackers do'),
      { padding: { top: 0, bottom: 0, left: 2, right: 2 }, margin: { top: 0, bottom: 1 }, borderStyle: 'round', borderColor: 'red' }
    )
  );
}

function noKeyError() {
  console.log(
    boxen(
      chalk.red.bold('⚠  No Gemini API Key found!\n\n') +
      chalk.white('Set it via:\n') +
      chalk.cyan('  export GEMINI_API_KEY=your_key_here\n') +
      chalk.white('Or pass it with:\n') +
      chalk.cyan('  node src/index.js --repo . --api-key YOUR_KEY'),
      { borderColor: 'red', borderStyle: 'double', padding: 1 }
    )
  );
  process.exit(1);
}

// Strip any stray positional words like 'scan' so both these work:
//   node index.js --repo ./path
//   node index.js --repo ./path scan   <-- user mistake, still works
const cleanArgs = process.argv.filter((a, i) => i < 2 || a !== 'scan');

program
  .name('vulncheck')
  .description('AI-powered vulnerability scanner for your codebase')
  .version(pkg.version)
  .option('--repo <path>',       'Path to the repository or folder to scan')
  .option('--api-key <key>',     'Google Gemini API key (or set GEMINI_API_KEY env var)')
  .option('--output <file>',     'Output report file name', 'vulncheck-report.md')
  .option('--severity <level>',  'Minimum severity: low | medium | high | critical', 'low')
  .option('--extensions <list>', 'Comma-separated file extensions to scan', '.js,.ts,.py,.go,.java,.php,.rb,.rs,.c,.cpp,.cs,.jsx,.tsx,.vue,.env')
  .option('--max-files <n>',     'Maximum number of files to scan', '50')
  .parse(cleanArgs);

const opts = program.opts();

if (!opts.repo) {
  program.help();
}

showBanner();

const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
if (!apiKey) noKeyError();

scanner({
  repoPath:   opts.repo,
  apiKey,
  outputFile: opts.output,
  severity:   opts.severity,
  extensions: opts.extensions.split(',').map(e => e.trim()),
  maxFiles:   parseInt(opts.maxFiles),
});
