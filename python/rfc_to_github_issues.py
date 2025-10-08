#!/usr/bin/env python3
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "python-dotenv",
#     "requests<3",
# ]
# ///
"""
RFC to GitHub Issues Converter

This script converts RFC (Request for Comments) files from the docs/rfc folder
into GitHub issues using the GitHub API. It maps RFC content to the appropriate
GitHub issue template format.

Usage:
    python rfc_to_github_issues.py [--dry-run] [--rfc-file RFC_FILE] [--all]

Examples:
    # Dry run to see what would be created
    python rfc_to_github_issues.py --dry-run

    # Dry run with full body content displayed
    python rfc_to_github_issues.py --dry-run --full-body

    # Convert a specific RFC
    python rfc_to_github_issues.py --rfc-file 001-format-support.md

    # Convert all RFCs
    python rfc_to_github_issues.py --all

Requirements:
    - GitHub Personal Access Token (see setup instructions below)
    - requests library: pip install requests
    - PyYAML library: pip install PyYAML

GitHub API Setup:
    1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
    2. Generate a new token with 'repo' scope (for private repos) or 'public_repo' (for public repos)
    3. Set the GITHUB_TOKEN environment variable:
       export GITHUB_TOKEN=your_token_here
    4. Or create a .env file in the project root with:
       GITHUB_TOKEN=your_token_here

Repository Configuration:
    - Update the REPO_OWNER and REPO_NAME variables below
    - Ensure the repository exists and you have write access
"""

import os
import re
import sys
import argparse
import requests
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

@dataclass
class RFCData:
    """Data structure for parsed RFC content"""

    number: str
    title: str
    description: str
    requirements: List[str]
    acceptance_criteria: List[str]
    priority: str
    labels: List[str]
    status: Optional[str] = None
    implementation: Optional[str] = None
    file_path: str = ""


class RFCToGitHubConverter:
    """Main class for converting RFCs to GitHub issues"""

    def __init__(self, repo_owner: str, repo_name: str, dry_run: bool = False):
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.dry_run = dry_run
        self.github_token = os.getenv("GITHUB_TOKEN")
        self.base_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        self.headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RFC-to-GitHub-Issues-Converter",
        }

        if not self.dry_run and not self.github_token:
            raise ValueError(
                "GITHUB_TOKEN environment variable is required for non-dry-run mode"
            )

    def parse_rfc_file(self, file_path: Path) -> RFCData:
        """Parse an RFC markdown file and extract structured data"""
        content = file_path.read_text(encoding="utf-8")

        # Extract RFC number and title from the first line
        title_match = re.match(r"# RFC #(\d+): (.+)", content)
        if not title_match:
            raise ValueError(f"Invalid RFC format in {file_path.name}")

        rfc_number = title_match.group(1)
        title = title_match.group(2)

        # Extract description
        description_match = re.search(
            r"## Description\s*\n\s*\n(.+?)(?=\n## |$)", content, re.DOTALL
        )
        description = description_match.group(1).strip() if description_match else ""

        # Extract requirements
        requirements_match = re.search(
            r"## Requirements\s*\n\s*\n((?:- .+\n?)+)", content
        )
        requirements = []
        if requirements_match:
            requirements = [
                line.strip("- ").strip()
                for line in requirements_match.group(1).split("\n")
                if line.strip()
            ]

        # Extract acceptance criteria
        criteria_match = re.search(
            r"## Acceptance Criteria\s*\n\s*\n((?:- \[[ x]\] .+\n?)+)", content
        )
        acceptance_criteria = []
        if criteria_match:
            acceptance_criteria = [
                line.strip("- ").strip()
                for line in criteria_match.group(1).split("\n")
                if line.strip()
            ]

        # Extract priority
        priority_match = re.search(r"## Priority\s*\n\s*\n(.+)", content)
        priority = priority_match.group(1).strip() if priority_match else "Medium"

        # Extract labels
        labels_match = re.search(r"## Labels\s*\n\s*\n(.+)", content)
        labels = []
        if labels_match:
            labels = [
                label.strip()
                for label in labels_match.group(1).split(",")
                if label.strip()
            ]

        # Extract status (if present)
        status_match = re.search(r"## Status\s*\n\s*\n(.+)", content)
        status = status_match.group(1).strip() if status_match else None

        # Extract implementation details (if present)
        implementation_match = re.search(
            r"## Implementation\s*\n\s*\n(.+?)(?=\n## |$)", content, re.DOTALL
        )
        implementation = (
            implementation_match.group(1).strip() if implementation_match else None
        )

        return RFCData(
            number=rfc_number,
            title=title,
            description=description,
            requirements=requirements,
            acceptance_criteria=acceptance_criteria,
            priority=priority,
            labels=labels,
            status=status,
            implementation=implementation,
            file_path=str(file_path),
        )

    def map_priority_to_github(self, priority: str) -> str:
        """Map RFC priority to GitHub issue priority format"""
        priority_lower = priority.lower()
        if "critical" in priority_lower or "high" in priority_lower:
            return "High - Important for my workflow"
        elif "medium" in priority_lower:
            return "Medium - Would be helpful"
        elif "low" in priority_lower:
            return "Low - Nice to have"
        else:
            return "Medium - Would be helpful"

    def map_labels_to_github(self, labels: List[str]) -> List[str]:
        """Map RFC labels to GitHub issue labels"""
        github_labels = []
        for label in labels:
            label_lower = label.lower()
            if "enhancement" in label_lower or "feature" in label_lower:
                github_labels.append("enhancement")
            elif "bug" in label_lower:
                github_labels.append("bug")
            elif "testing" in label_lower or "test" in label_lower:
                github_labels.append("testing")
            elif "performance" in label_lower:
                github_labels.append("performance")
            elif "ui" in label_lower or "interface" in label_lower:
                github_labels.append("ui")
            elif "documentation" in label_lower or "docs" in label_lower:
                github_labels.append("documentation")
            else:
                # Keep original label if no mapping found
                github_labels.append(label)

        # Always add needs-triage for new issues
        if "needs-triage" not in github_labels:
            github_labels.append("needs-triage")

        return github_labels

    def determine_issue_type(self, rfc_data: RFCData) -> str:
        """Determine if this should be a feature request or bug report"""
        labels_lower = [label.lower() for label in rfc_data.labels]
        if "bug" in labels_lower or "fix" in labels_lower:
            return "bug_report"
        else:
            return "feature_request"

    def create_issue_body(self, rfc_data: RFCData, issue_type: str) -> str:
        """Create the issue body based on the GitHub template format"""

        # Build the main content
        body_parts = []

        gh_file_url = f"https://github.com/{self.repo_owner}/{self.repo_name}/tree/v0.4.0/docs/rfc/{Path(rfc_data.file_path).name}"

        # Add original RFC reference
        body_parts.append(f"**Original RFC**: [#{rfc_data.number}]({gh_file_url})")
        body_parts.append("")

        # Add description
        body_parts.append("## Feature Description")
        body_parts.append(rfc_data.description)
        body_parts.append("")

        # Add problem statement (derived from description)
        body_parts.append("## Problem Statement")
        body_parts.append(f"This RFC addresses the need for: {rfc_data.description}")
        body_parts.append("")

        # Add proposed solution (from requirements)
        body_parts.append("## Proposed Solution")
        if rfc_data.requirements:
            body_parts.append("The solution should include:")
            for req in rfc_data.requirements:
                body_parts.append(f"- {req}")
        else:
            body_parts.append("See requirements section below.")
        body_parts.append("")

        # Add use cases (from requirements)
        body_parts.append("## Use Cases")
        if rfc_data.requirements:
            for i, req in enumerate(rfc_data.requirements, 1):
                body_parts.append(f"- Use case {i}: {req}")
        else:
            body_parts.append("See requirements section below.")
        body_parts.append("")

        # Add requirements
        if rfc_data.requirements:
            body_parts.append("## Requirements")
            for req in rfc_data.requirements:
                body_parts.append(f"- {req}")
            body_parts.append("")

        # Add acceptance criteria
        if rfc_data.acceptance_criteria:
            body_parts.append("## Acceptance Criteria")
            for criteria in rfc_data.acceptance_criteria:
                body_parts.append(f"- {criteria}")
            body_parts.append("")

        # Add technical considerations
        body_parts.append("## Technical Considerations")
        if rfc_data.implementation:
            body_parts.append("Implementation details from RFC:")
            body_parts.append("")
            # body_parts.append("```")
            body_parts.append(
                rfc_data.implementation[:5000000000] + "..."
                if len(rfc_data.implementation) > 5000000000
                else rfc_data.implementation
            )
            # body_parts.append("```")
        else:
            body_parts.append("See original RFC for technical details.")
        body_parts.append("")

        # Add status if available
        if rfc_data.status:
            body_parts.append("## Current Status")
            body_parts.append(rfc_data.status)
            body_parts.append("")

        # Add additional context
        body_parts.append("## Additional Context")
        body_parts.append(f"- Priority: {rfc_data.priority}")
        body_parts.append(f"- Labels: {', '.join(rfc_data.labels)}")
        body_parts.append(f"- Original RFC: {gh_file_url}")
        body_parts.append("")

        return "\n".join(body_parts)

    def create_github_issue(self, rfc_data: RFCData, full_body: bool = False) -> Dict:
        """Create a GitHub issue from RFC data"""
        issue_type = self.determine_issue_type(rfc_data)
        priority = self.map_priority_to_github(rfc_data.priority)
        labels = self.map_labels_to_github(rfc_data.labels)

        # Create issue title
        if issue_type == "bug_report":
            title = f"[Bug]: {rfc_data.title}"
        else:
            title = f"[Feature]: {rfc_data.title}"

        # Create issue body
        body = self.create_issue_body(rfc_data, issue_type)

        # Prepare issue data
        issue_data = {"title": title, "body": body, "labels": labels}

        if self.dry_run:
            print("DRY RUN - Would create issue:")
            print(f"- Title: {title}")
            print(f"- Labels: {labels}")
            print(f"- Priority: {priority}")
            if full_body:
                print("- Full body content:")
                print()
                print("" + "-" * 60)
                print()
                for line in body.split("\n"):
                    print(f"{line}")
                print()
                print("" + "-" * 60)
                print()
            else:
                print(f"Body preview: {body[:200]}...")
            print(f"Full body length: {len(body)} characters")
            print()
            print("-" * 50)
            print()
            return {"dry_run": True, "title": title, "labels": labels}

        # Create the issue via GitHub API
        response = requests.post(
            f"{self.base_url}/issues", headers=self.headers, json=issue_data
        )

        if response.status_code == 201:
            issue = response.json()
            print(f"✅ Created issue #{issue['number']}: {title}")
            print(f"   URL: {issue['html_url']}")
            return issue
        else:
            print(f"❌ Failed to create issue: {response.status_code}")
            print(f"   Response: {response.text}")
            return {"error": response.text}

    def process_rfc_file(self, file_path: Path, full_body: bool = False) -> Dict:
        """Process a single RFC file"""
        try:
            print(f"Processing RFC: {file_path.name}")
            rfc_data = self.parse_rfc_file(file_path)
            return self.create_github_issue(rfc_data, full_body)
        except Exception as e:
            print(f"❌ Error processing {file_path.name}: {str(e)}")
            return {"error": str(e)}

    def process_all_rfcs(self, rfc_dir: Path, full_body: bool = False) -> List[Dict]:
        """Process all RFC files in the directory"""
        results = []
        rfc_files = sorted([f for f in rfc_dir.glob("*.md") if f.name != "README.md"])

        print(f"Found {len(rfc_files)} RFC files to process")
        print("-" * 60)

        for rfc_file in rfc_files:
            result = self.process_rfc_file(rfc_file, full_body)
            results.append(result)
            print()  # Add spacing between RFCs

        return results

    def process_specific_rfc(
        self, rfc_file: str, rfc_dir: Path, full_body: bool = False
    ) -> Dict:
        """Process a specific RFC file"""
        file_path = rfc_dir / Path(rfc_file).name
        if not file_path.exists():
            raise FileNotFoundError(f"RFC file not found: {file_path}")

        return self.process_rfc_file(file_path, full_body)


def main():
    """Main function to handle command line arguments and run the converter"""
    parser = argparse.ArgumentParser(
        description="Convert RFC files to GitHub issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be created without actually creating issues",
    )

    parser.add_argument(
        "--rfc-file",
        type=str,
        help="Convert a specific RFC file (e.g., 001-format-support.md)",
    )

    parser.add_argument("--all", action="store_true", help="Convert all RFC files")

    parser.add_argument(
        "--full-body",
        action="store_true",
        help="Print the complete issue body content in dry run mode",
    )

    parser.add_argument(
        "--repo-owner",
        type=str,
        default="etienneschalk",  # Update this
        help="GitHub repository owner (default: etienneschalk)",
    )

    parser.add_argument(
        "--repo-name",
        type=str,
        default="scientific-data-viewer",  # Update this
        help="GitHub repository name (default: scientific-data-viewer)",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.dry_run and not args.rfc_file and not args.all:
        parser.error("Must specify either --rfc-file, --all, or --dry-run")

    # Set up paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    rfc_dir = project_root / "docs" / "rfc"

    if not rfc_dir.exists():
        print(f"❌ RFC directory not found: {rfc_dir}")
        sys.exit(1)

    # Create converter
    try:
        converter = RFCToGitHubConverter(
            repo_owner=args.repo_owner, repo_name=args.repo_name, dry_run=args.dry_run
        )
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        print("\nPlease set up your GitHub token:")
        print("export GITHUB_TOKEN=your_token_here")
        sys.exit(1)

    # Process RFCs
    try:
        if args.dry_run:
            print("🔍 DRY RUN MODE - No issues will be created")
            if args.full_body:
                print("📄 FULL BODY MODE - Complete issue content will be displayed")
            print()
            print("-" * 60)
            print()
            if args.rfc_file:
                result = converter.process_specific_rfc(
                    args.rfc_file, rfc_dir, args.full_body
                )
                if "error" in result:
                    sys.exit(1)
            else:
                converter.process_all_rfcs(rfc_dir, args.full_body)
        elif args.rfc_file:
            result = converter.process_specific_rfc(
                args.rfc_file, rfc_dir, args.full_body
            )
            if "error" in result:
                sys.exit(1)
        elif args.all:
            results = converter.process_all_rfcs(rfc_dir, args.full_body)
            successful = sum(
                1 for r in results if "error" not in r and "dry_run" not in r
            )
            print(
                f"\n📊 Summary: {successful}/{len(results)} issues created successfully"
            )

    except KeyboardInterrupt:
        print("\n⏹️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
