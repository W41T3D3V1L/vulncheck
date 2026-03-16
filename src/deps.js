import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// ── Parsers ──────────────────────────────────────────────────────────

function parsePackageJson(repoPath) {
  const file = join(repoPath, 'package.json');
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const deps = { ...data.dependencies, ...data.devDependencies, ...data.peerDependencies };
    const packages = Object.entries(deps).map(([name, version]) => ({
      name,
      version: version.replace(/[\^~>=<*]/g, '').split(' ')[0].trim() || 'latest',
      rawVersion: version,
    })).filter(p => p.name && p.version);
    if (packages.length === 0) return null;
    return { ecosystem: 'npm', file: 'package.json', packages };
  } catch { return null; }
}

function parseRequirementsTxt(repoPath) {
  for (const f of ['requirements.txt', 'requirements-dev.txt', 'requirements/base.txt']) {
    const file = join(repoPath, f);
    if (!existsSync(file)) continue;
    try {
      const packages = readFileSync(file, 'utf8').split('\n')
        .map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
        .map(l => {
          const m = l.match(/^([A-Za-z0-9_.-]+)([>=<!~^]+)(.+)?$/);
          return m ? { name: m[1], version: (m[3]||'').split(',')[0].trim(), rawVersion: l }
                   : { name: l.split('[')[0], version: 'unknown', rawVersion: l };
        }).filter(p => p.name);
      if (packages.length > 0) return { ecosystem: 'pypi', file: f, packages };
    } catch { continue; }
  }
  return null;
}

function parseGoMod(repoPath) {
  const file = join(repoPath, 'go.mod');
  if (!existsSync(file)) return null;
  try {
    const content = readFileSync(file, 'utf8');
    const packages = [];
    for (const block of (content.match(/require\s*\(([\s\S]*?)\)/g) || [])) {
      for (const line of block.split('\n').slice(1,-1)) {
        const m = line.trim().match(/^([^\s]+)\s+v([^\s]+)/);
        if (m) packages.push({ name: m[1], version: m[2], rawVersion: `v${m[2]}` });
      }
    }
    for (const m of content.matchAll(/require\s+([^\s]+)\s+v([^\s]+)/g))
      packages.push({ name: m[1], version: m[2], rawVersion: `v${m[2]}` });
    return packages.length ? { ecosystem: 'go', file: 'go.mod', packages } : null;
  } catch { return null; }
}

function parseGemfile(repoPath) {
  const lockFile = join(repoPath, 'Gemfile.lock');
  const gemFile  = join(repoPath, 'Gemfile');
  const target   = existsSync(lockFile) ? lockFile : existsSync(gemFile) ? gemFile : null;
  if (!target) return null;
  try {
    const packages = [];
    for (const m of readFileSync(target,'utf8').matchAll(/^\s{4}([a-zA-Z0-9_-]+)\s+\(([^)]+)\)/gm))
      packages.push({ name: m[1], version: m[2].split(',')[0], rawVersion: m[2] });
    return packages.length ? { ecosystem: 'rubygems', file: target.includes('lock') ? 'Gemfile.lock' : 'Gemfile', packages } : null;
  } catch { return null; }
}

function parseComposerJson(repoPath) {
  const file = join(repoPath, 'composer.json');
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const packages = Object.entries({ ...data.require, ...data['require-dev'] })
      .filter(([n]) => n !== 'php' && !n.startsWith('ext-'))
      .map(([name, version]) => ({ name, version: version.replace(/[\^~>=<]/g,'').split('|')[0].trim(), rawVersion: version }));
    return packages.length ? { ecosystem: 'packagist', file: 'composer.json', packages } : null;
  } catch { return null; }
}

function parsePomXml(repoPath) {
  const file = join(repoPath, 'pom.xml');
  if (!existsSync(file)) return null;
  try {
    const packages = [];
    for (const m of readFileSync(file,'utf8').matchAll(/<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g))
      packages.push({ name: `${m[1].trim()}:${m[2].trim()}`, version: (m[3]||'unknown').trim().replace(/[\${}]/g,''), rawVersion: m[3]||'unknown' });
    return packages.length ? { ecosystem: 'maven', file: 'pom.xml', packages } : null;
  } catch { return null; }
}

function parseCargoToml(repoPath) {
  const file = join(repoPath, 'Cargo.toml');
  if (!existsSync(file)) return null;
  try {
    const content = readFileSync(file, 'utf8');
    const packages = [];
    const section = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
    if (section) {
      for (const line of section[1].split('\n')) {
        const simple = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
        const table  = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
        if (simple) packages.push({ name: simple[1], version: simple[2].replace(/[\^~>=]/g,''), rawVersion: simple[2] });
        else if (table) packages.push({ name: table[1], version: table[2].replace(/[\^~>=]/g,''), rawVersion: table[2] });
      }
    }
    return packages.length ? { ecosystem: 'crates.io', file: 'Cargo.toml', packages } : null;
  } catch { return null; }
}

// ── Gemini with retry ────────────────────────────────────────────────

async function analyzeWithGemini(genAI, ecosystem, packages, retries = 3) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const pkgList = packages.slice(0, 80).map(p => `${p.name}@${p.version}`).join('\n');

  const prompt = `You are a security engineer specializing in supply chain security and CVE analysis.

Analyze these ${ecosystem} packages and identify ANY security issues including:
1. Known CVEs (provide real CVE IDs where you know them)
2. Packages with known vulnerabilities in these specific versions
3. Severely outdated versions that have security patches in newer versions
4. Deprecated/abandoned packages with unpatched security issues

Packages to analyze:
${pkgList}

IMPORTANT: Be thorough. Many common packages have known CVEs. Check carefully.
Return ONLY a JSON array, no markdown, no explanation:
[{
  "package": "name",
  "version": "version",
  "cve": "CVE-ID or null",
  "severity": "critical|high|medium|low",
  "title": "short title",
  "description": "what the vulnerability does",
  "fix": "upgrade to vX.Y.Z",
  "cvss": 7.5
}]
If nothing found return []. JSON only.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim()
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      const isNetwork = err.message?.toLowerCase().includes('fetch') ||
                        err.message?.toLowerCase().includes('network') ||
                        err.message?.toLowerCase().includes('econnreset') ||
                        err.message?.toLowerCase().includes('timeout');

      if (isNetwork && attempt < retries) {
        // Exponential backoff: 2s, 4s, 8s
        const wait = Math.pow(2, attempt) * 1000;
        process.stdout.write(chalk.dim(`\n     ↻ Network error, retrying in ${wait/1000}s (attempt ${attempt}/${retries})...`));
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err; // Re-throw if not network or out of retries
    }
  }
  return [];
}

// ── Main export ──────────────────────────────────────────────────────

export async function scanDependencies(repoPath, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('\n' + chalk.dim('─'.repeat(60)));
  console.log(gradient(['#ff6b35', '#ffcc00'])(' ❯ DEPENDENCY CVE SCAN'));
  console.log(chalk.dim('─'.repeat(60)));

  const parsers = [parsePackageJson, parseRequirementsTxt, parseGoMod, parseGemfile, parseComposerJson, parsePomXml, parseCargoToml];
  const manifests = parsers.map(p => p(repoPath)).filter(Boolean);

  if (manifests.length === 0) {
    console.log(chalk.dim('\n  No dependency manifests found (package.json, requirements.txt, go.mod, etc.)\n'));
    return { findings: [], manifests: [] };
  }

  console.log(chalk.bold.white(`\n  📦 Found ${manifests.length} manifest file(s):\n`));
  for (const m of manifests) {
    const pkgPreview = m.packages.slice(0, 3).map(p => chalk.dim(p.name + '@' + p.version)).join(', ');
    const more = m.packages.length > 3 ? chalk.dim(` +${m.packages.length - 3} more`) : '';
    console.log(`     ${chalk.cyan(m.file)} ${chalk.dim('→')} ${chalk.yellow(m.packages.length + ' packages')} ${chalk.dim('[' + m.ecosystem + ']')}`);
    console.log(`     ${chalk.dim('└─')} ${pkgPreview}${more}`);
  }
  console.log();

  const allFindings = [];

  for (const manifest of manifests) {
    const spinner = ora({
      text: chalk.dim(`Analyzing ${manifest.packages.length} ${manifest.ecosystem} packages with Gemini...`),
      color: 'yellow',
      spinner: 'dots2',
    }).start();

    let findings = [];
    try {
      findings = await analyzeWithGemini(genAI, manifest.ecosystem, manifest.packages);
      spinner.succeed(
        findings.length > 0
          ? chalk.yellow(`${manifest.file} — ${chalk.bold(findings.length + ' issue(s)')} found`)
          : chalk.green(`${manifest.file} — no issues found`)
      );
    } catch (err) {
      spinner.fail(chalk.red(`${manifest.file} — failed after retries: ${err.message?.slice(0, 80)}`));
      console.log(chalk.dim('     Tip: Check your internet connection or API key permissions.\n'));
      continue;
    }

    if (findings.length > 0) {
      console.log();
      for (const f of findings) {
        const sev  = (f.severity || 'low').toLowerCase();
        const icon = SEVERITY_ICONS[sev] || '🔵';
        const cve  = f.cve ? chalk.dim.underline(f.cve) + '  ' : '';
        const cvss = f.cvss ? chalk.dim(`CVSS ${f.cvss}  `) : '';

        console.log(`  ${icon}  ${severityBadge(sev)} ${chalk.bold.white(f.package + '@' + f.version)}`);
        console.log(`     ${cve}${cvss}${chalk.bold(f.title)}`);
        console.log(`     ${chalk.dim('Issue:')} ${chalk.white(f.description)}`);
        console.log(`     ${chalk.dim('Fix:  ')} ${chalk.green(f.fix)}`);
        console.log();

        allFindings.push({ ...f, manifestFile: manifest.file, ecosystem: manifest.ecosystem });
      }
    }

    await new Promise(r => setTimeout(r, 400));
  }

  if (allFindings.length === 0) {
    console.log(
      boxen(
        chalk.green.bold('✅  No known CVEs detected in your dependencies!\n') +
        chalk.dim('   Note: AI analysis is not a substitute for tools like\n') +
        chalk.dim('   `npm audit`, `pip-audit`, or `trivy` for production use.'),
        { borderColor: 'green', borderStyle: 'round', padding: 1, margin: { left: 2 } }
      )
    );
  }

  return { findings: allFindings, manifests };
}

export function generateDepReport(findings, manifests) {
  if (manifests.length === 0) return '';

  const ICONS = { critical: '💀', high: '🔴', medium: '🟡', low: '🔵' };
  let md = `## 📦 Dependency CVE Scan\n\n### Manifests Scanned\n\n`;
  md += `| File | Ecosystem | Packages |\n|------|-----------|----------|\n`;
  for (const m of manifests) md += `| \`${m.file}\` | ${m.ecosystem} | ${m.packages.length} |\n`;

  if (findings.length === 0) {
    md += `\n> ✅ No known CVEs detected in dependencies.\n`;
    return md;
  }

  md += `\n### Vulnerable Dependencies (${findings.length} found)\n\n`;

  const order = { critical: 4, high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0));

  for (const f of findings) {
    const sev  = (f.severity || 'low').toUpperCase();
    const icon = ICONS[f.severity?.toLowerCase()] || '🔵';
    md += `#### ${icon} \`${f.package}@${f.version}\` — [${sev}]\n\n`;
    if (f.cve)  md += `- **CVE:** [${f.cve}](https://nvd.nist.gov/vuln/detail/${f.cve})\n`;
    if (f.cvss) md += `- **CVSS Score:** ${f.cvss}\n`;
    md += `- **Title:** ${f.title}\n`;
    md += `- **Issue:** ${f.description}\n`;
    md += `- **Fix:** ${f.fix}\n`;
    md += `- **Found in:** \`${f.manifestFile}\` (${f.ecosystem})\n\n`;
  }

  return md;
}
