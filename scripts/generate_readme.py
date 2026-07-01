#!/usr/bin/env python3
"""
Generate README.md from package.json and docs/documentation.json.

package.json supplies machine-readable extension metadata (commands, settings,
languages, views, custom editors). documentation.json supplies prose, grouping,
screenshots, and other content that cannot be inferred from the manifest alone.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Paths:
    root: Path
    package_json: Path
    documentation_json: Path
    output: Path
    version: str | None = None
    no_timestamp: bool = False


def parse_args(argv: list[str] | None = None) -> Paths:
    parser = argparse.ArgumentParser(
        description="Generate README.md from extension metadata."
    )
    default_root = Path(__file__).resolve().parent.parent
    parser.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help="Repository root (default: parent of scripts/)",
    )
    parser.add_argument(
        "--package-json",
        type=Path,
        default=None,
        help="Path to package.json (default: <root>/package.json)",
    )
    parser.add_argument(
        "--documentation-json",
        type=Path,
        default=None,
        help="Path to documentation.json (default: <root>/docs/documentation.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output markdown path (default: <root>/README.md)",
    )
    parser.add_argument(
        "--version",
        default=None,
        help="Extension version for the header and links (default: package.json version)",
    )
    parser.add_argument(
        "--no-timestamp",
        action="store_true",
        help="Omit generation timestamp from the banner (stable output for byte comparisons)",
    )
    args = parser.parse_args(argv)
    root = args.root.resolve()
    return Paths(
        root=root,
        package_json=(args.package_json or root / "package.json").resolve(),
        documentation_json=(
            args.documentation_json or root / "docs" / "documentation.json"
        ).resolve(),
        output=(args.output or root / "README.md").resolve(),
        version=args.version,
        no_timestamp=args.no_timestamp,
    )


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def resolve_version(package: dict[str, Any], version_override: str | None) -> str:
    package_version = package.get("version")
    if not isinstance(package_version, str) or not package_version:
        raise ValueError("package.json is missing a non-empty 'version' field")
    if version_override is None:
        return package_version
    return version_override


def github_heading_anchor(heading: str) -> str:
    slug = heading.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    return slug


def find_changelog_heading(changelog_path: Path, version: str) -> str | None:
    if not changelog_path.is_file():
        return None
    pattern = re.compile(rf"^## \[{re.escape(version)}\](?:\s*-\s*.+)?\s*$")
    for line in changelog_path.read_text(encoding="utf-8").splitlines():
        if pattern.match(line):
            return line.lstrip("#").strip()
    return None


def build_changelog_link(
    root: Path, version: str, links: dict[str, str]
) -> tuple[str, list[str]]:
    warnings: list[str] = []
    changelog_path_setting = links.get("changelog", "./CHANGELOG.md")
    changelog_file = (root / changelog_path_setting).resolve()
    changelog_base = changelog_path_setting.split("#", maxsplit=1)[0]

    heading = find_changelog_heading(changelog_file, version)
    if heading is None:
        warnings.append(
            f"no CHANGELOG.md section found for version {version}; "
            f"changelog link will not include a version anchor"
        )
        return changelog_base, warnings

    anchor = github_heading_anchor(heading)
    return f"{changelog_base}#{anchor}", warnings


def build_release_notes_link(version: str, links: dict[str, str]) -> str:
    template = links.get("releaseNotesTemplate", "./docs/RELEASE_NOTES_{version}.md")
    return template.replace("{version}", version)


def format_default(value: Any) -> str:
    if isinstance(value, str):
        if value == "":
            return '`""` (empty string)'
        return f'`"{value}"`'
    if isinstance(value, bool):
        return f"`{str(value).lower()}`"
    return f"`{value}`"


def command_palette_title(command: dict[str, Any]) -> str:
    category = command.get("category", "")
    title = command.get("title", command.get("command", ""))
    if category:
        return f"{category}: {title}"
    return title


def command_description(command: dict[str, Any]) -> str:
    description = command.get("description", "")
    return description.strip() if isinstance(description, str) else ""


def menu_description(menu_entry: dict[str, Any], command: dict[str, Any]) -> str:
    menu_desc = menu_entry.get("description", "")
    if isinstance(menu_desc, str) and menu_desc.strip():
        return menu_desc.strip()
    return command_description(command)


def commands_by_id(package: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        cmd["command"]: cmd
        for cmd in package.get("contributes", {}).get("commands", [])
    }


def command_palette_commands(package: dict[str, Any]) -> list[dict[str, Any]]:
    palette = package.get("contributes", {}).get("menus", {}).get("commandPalette", [])
    by_id = commands_by_id(package)
    commands: list[dict[str, Any]] = []
    for entry in palette:
        if entry.get("when") == "false":
            continue
        command = by_id.get(entry["command"])
        if command is not None:
            commands.append(command)
    return commands


def explorer_context_menu_entries(package: dict[str, Any]) -> list[dict[str, Any]]:
    return package.get("contributes", {}).get("menus", {}).get("explorer/context", [])


def validate_command_documentation(
    package: dict[str, Any],
) -> list[str]:
    warnings: list[str] = []
    for command in command_palette_commands(package):
        if not command_description(command):
            warnings.append(
                f"command '{command['command']}' is in the command palette but has no description"
            )

    by_id = commands_by_id(package)
    for menu_entry in explorer_context_menu_entries(package):
        command_id = menu_entry.get("command", "")
        command = by_id.get(command_id)
        if command is None:
            warnings.append(
                f"explorer/context menu references unknown command: {command_id}"
            )
            continue
        if not menu_description(menu_entry, command):
            warnings.append(
                f"explorer/context menu for '{command_id}' has no description"
            )
    return warnings


def build_format_table(
    package: dict[str, Any], doc: dict[str, Any]
) -> tuple[list[str], list[list[str]]]:
    languages = package.get("contributes", {}).get("languages", [])
    overrides: dict[str, Any] = doc.get("formatTableOverrides", {})

    extensions_claimed_by_override: dict[str, set[str]] = {}
    for override in overrides.values():
        language_id = override.get("languageIds", [None])[0]
        if language_id is None:
            continue
        claimed = extensions_claimed_by_override.setdefault(language_id, set())
        claimed.update(override.get("extensions", []))

    rows: list[list[str]] = []
    seen_labels: set[str] = set()

    for language in languages:
        alias = language.get("aliases", [language.get("id", "")])[0]
        language_id = language.get("id", "")
        claimed = extensions_claimed_by_override.get(language_id, set())
        extensions = [
            ext for ext in language.get("extensions", []) if ext not in claimed
        ]
        rows.append([alias, ", ".join(extensions)])
        seen_labels.add(alias)

    for label, override in overrides.items():
        if label in seen_labels:
            continue
        extensions = ", ".join(override.get("extensions", []))
        rows.append([label, extensions])
        seen_labels.add(label)

    return ["Format", "File Extension"], rows


def render_markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    header_row = f"| {headers[0]} | {headers[1]} |"
    separator = f"| {'-' * len(headers[0])} | {'-' * len(headers[1])} |"
    body = "\n".join(f"| {row[0]} | {row[1]} |" for row in rows)
    return f"{header_row}\n{separator}\n{body}"


def render_screenshots(sections: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for section in sections:
        items = "\n\n".join(
            f"""<div align="center">
  <a href="{item["src"]}" target="_blank">
    <img width="200" src="{item["src"]}" alt="{item["alt"]}">
  </a>
  <p><em>{item["caption"]}</em></p>
</div>"""
            for item in section.get("items", [])
        )
        blocks.append(f"**{section['title']}**\n\n{items}")
    return "\n\n".join(blocks)


def validate_settings_groups(
    package: dict[str, Any], groups: list[dict[str, Any]]
) -> list[str]:
    properties = (
        package.get("contributes", {}).get("configuration", {}).get("properties", {})
    )
    grouped: set[str] = set()
    warnings: list[str] = []
    for group in groups:
        for key in group.get("keys", []):
            grouped.add(key)
            if key not in properties:
                warnings.append(
                    f"settings group '{group['title']}' references unknown setting: {key}"
                )
    for key in sorted(properties):
        if key not in grouped:
            warnings.append(
                f"setting '{key}' is not listed in any settingsGroups entry"
            )
    return warnings


def render_enum_description_lines(schema: dict[str, Any]) -> list[str]:
    enum = schema.get("enum")
    descriptions = schema.get("enumDescriptions")
    if not isinstance(enum, list) or not isinstance(descriptions, list):
        return []
    if not enum or len(enum) != len(descriptions):
        return []

    lines = ["  - Values:"]
    lines.extend(
        f"    - {format_default(value)}: {description}"
        for value, description in zip(enum, descriptions, strict=True)
    )
    return lines


def setting_description(schema: dict[str, Any]) -> str:
    markdown = schema.get("markdownDescription")
    if isinstance(markdown, str) and markdown.strip():
        return markdown.strip()
    description = schema.get("description", "")
    return description.strip() if isinstance(description, str) else ""


def format_setting_description_lines(description: str) -> list[str]:
    paragraphs = [part.strip() for part in description.split("\n\n") if part.strip()]
    lines: list[str] = []
    for paragraph in paragraphs:
        flattened = " ".join(
            line.strip() for line in paragraph.splitlines() if line.strip()
        )
        if flattened:
            lines.append(f"  - {flattened}")
    return lines


def render_setting(key: str, schema: dict[str, Any]) -> str:
    setting_type = schema.get("type", "unknown")
    default = format_default(schema.get("default"))
    lines = [
        f"- **`{key}`**",
        f"  - (type: `{setting_type}`, default: {default})",
    ]
    lines.extend(format_setting_description_lines(setting_description(schema)))
    lines.extend(render_enum_description_lines(schema))
    return "\n".join(lines)


def render_banner(paths: Paths) -> str:
    lines = [
        "  AUTO-GENERATED FILE — do not edit by hand.",
    ]
    if not paths.no_timestamp:
        lines.append(f"  Generated on: {datetime.now().isoformat()}")
    lines.extend(
        [
            "  Generated by: scripts/generate_readme.py",
            f"  Sources: {paths.package_json.name}, {paths.documentation_json.relative_to(paths.root)}",
        ]
    )
    return "<!--\n" + "\n".join(lines) + "\n-->\n"


def render_header(
    display_name: str,
    version: str,
    tagline: str,
    icon: str,
    links: dict[str, str],
    changelog_link: str,
    release_notes_link: str,
    warnings: list[str],
) -> str:
    warning_blocks = "\n\n".join(f"> {warning}" for warning in warnings)
    warnings_section = f"\n\n{warning_blocks}" if warning_blocks else ""
    return f"""# {display_name} - VSCode Extension

<div align="center">
  <img src="{icon}" alt="{display_name} Icon" width="128" height="128">
</div>

{tagline}

<div align="center">

**Current Version: v{version}** • [Changelog]({changelog_link}) • [v{version} release notes]({release_notes_link})

Available on:
[VSCode Marketplace]({links.get("vscodeMarketplace", "#")}) • [Open VSX Registry]({links.get("openVsx", "#")})

[Getting Started]({links.get("gettingStarted", "#")})

</div>{warnings_section}"""


def render_features(
    package: dict[str, Any], doc: dict[str, Any], features: list[str]
) -> str:
    format_headers, format_rows = build_format_table(package, doc)
    format_table = render_markdown_table(format_headers, format_rows)
    feature_lines: list[str] = []
    for feature in features:
        if "Multi-format Support" in feature:
            feature_lines.append(f"- **Multi-format Support**:\n\n{format_table}")
        else:
            feature_lines.append(f"- {feature}")
    body = "\n".join(feature_lines)
    return f"""## 🚀 Features

{body}"""


def render_installation(required: list[str], optional: list[str]) -> str:
    return f"""## 📦 Installation

1. **Install from VSCode Marketplace**:
   - Open VSCode
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Search for "Scientific Data Viewer"
   - Click Install

2. **Install required Python dependencies**: (prompted by extension)

   ```bash
   pip install {" ".join(required)}
   ```

3. **Install optional Python dependencies**: (prompted by extension)

   ```bash
   pip install {" ".join(optional)}
   ```

4. **Open a supported file 🎉**"""


def render_prerequisites(
    prereq: dict[str, str], required: list[str], optional: list[str]
) -> str:
    required_list = "\n".join(f"   - {pkg}" for pkg in required)
    optional_list = "\n".join(
        f"   - {pkg}{' (for NASA CDF files)' if pkg == 'cdflib' else ''}"
        for pkg in optional
    )
    python313_note = (
        f"\n\n{prereq['python313Note']}" if prereq.get("python313Note") else ""
    )
    uv_note = f"\n\n{prereq['uvNote']}" if prereq.get("uvNote") else ""
    return f"""## ⚙️ Prerequisites

{prereq.get("summary", "")}

---

With **Python 3.13**:

The extension will prompt you to install the following packages if they are not available:

1. **Required Python packages**:
{required_list}
2. **Optional Python packages**:
{optional_list}{python313_note}

---

With **uv**:{uv_note}"""


def render_usage(usage_sections: list[dict[str, str]]) -> str:
    sections = "\n\n".join(
        f"### {section['title']}\n\n{section['markdown']}" for section in usage_sections
    )
    return f"""## 🎯 Usage

{sections}"""


def render_commands(commands: list[dict[str, Any]]) -> str:
    rows = "\n".join(
        f"| `{command_palette_title(command)}` | {command_description(command)} |"
        for command in commands
    )
    return f"""### 🎮 Available Commands

Access these commands via the Command Palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>):

| Command | Description |
| ------- | ----------- |
{rows}"""


def render_context_menus(
    menu_entries: list[dict[str, Any]], by_id: dict[str, dict[str, Any]]
) -> str:
    items = "\n".join(
        f"- **{command_palette_title(by_id[menu_entry['command']])}** - {menu_description(menu_entry, by_id[menu_entry['command']])}"
        for menu_entry in menu_entries
        if menu_entry.get("command") in by_id
    )
    return f"""### 🖱️ Context Menu Commands

Right-click on supported file types in the Explorer to access:

{items}"""


def render_settings(
    settings_groups: list[dict[str, Any]],
    properties: dict[str, Any],
) -> str:
    groups: list[str] = []
    for group in settings_groups:
        intro = ""
        if group["title"] == "🐍 Virtual Environment Settings":
            intro = (
                "The extension includes specific settings for virtual environment "
                "management:\n\n"
            )
        settings = "\n".join(
            render_setting(key, properties[key])
            for key in group.get("keys", [])
            if key in properties
        )
        groups.append(f"**{group['title']}**\n\n{intro}{settings}".rstrip())
    body = "\n\n".join(groups)
    return f"""## ⚙️ Settings

The extension can be configured through VSCode settings:

{body}"""


def render_troubleshooting(troubleshooting: dict[str, Any]) -> str:
    issues = "\n\n".join(
        f"{index}. **{issue['title']}**:\n   - {issue['body']}"
        for index, issue in enumerate(troubleshooting.get("issues", []), start=1)
    )
    help_items = "\n".join(f"- {item}" for item in troubleshooting.get("help", []))
    return f"""## 🔧 Troubleshooting

### ⚠️ Common Issues

{issues}

### 💬 Getting Help

{help_items}"""


def render_contributing(contributing: dict[str, Any]) -> str:
    steps = "\n".join(
        f"{index}. {step}"
        for index, step in enumerate(contributing.get("steps", []), start=1)
    )
    return f"""## 🤝 Contributing

{contributing.get("intro", "")}

**Development Setup**

{steps}"""


def render_footer(development: dict[str, str], acknowledgments: list[str]) -> str:
    items = "\n".join(f"- {item}" for item in acknowledgments)
    return f"""## 🛠️ Development

See the [{development.get("title", "Development Guide")}]({development.get("link", "docs/DEVELOPMENT.md")})

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

{items}"""


def generate(paths: Paths) -> tuple[str, list[str]]:
    package = load_json(paths.package_json)
    doc = load_json(paths.documentation_json)
    warnings: list[str] = []

    display_name = package.get("displayName", package.get("name", "Extension"))
    package_version = package.get("version", "0.0.0")
    version = resolve_version(package, paths.version)
    if paths.version is not None and paths.version != package_version:
        warnings.append(
            f"--version {paths.version} overrides package.json version {package_version}"
        )

    header = doc.get("header", {})
    tagline = header.get("tagline", package.get("description", ""))
    icon = header.get("icon", package.get("icon", ""))
    links = header.get("links", {})
    changelog_link, changelog_warnings = build_changelog_link(
        paths.root, version, links
    )
    warnings.extend(changelog_warnings)
    release_notes_link = build_release_notes_link(version, links)

    python_packages = doc.get("pythonPackages", {})
    required = python_packages.get("required", [])
    optional = python_packages.get("optional", [])

    palette_commands = command_palette_commands(package)
    by_id = commands_by_id(package)
    context_menu_entries = explorer_context_menu_entries(package)
    warnings.extend(validate_command_documentation(package))

    settings_groups = doc.get("settingsGroups", [])
    properties = (
        package.get("contributes", {}).get("configuration", {}).get("properties", {})
    )
    warnings.extend(validate_settings_groups(package, settings_groups))

    sections = [
        render_banner(paths),
        render_header(
            display_name,
            version,
            tagline,
            icon,
            links,
            changelog_link,
            release_notes_link,
            header.get("warnings", []),
        ),
        render_features(package, doc, doc.get("features", [])),
        f"## 📸 Screenshot Gallery\n\n{render_screenshots(doc.get('screenshots', []))}",
        render_installation(required, optional),
        render_prerequisites(doc.get("prerequisites", {}), required, optional),
        render_usage(doc.get("usageSections", [])),
        render_commands(palette_commands),
        render_context_menus(context_menu_entries, by_id),
        render_settings(settings_groups, properties),
        render_troubleshooting(doc.get("troubleshooting", {})),
        render_contributing(doc.get("contributing", {})),
        render_footer(doc.get("development", {}), doc.get("acknowledgments", [])),
    ]

    content = "\n\n".join(section for section in sections if section) + "\n"
    return content, warnings


def main(argv: list[str] | None = None) -> int:
    paths = parse_args(argv)
    try:
        content, warnings = generate(paths)
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    paths.output.parent.mkdir(parents=True, exist_ok=True)
    paths.output.write_text(content, encoding="utf-8")
    print(f"Wrote {paths.output}")

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
