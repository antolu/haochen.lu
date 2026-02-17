#!/usr/bin/env python3
"""
Security Report Analyzer

This script analyzes security scan reports and provides a clear summary of critical issues.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict


def analyze_trivy_report(report_path: Path) -> Dict[str, Any]:
    """Analyze Trivy container scan report."""
    with open(report_path) as f:
        data = json.load(f)

    severities = defaultdict(int)
    critical_vulns = []
    high_vulns = []

    for result in data.get("Results", []):
        target = result.get("Target", "unknown")
        for vuln in result.get("Vulnerabilities", []):
            severity = vuln.get("Severity", "UNKNOWN")
            severities[severity] += 1

            vuln_info = {
                "id": vuln.get("VulnerabilityID"),
                "severity": severity,
                "package": vuln.get("PkgName"),
                "installed": vuln.get("InstalledVersion"),
                "fixed": vuln.get("FixedVersion", "Not available"),
                "title": vuln.get("Title", "No description"),
                "target": target,
            }

            if severity == "CRITICAL":
                critical_vulns.append(vuln_info)
            elif severity == "HIGH":
                high_vulns.append(vuln_info)

    return {
        "severities": dict(severities),
        "critical": critical_vulns,
        "high": high_vulns,
    }


def analyze_bandit_report(report_path: Path) -> Dict[str, Any]:
    """Analyze Bandit security linter report."""
    with open(report_path) as f:
        data = json.load(f)

    severities = defaultdict(int)
    issues = []

    for result in data.get("results", []):
        severity = result.get("issue_severity", "UNKNOWN")
        severities[severity] += 1

        if severity in ("HIGH", "MEDIUM"):
            issues.append({
                "severity": severity,
                "confidence": result.get("issue_confidence"),
                "file": result.get("filename"),
                "line": result.get("line_number"),
                "issue": result.get("issue_text"),
                "code": result.get("code", "").strip(),
            })

    return {"severities": dict(severities), "issues": issues}


def analyze_semgrep_report(report_path: Path) -> Dict[str, Any]:
    """Analyze Semgrep static analysis report."""
    with open(report_path) as f:
        data = json.load(f)

    findings = []

    for result in data.get("results", []):
        findings.append({
            "severity": result.get("extra", {}).get("severity", "INFO"),
            "message": result.get("extra", {}).get("message", "No description"),
            "file": result.get("path"),
            "line": result.get("start", {}).get("line"),
            "rule": result.get("check_id"),
        })

    return {"count": len(findings), "findings": findings}


def analyze_pip_audit_report(report_path: Path) -> Dict[str, Any]:
    """Analyze pip-audit dependency vulnerability report."""
    with open(report_path) as f:
        data = json.load(f)

    vulnerabilities = []

    for dep in data.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            vulnerabilities.append({
                "package": dep.get("name"),
                "version": dep.get("version"),
                "id": vuln.get("id"),
                "fix_versions": vuln.get("fix_versions", []),
            })

    return {"count": len(vulnerabilities), "vulnerabilities": vulnerabilities}


def print_report(scan_dir: Path):
    """Print a formatted security report."""

    print("\n" + "=" * 80)
    print("SECURITY SCAN REPORT ANALYSIS")
    print("=" * 80 + "\n")

    # Analyze Trivy reports
    backend_trivy = scan_dir / "backend-trivy-report.json"
    if backend_trivy.exists():
        print("\n🐳 CONTAINER SECURITY - Backend")
        print("-" * 80)

        analysis = analyze_trivy_report(backend_trivy)

        print(f"\nVulnerability Summary:")
        for severity, count in sorted(analysis["severities"].items()):
            emoji = (
                "🔴"
                if severity == "CRITICAL"
                else "🟠"
                if severity == "HIGH"
                else "🟡"
                if severity == "MEDIUM"
                else "⚪"
            )
            print(f"  {emoji} {severity}: {count}")

        if analysis["critical"]:
            print(f"\n🔴 CRITICAL Vulnerabilities ({len(analysis['critical'])}):")
            for i, vuln in enumerate(analysis["critical"][:5], 1):
                print(f"\n  {i}. {vuln['id']} - {vuln['package']}")
                print(f"     Installed: {vuln['installed']}")
                print(f"     Fixed in:  {vuln['fixed']}")
                print(f"     {vuln['title'][:70]}...")

            if len(analysis["critical"]) > 5:
                print(
                    f"\n  ... and {len(analysis['critical']) - 5} more CRITICAL issues"
                )

        if analysis["high"]:
            print(f"\n🟠 HIGH Severity Vulnerabilities ({len(analysis['high'])}):")
            for i, vuln in enumerate(analysis["high"][:3], 1):
                print(f"\n  {i}. {vuln['id']} - {vuln['package']}")
                print(f"     Installed: {vuln['installed']}")
                print(f"     Fixed in:  {vuln['fixed']}")

            if len(analysis["high"]) > 3:
                print(f"\n  ... and {len(analysis['high']) - 3} more HIGH issues")

    # Analyze Bandit report
    bandit_report = scan_dir / "bandit-report.json"
    if bandit_report.exists():
        print("\n\n🔍 PYTHON SECURITY - Bandit")
        print("-" * 80)

        analysis = analyze_bandit_report(bandit_report)

        if analysis["severities"]:
            print(f"\nIssue Summary:")
            for severity, count in sorted(analysis["severities"].items()):
                print(f"  {severity}: {count}")
        else:
            print("\n✅ No issues found!")

        if analysis["issues"]:
            print(f"\nTop Issues:")
            for i, issue in enumerate(analysis["issues"][:3], 1):
                print(f"\n  {i}. [{issue['severity']}] {issue['file']}:{issue['line']}")
                print(f"     {issue['issue']}")

    # Analyze Semgrep report
    semgrep_report = scan_dir / "semgrep-report.json"
    if semgrep_report.exists():
        print("\n\n🔎 STATIC ANALYSIS - Semgrep")
        print("-" * 80)

        analysis = analyze_semgrep_report(semgrep_report)

        print(f"\nFindings: {analysis['count']}")

        if analysis["findings"]:
            for i, finding in enumerate(analysis["findings"][:3], 1):
                print(
                    f"\n  {i}. [{finding['severity']}] {finding['file']}:{finding['line']}"
                )
                print(f"     {finding['message'][:70]}...")
                print(f"     Rule: {finding['rule']}")

    # Analyze pip-audit report
    pip_audit_report = scan_dir / "pip-audit-report.json"
    if pip_audit_report.exists():
        print("\n\n📦 DEPENDENCY VULNERABILITIES - pip-audit")
        print("-" * 80)

        analysis = analyze_pip_audit_report(pip_audit_report)

        if analysis["count"] > 0:
            print(f"\n⚠️  Found {analysis['count']} vulnerable dependencies")
            for i, vuln in enumerate(analysis["vulnerabilities"][:5], 1):
                print(f"\n  {i}. {vuln['package']} {vuln['version']}")
                print(f"     {vuln['id']}")
                if vuln["fix_versions"]:
                    print(f"     Fix: Upgrade to {', '.join(vuln['fix_versions'][:3])}")
        else:
            print("\n✅ No vulnerable dependencies found!")

    print("\n" + "=" * 80)
    print("\nFor full details, see the individual report files in:")
    print(f"  {scan_dir.absolute()}")
    print("=" * 80 + "\n")


def main():
    # Check if running with downloaded CI reports
    if len(sys.argv) > 1:
        scan_dir = Path(sys.argv[1])
    else:
        scan_dir = Path("./security-scan-results")

    if not scan_dir.exists():
        print(f"❌ Scan directory not found: {scan_dir}")
        print("Run ./run-security-scan.sh first to generate reports")
        sys.exit(1)

    print_report(scan_dir)


if __name__ == "__main__":
    main()
