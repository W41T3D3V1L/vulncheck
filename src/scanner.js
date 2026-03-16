import chalk from 'chalk';
import ora from 'ora';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { glob } from 'glob';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import boxen from 'boxen';
import cliProgress from 'cli-progress';
import gradient from 'gradient-string';
import { scanDependencies, generateDepReport } from './deps.js';

const SEVERITY_ORDER  = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_COLORS = {
  critical: chalk.bgRed.white.bold,
  high:     chalk.red.bold,
  medium:   chalk.yellow.bold,
  low:      chalk.cyan,
};
const SEVERITY_ICONS = { critical: '💀', high: '🔴', medium: '🟡', low: '🔵' };

function severityBadge(sev) {
  const s = (sev || 'low').toLowerCase();
  return SEVERITY_COLORS[s]?.(`[ ${s.toUpperCase()} ]`) || chalk.gray(`[${s}]`);
}

function printSectionHeader(title) {
  console.log('\n' + chalk.dim('─'.repeat(60)));
  console.log(gradient(['#ff6b35', '#ffcc00'])(` ❯ ${title}`));
  console.log(chalk.dim('─'.repeat(60)));
}

function printBugFound(filePath, bug) {
  const sev = (bug.severity || 'low').toLowerCase();
  const icon = SEVERITY_ICONS[sev] || '🔵';
  console.log(`\n  ${icon}  ${severityBadge(sev)} ${chalk.bold.white(bug.type || 'Vulnerability')}`);
  console.log(`     ${chalk.dim('File:')} ${chalk.cyan(filePath)}${bug.line ? chalk.dim(':' + bug.line) : ''}`);
  console.log(`     ${chalk.dim('Info:')} ${chalk.white(bug.description)}`);
  if (bug.fix) console.log(`     ${chalk.dim('Fix: ')} ${chalk.green(bug.fix)}`);
}

async function analyzeFileWithGemini(genAI, filePath, content) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `You are a senior security engineer. Analyze the following code for security vulnerabilities, bugs, and bad practices.

File: ${filePath}

\`\`\`
${content.slice(0, 8000)}
\`\`\`

Return ONLY a valid JSON array (no markdown, no explanation). Each object:
{
  "type": "vulnerability type (e.g. SQL Injection, XSS, Hardcoded Secret, Path Traversal, IDOR, etc.)",
  "severity": "critical | high | medium | low",
  "line": <line number or null>,
  "description": "clear one-line explanation of the issue",
  "fix": "short actionable fix recommendation"
}
If no issues found, return []. JSON only.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function scanner({ repoPath, apiKey, outputFile, severity, extensions, maxFiles }) {
  const absRepo = resolve(repoPath);

  if (!existsSync(absRepo)) {
    console.log(chalk.red.bold(`\n✗ Path not found: ${absRepo}\n`));
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // ── 1. Dependency CVE Scan ───────────────────────────────────────
  const { findings: depFindings, manifests } = await scanDependencies(absRepo, apiKey);

  // ── 2. Discover source files ─────────────────────────────────────
  printSectionHeader('DISCOVERING SOURCE FILES');

  const spinner = ora({ text: chalk.dim('Scanning directory tree...'), color: 'yellow', spinner: 'dots2' }).start();

  const patterns = extensions.map(ext => `**/*${ext}`);
  const ignore   = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.next/**', '**/vendor/**', '**/__pycache__/**'];

  let files = [];
  for (const pat of patterns) {
    const found = await glob(pat, { cwd: absRepo, ignore, absolute: true });
    files.push(...found);
  }

  files = [...new Set(files)].filter(f => { try { return statSync(f).isFile(); } catch { return false; } });

  if (files.length > maxFiles) {
    spinner.warn(chalk.yellow(`Found ${files.length} files — limiting to ${maxFiles} (use --max-files to increase)`));
    files = files.slice(0, maxFiles);
  } else {
    spinner.succeed(chalk.green(`Found ${files.length} files to analyze`));
  }

  if (files.length === 0) {
    console.log(chalk.yellow('\n  No files matched. Try --extensions .js,.ts\n'));
  }

  // ── 3. Analyze source files ──────────────────────────────────────
  const allFindings = [];

  if (files.length > 0) {
    printSectionHeader(`ANALYZING ${files.length} FILES WITH GEMINI AI`);

    const progressBar = new cliProgress.SingleBar({
      format: `  ${chalk.cyan('{bar}')} ${chalk.white('{percentage}%')} | ${chalk.dim('{value}/{total} files')} | ${chalk.yellow('{filename}')}`,
      barCompleteChar: '█', barIncompleteChar: '░', hideCursor: true,
    });

    progressBar.start(files.length, 0, { filename: '' });
    const minSev = SEVERITY_ORDER[severity] || 1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rel  = relative(absRepo, file);
      progressBar.update(i, { filename: rel.slice(0, 40) });

      let content;
      try { content = readFileSync(file, 'utf8'); }
      catch { progressBar.update(i + 1, { filename: rel.slice(0, 40) }); continue; }

      if (content.trim().length < 20) { progressBar.update(i + 1, { filename: rel.slice(0, 40) }); continue; }

      let bugs = [];
      try {
        bugs = await analyzeFileWithGemini(genAI, rel, content);
      } catch (err) {
        if (err.message?.includes('quota') || err.message?.includes('429')) {
          progressBar.stop();
          console.log(chalk.red('\n\n  ⚠  Gemini API quota exceeded. Try again later.\n'));
          break;
        }
        progressBar.update(i + 1, { filename: rel.slice(0, 40) });
        continue;
      }

      const filtered = bugs.filter(b => (SEVERITY_ORDER[(b.severity || 'low').toLowerCase()] || 1) >= minSev);

      if (filtered.length > 0) {
        progressBar.stop();
        console.log(`\n  ${chalk.bold.magenta('⚡ Bugs found in')} ${chalk.cyan(rel)}`);
        for (const bug of filtered) {
          printBugFound(rel, bug);
          allFindings.push({ file: rel, ...bug });
        }
        progressBar.start(files.length, i + 1, { filename: '' });
      } else {
        progressBar.update(i + 1, { filename: rel.slice(0, 40) });
      }

      await new Promise(r => setTimeout(r, 300));
    }

    progressBar.update(files.length, { filename: 'done' });
    progressBar.stop();
  }

  // ── 4. Summary ───────────────────────────────────────────────────
  printSectionHeader('SCAN SUMMARY');

  const codeCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of allFindings) { const s = (f.severity || 'low').toLowerCase(); if (codeCounts[s] !== undefined) codeCounts[s]++; }

  const depCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of depFindings) { const s = (f.severity || 'low').toLowerCase(); if (depCounts[s] !== undefined) depCounts[s]++; }

  const totalIssues = allFindings.length + depFindings.length;

  console.log(
    boxen(
      chalk.bold.underline.white('  Code Vulnerabilities\n') +
      `  ${chalk.dim('Files Scanned:')} ${chalk.cyan(files.length)}   ${chalk.dim('Issues:')} ${chalk.yellow(allFindings.length)}\n` +
      `  💀 ${SEVERITY_COLORS.critical('Critical:')} ${codeCounts.critical}   🔴 ${SEVERITY_COLORS.high('High:')} ${codeCounts.high}   🟡 ${SEVERITY_COLORS.medium('Medium:')} ${codeCounts.medium}   🔵 ${SEVERITY_COLORS.low('Low:')} ${codeCounts.low}\n\n` +
      chalk.bold.underline.white('  Dependency CVEs\n') +
      `  ${chalk.dim('Manifests:')}    ${chalk.cyan(manifests.length)}   ${chalk.dim('Issues:')} ${chalk.yellow(depFindings.length)}\n` +
      `  💀 ${SEVERITY_COLORS.critical('Critical:')} ${depCounts.critical}   🔴 ${SEVERITY_COLORS.high('High:')} ${depCounts.high}   🟡 ${SEVERITY_COLORS.medium('Medium:')} ${depCounts.medium}   🔵 ${SEVERITY_COLORS.low('Low:')} ${depCounts.low}\n\n` +
      chalk.bold.white(`  Total Issues: `) + chalk.bold.yellow(totalIssues),
      { borderStyle: 'round', borderColor: totalIssues > 0 ? 'red' : 'green', padding: 1, margin: { left: 2 } }
    )
  );

  // ── 5. Generate Report ───────────────────────────────────────────
  printSectionHeader('GENERATING REPORT');

  const reportSpinner = ora({ text: chalk.dim('Writing markdown report...'), color: 'cyan' }).start();
  const report = generateReport(absRepo, files.length, allFindings, codeCounts, depFindings, depCounts, manifests, severity);
  writeFileSync(outputFile, report, 'utf8');
  reportSpinner.succeed(chalk.green(`Report saved → ${chalk.bold(outputFile)}`));

  const finalMsg = totalIssues === 0
    ? chalk.green.bold('\n  ✅  No vulnerabilities found! Your code looks clean.\n')
    : chalk.red.bold(`\n  ⚠   Found ${totalIssues} issue(s) total. Review: ${outputFile}\n`);
  console.log(finalMsg);
}

function generateReport(repoPath, fileCount, codeFindings, codeCounts, depFindings, depCounts, manifests, severity) {
  const now  = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const total = codeFindings.length + depFindings.length;
  const ICONS = { critical: '💀', high: '🔴', medium: '🟡', low: '🔵' };

  let md = `# 🔍 VulnCheck Security Report

> **Generated:** ${now}  
> **Repository:** \`${repoPath}\`  
> **Files Scanned:** ${fileCount}  
> **Minimum Severity:** \`${severity}\`  
> **Total Issues:** ${total} (${codeFindings.length} code + ${depFindings.length} dependency)

---

## 📊 Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Code Vulnerabilities | ${codeCounts.critical} | ${codeCounts.high} | ${codeCounts.medium} | ${codeCounts.low} | ${codeFindings.length} |
| Dependency CVEs | ${depCounts.critical} | ${depCounts.high} | ${depCounts.medium} | ${depCounts.low} | ${depFindings.length} |
| **Total** | **${codeCounts.critical+depCounts.critical}** | **${codeCounts.high+depCounts.high}** | **${codeCounts.medium+depCounts.medium}** | **${codeCounts.low+depCounts.low}** | **${total}** |

---

`;

  // Dependency section
  md += generateDepReport(depFindings, manifests);
  md += '\n---\n\n';

  // Code section
  md += `## 🧠 Code Vulnerability Analysis\n\n`;

  if (codeFindings.length === 0) {
    md += `> ✅ No code vulnerabilities found.\n\n`;
  } else {
    // Critical/High first
    const critHigh = codeFindings.filter(f => ['critical','high'].includes((f.severity||'').toLowerCase()));
    if (critHigh.length > 0) {
      md += `### 🚨 Critical & High Priority\n\n`;
      for (const f of critHigh) md += fmtCodeFinding(f, ICONS);
    }

    md += `### 📁 All Issues by File\n\n`;
    const byFile = {};
    for (const f of codeFindings) { if (!byFile[f.file]) byFile[f.file] = []; byFile[f.file].push(f); }
    for (const [file, issues] of Object.entries(byFile)) {
      issues.sort((a,b) => (SEVERITY_ORDER[(b.severity||'low').toLowerCase()]||1) - (SEVERITY_ORDER[(a.severity||'low').toLowerCase()]||1));
      md += `#### \`${file}\` — ${issues.length} issue(s)\n\n`;
      for (const i of issues) md += fmtCodeFinding(i, ICONS);
    }
  }

  md += `---\n\n## 🛡️ Recommendations\n\n`;
  md += `1. **Fix Critical and High severity issues immediately.**\n`;
  md += `2. **Run \`npm audit fix\` / \`pip-audit\`** to auto-patch known dependency CVEs.\n`;
  md += `3. **Rotate any exposed secrets** found in code immediately.\n`;
  md += `4. **Sanitize all user inputs** to prevent injection attacks.\n`;
  md += `5. **Re-run VulnCheck** after fixes to verify clean state.\n\n`;
  md += `---\n\n*Report generated by [VulnCheck](https://github.com/whitedevil/vulncheck) · Powered by Google Gemini AI*\n`;

  return md;
}

function fmtCodeFinding(f, ICONS) {
  const sev  = (f.severity || 'low').toLowerCase();
  const icon = ICONS[sev] || '🔵';
  const line = f.line ? `:${f.line}` : '';
  return `#### ${icon} ${f.type || 'Issue'} \`[${sev.toUpperCase()}]\`\n- **File:** \`${f.file}${line}\`\n- **Description:** ${f.description}\n- **Fix:** ${f.fix || 'Review manually.'}\n\n`;
}
