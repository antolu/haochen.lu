# Security Scanning Guide

This guide explains how to reproduce and interpret the security scans that run in CI.

## Quick Start

### Run Local Security Scan

```bash
./run-security-scan.sh
```

This will scan your local codebase and generate reports in `./security-scan-results/`

### Analyze Reports

```bash
python3 analyze-security-report.py
```

Or analyze downloaded CI reports:

```bash
python3 analyze-security-report.py /path/to/downloaded/reports
```

## Understanding Security Reports

### Critical Issues Breakdown

The security scan checks multiple layers:

1. **Container Security (Trivy)** - Scans Docker images for OS package vulnerabilities
2. **Python Code Security (Bandit)** - Checks Python code for security anti-patterns
3. **Static Analysis (Semgrep)** - Advanced pattern matching for security issues
4. **Dependency Vulnerabilities (pip-audit, npm audit)** - Checks for known CVEs in dependencies

### Current Security Status (Latest CI Run)

#### ✅ Backend Python Code
- **Bandit**: No issues
- **pip-audit**: No vulnerable dependencies
- **Semgrep**: No issues (XSS false positive suppressed)

#### ⚠️ Container Security
- **HIGH**: 90 vulnerabilities in base OS packages
- **MEDIUM**: 274 vulnerabilities
- **LOW**: 1149 vulnerabilities

**Key Issues:**
1. **CVE-2026-24882** (GnuPG) - Buffer overflow in tpm2daemon (affects 8 packages)
2. **CVE-2026-0861** (glibc) - Integer overflow in memalign
3. **CVE-2025-59933** (libvips) - Image processing library vulnerability

**Impact Assessment:**
- Most HIGH severity issues are in **build tools** (gnupg, compilers) that are not used at runtime
- The application does not use TPM2 features or directly invoke the affected binaries
- Container runs as non-root user, limiting exploit potential
- No critical vulnerabilities in runtime Python dependencies

**Recommendations:**
1. Monitor for Debian security updates to base image (python:3.11-slim based on Debian Trixie)
2. Consider switching to distroless or alpine-based images for production
3. Remove build tools in final production stage (multi-stage build optimization)

## Download CI Security Reports

```bash
# List recent security scan runs
gh run list --workflow=security-scan.yml --limit 5

# Download reports from specific run
gh run download RUN_ID --name backend-security-reports --dir ./ci-reports/backend
gh run download RUN_ID --name frontend-security-reports --dir ./ci-reports/frontend
gh run download RUN_ID --name container-security-reports --dir ./ci-reports/container

# Analyze downloaded reports
python3 analyze-security-report.py ./ci-reports/backend
python3 analyze-security-report.py ./ci-reports/container
```

## Local Scan Details

### Backend Scans

**Bandit** - Python security linter
```bash
cd backend
bandit -r app/ -f txt -ll
```

**pip-audit** - Dependency CVE scanner
```bash
cd backend
pip-audit --format=table
```

**Semgrep** - Static analysis
```bash
cd backend
pipx run semgrep --config=auto app/
```

### Container Scans

**Trivy** - Container vulnerability scanner

Install Trivy:
```bash
# macOS
brew install trivy

# Linux
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install trivy
```

Scan images:
```bash
# Build images
docker build -f backend/Dockerfile -t portfolio-backend:security-scan .
docker build -f frontend/Dockerfile -t portfolio-frontend:security-scan frontend

# Scan with Trivy
trivy image portfolio-backend:security-scan
trivy image portfolio-frontend:security-scan

# Filter by severity
trivy image --severity HIGH,CRITICAL portfolio-backend:security-scan
```

### Frontend Scans

**npm audit** - Node.js dependency scanner
```bash
cd frontend
npm audit --audit-level=moderate
```

**ESLint security plugin**
```bash
cd frontend
npm install --save-dev eslint-plugin-security
npx eslint --ext .ts,.tsx src/
```

## Understanding Severity Levels

### Trivy Severity
- **CRITICAL**: Immediate action required - Known exploits exist
- **HIGH**: Action required - Serious vulnerability, should be patched
- **MEDIUM**: Review recommended - Moderate risk
- **LOW**: Informational - Low risk

### When to Act

**Immediate Action:**
- CRITICAL vulnerabilities in runtime dependencies
- Any HIGH severity issue with available patches
- Exposed secrets or credentials

**Plan to Address:**
- HIGH vulnerabilities without patches (monitor for fixes)
- MEDIUM vulnerabilities in production code paths

**Monitor:**
- LOW severity issues
- Vulnerabilities in build-only tools
- Issues without fixes available

## Common Issues

### "No fix available"

Many vulnerabilities in OS packages don't have fixes yet because:
1. The CVE was recently disclosed
2. The fix is pending in the upstream distribution
3. The package maintainer is evaluating the impact

**What to do:**
- Monitor for updates: `docker pull python:3.11-slim`
- Check if the vulnerability affects your use case
- Consider alternative base images if critical

### Build tools vs Runtime

Vulnerabilities in build tools (gcc, g++, make, git, gnupg) are lower risk because:
- They're only present during image build
- Not available at container runtime
- Not exposed to user input

For production, use multi-stage builds to exclude build tools from final image.

## CI Integration

Security scans run automatically:
- On every push to `master` or `feat/v2`
- On every pull request
- Daily at 3 AM UTC (scheduled scan)

### Workflow Behavior

All security scans are **informational only** and will not fail the CI pipeline:
- Individual scan jobs use `continue-on-error: true` 
- The workflow parses reports and generates an actionable summary
- GitHub issues are created only when actionable vulnerabilities are found:
  - CRITICAL container vulnerabilities
  - HIGH severity Python code issues
  - CRITICAL npm dependency vulnerabilities
  - Python dependency vulnerabilities with available fixes

### GitHub Issue Creation

Issues are created only for scheduled scans (daily) and only when:
- There are truly actionable problems requiring intervention
- Fixable vulnerabilities exist (vs unfixable base OS issues)
- CRITICAL or HIGH severity issues are detected

The issue includes:
- Parsed summary with severity breakdown
- Clear distinction between fixable and unfixable issues  
- Direct links to download detailed reports
- Contextual information about runtime risk

### Trivy Ignore File

The `.trivyignore` file suppresses known false positives:
- Build tools (gcc, g++, gnupg) not in runtime container
- Kernel headers used during compilation only
- Issues without available upstream fixes

This file should be reviewed periodically and updated when fixes become available.

## Report Files

Each scan generates JSON and TXT formats:

```
security-scan-results/
├── bandit-report.json              # Python code security (JSON)
├── bandit-report.txt               # Python code security (human readable)
├── pip-audit-report.json           # Python dependency CVEs
├── semgrep-report.json             # Static analysis findings
├── backend-trivy-report.json       # Container vulnerabilities
├── npm-audit-report.json           # Node.js dependency CVEs
└── SUMMARY.md                      # Auto-generated summary
```

## Interpreting Specific Findings

### Semgrep: "directly-returned-format-string"

**Location:** `app/core/rate_limiter.py:103`

```python
return f"ip:{client_ip}"  # nosemgrep: python.flask.security.xss.audit.direct-use-of-jinja2.direct-use-of-jinja2
```

**Issue:** Formatted string in Flask route could be XSS vector

**Status:** FALSE POSITIVE - Suppressed with `nosemgrep` comment

**Reason:** This string is used as a Redis cache key, not returned as an HTTP response. No XSS risk.

### Container: GnuPG CVE-2026-24882

**Issue:** Buffer overflow in tpm2daemon

**Risk:** MEDIUM - Application doesn't use GPG or TPM features

**Fix:** Wait for Debian security update or switch to minimal base image

## Further Reading

- [Trivy Documentation](https://trivy.dev)
- [Bandit Security Checks](https://bandit.readthedocs.io/en/latest/plugins/index.html)
- [Semgrep Rules](https://semgrep.dev/r)
- [OWASP Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
