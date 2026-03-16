# 🔍 VulnCheck — AI-Powered Security Scanner

```
██╗   ██╗██╗   ██╗██╗     ███╗   ██╗ ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗
██║   ██║██║   ██║██║     ████╗  ██║██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝
██║   ██║██║   ██║██║     ██╔██╗ ██║██║     ███████║█████╗  ██║     █████╔╝ 
╚██╗ ██╔╝██║   ██║██║     ██║╚██╗██║██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ 
 ╚████╔╝ ╚██████╔╝███████╗██║ ╚████║╚██████╗██║  ██║███████╗╚██████╗██║  ██╗
  ╚═══╝   ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
```

> Scan your entire codebase for security vulnerabilities using Google Gemini AI.

---

## ✨ Features

- 🤖 **AI-Powered** — Uses Google Gemini 1.5 Flash to deeply analyze code
- 🎨 **Beautiful CLI** — Colored output, progress bar, ASCII art banner
- 📄 **Markdown Report** — Auto-generates a detailed `.md` vulnerability report
- 🔍 **Multi-language** — JS, TS, Python, Go, Java, PHP, Ruby, Rust, C/C++, and more
- ⚡ **Live Feedback** — Shows bugs as they're found, file-by-file
- 🎯 **Severity Filter** — Focus on critical/high issues only if needed
- 🛡️ **Detects:** SQLi, XSS, hardcoded secrets, path traversal, IDOR, RCE, and more

---

## 🚀 Install

```bash
# Clone and install globally
git clone https://github.com/yourname/vulncheck
cd vulncheck
npm install
npm link

# Or run directly
node src/index.js --repo <path>
```

---

## 🔑 Setup

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) then:

```bash
export GEMINI_API_KEY=your_key_here
```

---

## 📖 Usage

```bash
# Basic scan
vulncheck --repo ./my-project

# Scan with custom output file
vulncheck --repo ./my-project --output security-audit.md

# Only show high and critical issues
vulncheck --repo ./my-project --severity high

# Scan only JS and TS files
vulncheck --repo ./my-project --extensions .js,.ts

# Scan more files (default: 50)
vulncheck --repo ./my-project --max-files 100

# Use subcommand style
vulncheck scan --repo ./my-project --api-key YOUR_KEY
```

---

## 📊 Example Output

```
  ⚡ Bugs found in src/auth/login.js

  💀  [ CRITICAL ] SQL Injection
       File: src/auth/login.js:42
       Info: User input directly concatenated into SQL query
       Fix:  Use parameterized queries or an ORM

  🔴  [ HIGH ] Hardcoded Secret
       File: src/auth/login.js:8
       Info: JWT secret key hardcoded as string literal
       Fix:  Move to environment variable via process.env
```

---

## 📁 Report Format

The generated `.md` report includes:
- Executive summary with severity counts
- Critical/High issues highlighted first
- Issues grouped by file
- Remediation recommendations

---

## 🛠️ Options

| Flag | Description | Default |
|------|-------------|---------|
| `--repo <path>` | Path to scan | required |
| `--api-key <key>` | Gemini API key | `$GEMINI_API_KEY` |
| `--output <file>` | Report filename | `vulncheck-report.md` |
| `--severity <level>` | Min severity: `low\|medium\|high\|critical` | `low` |
| `--extensions <list>` | File extensions to scan | `.js,.ts,.py,...` |
| `--max-files <n>` | Max files to scan | `50` |

---

*Made by Gollavilli Dhanush Kumar — Powered by Google Gemini*
