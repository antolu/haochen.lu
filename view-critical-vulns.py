#!/usr/bin/env python3
"""
Quick view of CRITICAL and HIGH severity vulnerabilities from Trivy reports.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict


def show_critical_issues(report_path: Path, container_name: str):
    """Show only CRITICAL and HIGH severity issues."""

    with open(report_path) as f:
        data = json.load(f)

    critical = []
    high = []

    for result in data.get("Results", []):
        for vuln in result.get("Vulnerabilities", []):
            severity = vuln.get("Severity", "UNKNOWN")

            vuln_info = {
                "id": vuln.get("VulnerabilityID"),
                "pkg": vuln.get("PkgName"),
                "installed": vuln.get("InstalledVersion"),
                "fixed": vuln.get("FixedVersion", "Not available"),
                "title": vuln.get("Title", "No description"),
            }

            if severity == "CRITICAL":
                critical.append(vuln_info)
            elif severity == "HIGH":
                high.append(vuln_info)

    print(f"\n{'=' * 80}")
    print(f"{container_name.upper()} CONTAINER - CRITICAL & HIGH VULNERABILITIES")
    print(f"{'=' * 80}\n")

    if critical:
        print(f"🔴 CRITICAL: {len(critical)} vulnerabilities\n")

        # Group by CVE ID to avoid duplicates
        by_cve = defaultdict(list)
        for v in critical:
            by_cve[v["id"]].append(v["pkg"])

        for i, (cve_id, packages) in enumerate(sorted(by_cve.items())[:10], 1):
            vuln = next(v for v in critical if v["id"] == cve_id)
            print(f"{i}. {cve_id}")
            print(f"   Packages: {', '.join(sorted(set(packages)))}")
            print(f"   Installed: {vuln['installed']}")
            print(f"   Fixed: {vuln['fixed']}")
            print(f"   {vuln['title'][:75]}")
            print()

        if len(by_cve) > 10:
            print(f"   ... and {len(by_cve) - 10} more unique CRITICAL CVEs")
    else:
        print("✅ No CRITICAL vulnerabilities\n")

    if high:
        print(f"\n🟠 HIGH: {len(high)} vulnerabilities\n")

        # Group by CVE ID
        by_cve = defaultdict(list)
        for v in high:
            by_cve[v["id"]].append(v["pkg"])

        print(f"Unique CVEs: {len(by_cve)}")
        print(f"\nTop 5:")
        for i, (cve_id, packages) in enumerate(sorted(by_cve.items())[:5], 1):
            vuln = next(v for v in high if v["id"] == cve_id)
            print(f"{i}. {cve_id} ({len(packages)} packages)")
            print(f"   {vuln['title'][:75]}")

        if len(by_cve) > 5:
            print(f"\n   ... and {len(by_cve) - 5} more unique HIGH CVEs")
    else:
        print("\n✅ No HIGH vulnerabilities")

    print(f"\n{'=' * 80}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: ./view-critical-vulns.py <report-directory>")
        print("\nExample:")
        print("  ./view-critical-vulns.py ./security-scan-results")
        print("  ./view-critical-vulns.py /tmp/container-security")
        sys.exit(1)

    report_dir = Path(sys.argv[1])

    backend_report = report_dir / "backend-trivy-report.json"
    frontend_report = report_dir / "frontend-trivy-report.json"

    if backend_report.exists():
        show_critical_issues(backend_report, "Backend")
    else:
        print(f"⚠️  Backend report not found: {backend_report}")

    if frontend_report.exists():
        show_critical_issues(frontend_report, "Frontend")
    else:
        print(f"⚠️  Frontend report not found: {frontend_report}")


if __name__ == "__main__":
    main()
