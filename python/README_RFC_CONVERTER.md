# RFC to GitHub Issues Converter

This tool converts RFC (Request for Comments) files from the `docs/rfc` folder into GitHub issues using the GitHub API. It automatically maps RFC content to the appropriate GitHub issue template format.

## Features

- ✅ **Dry Run Mode**: Preview what would be created without actually creating issues
- ✅ **Single RFC Processing**: Convert individual RFC files
- ✅ **Batch Processing**: Convert all RFCs at once
- ✅ **Smart Mapping**: Automatically maps RFC content to GitHub issue templates
- ✅ **Priority Mapping**: Converts RFC priorities to GitHub issue priorities
- ✅ **Label Mapping**: Maps RFC labels to appropriate GitHub issue labels
- ✅ **Template Support**: Supports both feature request and bug report templates

## Setup

### 1. Install Dependencies

```bash
cd python
pip install -r requirements.txt
```

### 2. GitHub API Setup

#### Option A: Environment Variable (Recommended)

1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate a new token with the following scopes:
   - `repo` (for private repositories) or `public_repo` (for public repositories)
   - `write:issues` (to create issues)
3. Set the environment variable:

```bash
export GITHUB_TOKEN=your_token_here
```

#### Option B: .env File

Create a `.env` file in the project root:

```bash
echo "GITHUB_TOKEN=your_token_here" > .env
```

### 3. Repository Configuration

Update the repository settings in the script:

```python
# In rfc_to_github_issues.py, update these variables:
REPO_OWNER = "your-github-username"
REPO_NAME = "scientific-data-viewer"
```

Or use command line arguments:

```bash
python rfc_to_github_issues.py --repo-owner your-username --repo-name your-repo
```

## Usage

### Dry Run (Recommended First Step)

Preview what would be created without actually creating issues:

```bash
python rfc_to_github_issues.py --dry-run
```

### Convert a Specific RFC

```bash
python rfc_to_github_issues.py --rfc-file 001-format-support.md
```

### Convert All RFCs

```bash
python rfc_to_github_issues.py --all
```

### Command Line Options

```bash
python rfc_to_github_issues.py --help
```

Options:

- `--dry-run`: Preview what would be created (no actual issues created)
- `--full-body`: Print the complete issue body content in dry run mode
- `--rfc-file RFC_FILE`: Convert a specific RFC file
- `--all`: Convert all RFC files
- `--repo-owner OWNER`: GitHub repository owner
- `--repo-name NAME`: GitHub repository name

## How It Works

### RFC Parsing

The script parses RFC markdown files and extracts:

- **Title**: From the first line (`# RFC #001: Title`)
- **Description**: From the `## Description` section
- **Requirements**: From the `## Requirements` section
- **Acceptance Criteria**: From the `## Acceptance Criteria` section
- **Priority**: From the `## Priority` section
- **Labels**: From the `## Labels` section
- **Status**: From the `## Status` section (if present)
- **Implementation**: From the `## Implementation` section (if present)

### GitHub Issue Mapping

#### Issue Type Detection

- **Feature Request**: Default for most RFCs
- **Bug Report**: When labels contain "bug" or "fix"

#### Priority Mapping

| RFC Priority  | GitHub Priority                  |
| ------------- | -------------------------------- |
| Critical/High | High - Important for my workflow |
| Medium        | Medium - Would be helpful        |
| Low           | Low - Nice to have               |

#### Label Mapping

- `enhancement` → `enhancement`
- `bug` → `bug`
- `testing` → `testing`
- `performance` → `performance`
- `ui` → `ui`
- `documentation` → `documentation`
- Others → Kept as-is
- Always adds `needs-triage`

#### Issue Body Structure

The generated issue body includes:

1. **Original RFC Reference**: Link to the original RFC file
2. **Feature Description**: From RFC description
3. **Problem Statement**: Derived from description
4. **Proposed Solution**: From requirements
5. **Use Cases**: From requirements
6. **Requirements**: Direct copy from RFC
7. **Acceptance Criteria**: Direct copy from RFC
8. **Technical Considerations**: From implementation section
9. **Current Status**: From status section (if present)
10. **Additional Context**: Priority, labels, and file path

## Example Output

### Dry Run Example

```
🔍 DRY RUN MODE - No issues will be created
============================================================
Found 52 RFC files to process
============================================================
Processing RFC: 001-format-support.md
DRY RUN - Would create issue:
  Title: [Feature]: Add support for all possible formats
  Labels: ['enhancement', 'format-support', 'dependencies', 'needs-triage']
  Priority: High - Important for my workflow
  Body preview: **Original RFC**: [#001](/path/to/001-format-support.md)

## Feature Description
Add comprehensive support for all file formats supported by xarray...
  Full body length: 1234 characters
--------------------------------------------------
```

### Full Body Dry Run Example

```
🔍 DRY RUN MODE - No issues will be created
📄 FULL BODY MODE - Complete issue content will be displayed
============================================================
Processing RFC: 001-format-support.md
DRY RUN - Would create issue:
  Title: [Feature]: Add support for all possible formats
  Labels: ['enhancement', 'format-support', 'dependencies', 'needs-triage']
  Priority: High - Important for my workflow
  Full body content:
  ============================================================
  **Original RFC**: [#001](docs/rfc/001-format-support.md)

  ## Feature Description
  Add comprehensive support for all file formats supported by xarray...

  ## Problem Statement
  This RFC addresses the need for: Add comprehensive support...

  ## Proposed Solution
  The solution should include:
  - Support all formats listed in https://docs.xarray.dev/...
  - Automatically propose to install required dependencies...

  ## Use Cases
  - Use case 1: Support all formats listed in https://docs.xarray.dev/...
  - Use case 2: Automatically propose to install required dependencies...

  ## Requirements
  - Support all formats listed in https://docs.xarray.dev/...
  - Automatically propose to install required dependencies...

  ## Acceptance Criteria
  - [ ] All xarray-supported formats can be opened
  - [ ] Missing dependencies are detected and installation is proposed
  - [ ] Format-to-dependency mapping is dynamically retrieved from xarray
  - [ ] Error handling for unsupported or corrupted files

  ## Technical Considerations
  Implementation details from RFC:

```

### Initial Implementation

#### ✅ **Completed Features:**

1. **Comprehensive Format Detection and Engine Mapping System**
   - Created a dynamic format-to-engine mapping system...
   - Supports all major formats: NetCDF, HDF5, Zarr, GRIB...
   - Automatic engine detection with fallback mechanisms
     ...

```

## Current Status
**MOSTLY IMPLEMENTED** ✅ (with known limitations)

## Additional Context
- Priority: High - Core functionality
- Labels: enhancement, format-support, dependencies
- Original RFC: docs/rfc/001-format-support.md

============================================================
Full body length: 2515 characters
--------------------------------------------------
```

### Successful Issue Creation

```
Processing RFC: 001-format-support.md
✅ Created issue #123: [Feature]: Add support for all possible formats
   URL: https://github.com/your-username/scientific-data-viewer/issues/123
```

## Troubleshooting

### Common Issues

1. **"GITHUB_TOKEN environment variable is required"**

   - Set up your GitHub token as described in the setup section

2. **"Repository not found"**

   - Check that the repository exists and you have write access
   - Verify the repository owner and name are correct

3. **"Invalid RFC format"**

   - Ensure the RFC file follows the expected format with `# RFC #001: Title` as the first line

4. **"Permission denied"**
   - Ensure your GitHub token has the required scopes (`repo` or `public_repo`, `write:issues`)

### Debug Mode

For more detailed error information, you can modify the script to print full error responses:

```python
# Add this after line with response.text
print(f"Full response: {response.json()}")
```

## Security Notes

- Never commit your GitHub token to version control
- Use environment variables or secure credential storage
- Regularly rotate your GitHub tokens
- Use the minimum required permissions for your token

## Contributing

To improve the RFC converter:

1. Add new label mappings in `map_labels_to_github()`
2. Enhance priority mapping in `map_priority_to_github()`
3. Improve issue body formatting in `create_issue_body()`
4. Add support for additional RFC sections

## License

This tool is part of the Scientific Data Viewer project and follows the same license terms.
