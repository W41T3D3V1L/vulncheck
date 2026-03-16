<div align="center">

```
██╗   ██╗██╗   ██╗██╗     ███╗   ██╗ ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗
██║   ██║██║   ██║██║     ████╗  ██║██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝
██║   ██║██║   ██║██║     ██╔██╗ ██║██║     ███████║█████╗  ██║     █████╔╝ 
╚██╗ ██╔╝██║   ██║██║     ██║╚██╗██║██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ 
 ╚████╔╝ ╚██████╔╝███████╗██║ ╚████║╚██████╗██║  ██║███████╗╚██████╗██║  ██╗
  ╚═══╝   ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
```

# vulncheck

**AI-powered security vulnerability scanner for your entire codebase.**  
Find bugs, detect CVEs, and generate audit reports — all from one CLI command.

[![npm version](https://img.shields.io/npm/v/vulncheck?color=red&style=flat-square)](https://www.npmjs.com/package/vulncheck)
[![npm downloads](https://img.shields.io/npm/dm/vulncheck?color=orange&style=flat-square)](https://www.npmjs.com/package/vulncheck)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-blue?style=flat-square)](https://aistudio.google.com)

</div>

---

## What is VulnCheck?

**vulncheck-ai** is an open-source CLI tool that uses **Google Gemini AI** to scan your project for security vulnerabilities across two dimensions:

- **Code Analysis** — Scans every source file for security bugs like SQL injection, XSS, command injection, hardcoded secrets, path traversal, insecure deserialization, and more.
- **Dependency CVE Detection** — Parses your package manifests and identifies outdated dependencies with known CVEs, showing real CVE IDs, CVSS scores, and upgrade paths.

At the end of every scan, a detailed **Markdown report** is generated that you can share with your team, include in audits, or commit to your repo.

---

## Features

- 🤖 **AI-Powered Analysis** — Uses Google Gemini 2.5 Flash to deeply understand code context, not just pattern match
- 📦 **Dependency CVE Scanning** — Supports npm, PyPI, Go, RubyGems, Maven, Packagist, and Cargo
- 🎨 **Beautiful Terminal UI** — Colored output, live progress bar, severity badges, and ASCII art banner
- ⚡ **Live Bug Reporting** — Shows each vulnerability as it's discovered, file by file
- 📄 **Markdown Report** — Auto-generates a professional audit report with executive summary
- 🔍 **Multi-Language Support** — JS, TS, Python, Go, Java, PHP, Ruby, Rust, C, C++, C#, Vue, and more
- 🎯 **Severity Filtering** — Focus only on critical/high issues when you need speed
- 🛡️ **Detects:** SQLi · XSS · RCE · SSRF · Path Traversal · IDOR · Hardcoded Secrets · Insecure Deserialization · Weak Crypto · Command Injection · and more

---

## Installation

**Install globally via npm:**

```bash
npm install -g vulncheck
```

**Or run without installing:**

```bash
npx vulncheck --repo ./my-project
```

**Requirements:**
- Node.js 18 or higher
- A free Google Gemini API key → [Get one here](https://aistudio.google.com/app/apikey)

---

## Setup

Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey), then set it as an environment variable:

**Linux / macOS:**
```bash
export GEMINI_API_KEY=your_api_key_here
```

**Windows (CMD):**
```cmd
set GEMINI_API_KEY=your_api_key_here
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_api_key_here"
```

---

## Usage

### Basic Scan

```bash
vulncheck --repo ./my-project
```

### Scan with Custom Output File

```bash
vulncheck --repo ./my-project --output security-audit.md
```

### Only Report High and Critical Issues

```bash
vulncheck --repo ./my-project --severity high
```

### Scan Specific File Types Only

```bash
vulncheck --repo ./my-project --extensions .js,.ts,.jsx
```

### Scan More Files (default is 50)

```bash
vulncheck --repo ./my-project --max-files 200
```

### Pass API Key Inline

```bash
vulncheck --repo ./my-project --api-key YOUR_GEMINI_KEY
```

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--repo <path>` | Path to the folder or repository to scan | *(required)* |
| `--api-key <key>` | Your Gemini API key | `$GEMINI_API_KEY` |
| `--output <file>` | Name of the generated report file | `vulncheck-report.md` |
| `--severity <level>` | Minimum severity to report: `low` \| `medium` \| `high` \| `critical` | `low` |
| `--extensions <list>` | Comma-separated list of file extensions to scan | `.js,.ts,.py,.go,...` |
| `--max-files <n>` | Maximum number of source files to scan | `50` |

---

## Example Output

```
 ❯ DEPENDENCY CVE SCAN
────────────────────────────────────────────────
  📦 Found 1 manifest file(s):
     package.json → 6 packages [npm]

✔ package.json — 8 issue(s) found

  💀  [ CRITICAL ] node-serialize@0.0.4
     CVE-2017-1000062  CVSS 9.8  Remote Code Execution via insecure deserialization
     Issue: Allows arbitrary JS code execution during deserialization
     Fix:   Remove/replace this package immediately

  🔴  [ HIGH ] lodash@4.17.4
     CVE-2021-23339  CVSS 7.3  Prototype Pollution
     Issue: Versions before 4.17.21 allow prototype pollution attacks
     Fix:   upgrade to v4.17.21

 ❯ ANALYZING 12 FILES WITH GEMINI AI
────────────────────────────────────────────────
  ████████████████████ 100% | 12/12 files | done

  ⚡ Bugs found in src/auth/login.js

  💀  [ CRITICAL ] SQL Injection
     File: src/auth/login.js:42
     Info: User input directly concatenated into SQL query without sanitization
     Fix:  Use parameterized queries or a query builder like Knex.js

  🔴  [ HIGH ] Hardcoded Secret
     File: src/auth/login.js:8
     Info: JWT secret key hardcoded as a string literal in source code
     Fix:  Move to environment variable: process.env.JWT_SECRET
```

---

## Generated Report

Every scan produces a Markdown report (`vulncheck-report.md` by default) containing:

- **Executive Summary** — table of all findings by severity across code and dependencies
- **Dependency CVE Section** — each vulnerable package with CVE ID, CVSS score, and NVD link
- **Code Vulnerability Section** — critical/high issues highlighted first, then grouped by file
- **Remediation Recommendations** — actionable next steps

Example report structure:

```
# 🔍 VulnCheck Security Report

## 📊 Executive Summary
| Category          | Critical | High | Medium | Low | Total |
|-------------------|----------|------|--------|-----|-------|
| Code Vulns        | 2        | 4    | 1      | 3   | 10    |
| Dependency CVEs   | 1        | 3    | 0      | 0   | 4     |

## 📦 Dependency CVE Scan
### `package.json` — npm
#### 💀 `node-serialize@0.0.4` — [CRITICAL]
- **CVE:** [CVE-2017-1000062](https://nvd.nist.gov/vuln/detail/CVE-2017-1000062)
- **CVSS Score:** 9.8
...

## 🧠 Code Vulnerability Analysis
### 🚨 Critical & High Priority
#### 💀 SQL Injection `[CRITICAL]`
- **File:** `src/auth/login.js:42`
...
```

---

## Supported Ecosystems

| Manifest File | Ecosystem | Language |
|---------------|-----------|----------|
| `package.json` | npm | JavaScript / TypeScript |
| `requirements.txt` | PyPI | Python |
| `go.mod` | Go modules | Go |
| `Gemfile.lock` | RubyGems | Ruby |
| `pom.xml` | Maven | Java |
| `composer.json` | Packagist | PHP |
| `Cargo.toml` | crates.io | Rust |

---

## Supported Languages (Code Scan)

`.js` `.ts` `.jsx` `.tsx` `.py` `.go` `.java` `.php` `.rb` `.rs` `.c` `.cpp` `.cs` `.vue` `.env`

---

## How It Works

```
vulncheck --repo ./my-project
        │
        ├─ 1. Parse manifest files (package.json, requirements.txt, etc.)
        │      └─ Send dependency list to Gemini → identify CVEs + CVSS scores
        │
        ├─ 2. Discover source files matching --extensions
        │      └─ For each file → send to Gemini → analyze for vulnerabilities
        │
        ├─ 3. Stream results live to terminal as bugs are found
        │
        └─ 4. Generate vulncheck-report.md with full findings + recommendations
```

---

## Limitations

- **AI accuracy** — Gemini may occasionally produce false positives or miss subtle issues. Always verify findings manually.
- **Not a replacement** for dedicated SAST tools like Semgrep, Snyk, or Trivy in production pipelines — use vulncheck as a fast first pass.
- **File limit** — Default cap of 50 files to stay within free API quota. Increase with `--max-files`.
- **Context window** — Files larger than ~8000 characters are truncated before analysis.

---

## Contributing

Contributions are welcome! Feel free to open issues or pull requests for:

- New language/ecosystem support
- Better CVE data sources
- Performance improvements
- Report format improvements

---

## License

MIT © [M33N4N](https://github.com/whitedevil)

---

<div align="center">

Built with ❤️ · Powered by [Google Gemini](https://aistudio.google.com) · Made for developers who care about security

</div>
