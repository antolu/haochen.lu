#!/bin/bash
set -e

# Colors for output
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

SCAN_DIR="./security-scan-results"
mkdir -p "$SCAN_DIR"

echo -e "${GREEN}=== Running Local Security Scan ===${NC}"
echo "Results will be saved to: $SCAN_DIR"
echo ""

# Backend Security Scans
echo -e "${YELLOW}[1/4] Backend Security Scans${NC}"
cd backend

echo "  → Installing security tools..."
pip install -q bandit safety pip-audit pipx 2>/dev/null || echo "Some tools may already be installed"

echo "  → Running Bandit (security linter)..."
bandit -r app/ -f json -o "../$SCAN_DIR/bandit-report.json" -ll 2>/dev/null || true
bandit -r app/ -f txt -o "../$SCAN_DIR/bandit-report.txt" -ll 2>/dev/null || true

echo "  → Running pip-audit (dependency vulnerabilities)..."
pip-audit --format=json --output="../$SCAN_DIR/pip-audit-report.json" 2>/dev/null || true
pip-audit --format=table --output="../$SCAN_DIR/pip-audit-report.txt" 2>/dev/null || true

echo "  → Running Semgrep (static analysis)..."
python -m pipx run --spec semgrep semgrep --config=auto --json --output="../$SCAN_DIR/semgrep-report.json" app/ 2>/dev/null || true
python -m pipx run --spec semgrep semgrep --config=auto --text --output="../$SCAN_DIR/semgrep-report.txt" app/ 2>/dev/null || true

echo "  → Checking for hardcoded secrets..."
grep -r -i -E "(password|secret|key|token)\s*=\s*['\"][^'\"]{8,}['\"]" app/ > "../$SCAN_DIR/secrets-check.txt" 2>/dev/null || echo "No hardcoded secrets found" > "../$SCAN_DIR/secrets-check.txt"

cd ..

# Container Security Scans
echo -e "${YELLOW}[2/4] Container Security Scans${NC}"

if command -v docker &> /dev/null; then
    echo "  → Building backend Docker image..."
    docker build -f backend/Dockerfile -t portfolio-backend:security-scan . -q 2>/dev/null || echo "Backend build failed"

    echo "  → Building frontend Docker image..."
    docker build -f frontend/Dockerfile -t portfolio-frontend:security-scan frontend -q 2>/dev/null || echo "Frontend build failed"

    if command -v trivy &> /dev/null; then
        echo "  → Running Trivy on backend image..."
        trivy image --format json --output "$SCAN_DIR/backend-trivy-report.json" portfolio-backend:security-scan 2>/dev/null || true
        trivy image --format table --output "$SCAN_DIR/backend-trivy-report.txt" portfolio-backend:security-scan 2>/dev/null || true

        echo "  → Running Trivy on frontend image..."
        trivy image --format json --output "$SCAN_DIR/frontend-trivy-report.json" portfolio-frontend:security-scan 2>/dev/null || true
        trivy image --format table --output "$SCAN_DIR/frontend-trivy-report.txt" portfolio-frontend:security-scan 2>/dev/null || true
    else
        echo "  ⚠ Trivy not installed. Install with: brew install trivy (macOS) or see https://trivy.dev"
    fi
else
    echo "  ⚠ Docker not running. Skipping container scans."
fi

# Frontend Security Scans
echo -e "${YELLOW}[3/4] Frontend Security Scans${NC}"
cd frontend

if [ -f "package.json" ]; then
    echo "  → Running npm audit..."
    npm audit --audit-level=moderate --json > "../$SCAN_DIR/npm-audit-report.json" 2>/dev/null || true
    npm audit --audit-level=moderate > "../$SCAN_DIR/npm-audit-report.txt" 2>/dev/null || true
else
    echo "  ⚠ No package.json found. Skipping npm audit."
fi

cd ..

# Generate Summary Report
echo -e "${YELLOW}[4/4] Generating Summary${NC}"

cat > "$SCAN_DIR/SUMMARY.md" << 'EOF'
# Security Scan Summary

**Scan Date:** $(date -u)
**Directory:** $(pwd)

## Backend Security

### Bandit (Security Linter)
EOF

if [ -f "$SCAN_DIR/bandit-report.txt" ]; then
    {
        echo "\`\`\`"
        cat "$SCAN_DIR/bandit-report.txt"
        echo "\`\`\`"
    } >> "$SCAN_DIR/SUMMARY.md"
fi

echo -e "\n### pip-audit (Dependency Vulnerabilities)" >> "$SCAN_DIR/SUMMARY.md"
if [ -f "$SCAN_DIR/pip-audit-report.txt" ]; then
    {
        echo "\`\`\`"
        head -50 "$SCAN_DIR/pip-audit-report.txt"
        echo "\`\`\`"
    } >> "$SCAN_DIR/SUMMARY.md"
fi

echo -e "\n### Semgrep (Static Analysis)" >> "$SCAN_DIR/SUMMARY.md"
if [ -f "$SCAN_DIR/semgrep-report.txt" ]; then
    {
        echo "\`\`\`"
        cat "$SCAN_DIR/semgrep-report.txt"
        echo "\`\`\`"
    } >> "$SCAN_DIR/SUMMARY.md"
fi

echo -e "\n## Container Security" >> "$SCAN_DIR/SUMMARY.md"
if [ -f "$SCAN_DIR/backend-trivy-report.json" ]; then
    {
        echo "### Backend Container (Trivy)"
        echo "See \`backend-trivy-report.txt\` for details"
    } >> "$SCAN_DIR/SUMMARY.md"
fi

echo -e "\n## Frontend Security" >> "$SCAN_DIR/SUMMARY.md"
if [ -f "$SCAN_DIR/npm-audit-report.txt" ]; then
    {
        echo "### npm audit"
        echo "\`\`\`"
        head -30 "$SCAN_DIR/npm-audit-report.txt"
        echo "\`\`\`"
    } >> "$SCAN_DIR/SUMMARY.md"
fi

echo ""
echo -e "${GREEN}=== Security Scan Complete ===${NC}"
echo ""
echo "Reports saved to: $SCAN_DIR"
echo ""
echo "Quick summary:"
echo "  • Bandit: $SCAN_DIR/bandit-report.txt"
echo "  • pip-audit: $SCAN_DIR/pip-audit-report.txt"
echo "  • Semgrep: $SCAN_DIR/semgrep-report.txt"
echo "  • Trivy (backend): $SCAN_DIR/backend-trivy-report.txt"
echo "  • Trivy (frontend): $SCAN_DIR/frontend-trivy-report.txt"
echo "  • npm audit: $SCAN_DIR/npm-audit-report.txt"
echo ""
echo "Full summary: $SCAN_DIR/SUMMARY.md"
