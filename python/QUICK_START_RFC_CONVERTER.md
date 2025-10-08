# Quick Start Guide: RFC to GitHub Issues Converter

## 🚀 Quick Setup

1. **Run the setup script:**

   ```bash
   cd python
   ./setup_rfc_converter.sh
   ```

2. **Set up your GitHub token:**

   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

3. **Test with dry run:**
   ```bash
   python3 rfc_to_github_issues.py --dry-run --rfc-file 001-format-support.md
   ```

## 📋 What You Get

The script converts your RFC files into properly formatted GitHub issues with:

- ✅ **Smart Mapping**: Automatically maps RFC content to GitHub issue templates
- ✅ **Priority Mapping**: Converts RFC priorities to GitHub issue priorities
- ✅ **Label Mapping**: Maps RFC labels to appropriate GitHub issue labels
- ✅ **Template Support**: Supports both feature request and bug report templates
- ✅ **Dry Run Mode**: Preview what would be created before actually creating issues
- ✅ **Full Body Preview**: View complete issue content in dry run mode

## 🎯 Usage Examples

```bash
# Preview all RFCs (dry run)
python3 rfc_to_github_issues.py --dry-run

# Preview with full body content
python3 rfc_to_github_issues.py --dry-run --full-body

# Convert a specific RFC
python3 rfc_to_github_issues.py --rfc-file 001-format-support.md

# Convert all RFCs
python3 rfc_to_github_issues.py --all

# Get help
python3 rfc_to_github_issues.py --help
```

## 📁 Files Created

- `rfc_to_github_issues.py` - Main conversion script
- `requirements.txt` - Python dependencies
- `setup_rfc_converter.sh` - Setup script
- `README_RFC_CONVERTER.md` - Detailed documentation
- `env.example` - Example environment configuration

## 🔧 GitHub API Setup

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with `repo` scope (for private repos) or `public_repo` (for public repos)
3. Set the environment variable: `export GITHUB_TOKEN=your_token_here`

## 📊 Example Output

```
🔍 DRY RUN MODE - No issues will be created
============================================================
Processing RFC: 001-format-support.md
DRY RUN - Would create issue:
  Title: [Feature]: Add support for all possible formats
  Labels: ['enhancement', 'format-support', 'dependencies', 'needs-triage']
  Priority: High - Important for my workflow
  Body preview: **Original RFC**: [#001](docs/rfc/001-format-support.md)
  Full body length: 2515 characters
--------------------------------------------------
```

## 🆘 Need Help?

- See `README_RFC_CONVERTER.md` for detailed documentation
- Run `python3 rfc_to_github_issues.py --help` for command line options
- Check the setup script output for troubleshooting tips

## ✨ Ready to Go!

Your RFC to GitHub Issues converter is ready! Start with a dry run to see what would be created, then convert your RFCs to GitHub issues.
