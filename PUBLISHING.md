# Publishing Guide - Scientific Data Viewer

This guide covers the complete process of publishing the Scientific Data Viewer VSCode extension to the marketplace.

## Prerequisites

### 1. Azure DevOps Account

You need an Azure DevOps account to publish extensions to the VSCode marketplace:

1. **Create account**: Go to [Azure DevOps](https://dev.azure.com)
2. **Create organization**: Set up a new organization
3. **Create publisher**: Create a publisher identity for your extensions

### 2. Personal Access Token

Create a Personal Access Token (PAT) for authentication:

1. **Go to User Settings** → **Personal Access Tokens**
2. **Create new token** with these scopes:
   - **Marketplace**: Manage
   - **Duration**: 1 year (or as needed)
3. **Save the token** securely (you won't see it again)

### 3. Install vsce

Install the Visual Studio Code Extension manager:

```bash
npm install -g vsce
```

## Pre-Publication Checklist

### 1. Code Quality

- [ ] **All tests pass**: `npm test`
- [ ] **No linting errors**: `npm run lint`
- [ ] **Code is properly formatted**
- [ ] **No console.log statements** in production code
- [ ] **Error handling** is comprehensive
- [ ] **Performance** is acceptable for large files

### 2. Documentation

- [ ] **README.md** is complete and accurate
- [ ] **CHANGELOG.md** is up to date
- [ ] **API documentation** is comprehensive
- [ ] **Screenshots** or GIFs showing functionality
- [ ] **Installation instructions** are clear
- [ ] **Usage examples** are provided

### 3. Package Configuration

- [ ] **package.json** is properly configured
- [ ] **Version number** is correct
- [ ] **Publisher name** is set correctly
- [ ] **Display name** and description are appropriate
- [ ] **Keywords** are relevant and helpful
- [ ] **Categories** are correctly assigned
- [ ] **Repository URL** is valid
- [ ] **License** is specified

### 4. Testing

- [ ] **Tested on multiple platforms** (Windows, macOS, Linux)
- [ ] **Tested with various file types** and sizes
- [ ] **Tested with different Python environments**
- [ ] **Error scenarios** are handled gracefully
- [ ] **Performance** is acceptable
- [ ] **User experience** is smooth

## Publishing Process

### 1. Prepare for Publication

```bash
# Update version in package.json
npm version patch  # or minor, major

# Update CHANGELOG.md with new features/fixes
# Update README.md if needed

# Run final tests
npm test
npm run lint

# Compile the extension
npm run compile
```

### 2. Package the Extension

```bash
# Create .vsix package
vsce package

# This creates: scientific-data-viewer-0.1.0.vsix
```

### 3. Test the Package

```bash
# Install the package locally for testing
code --install-extension scientific-data-viewer-0.1.0.vsix

# Test the installed extension
# Verify all functionality works correctly
```

### 4. Login to Azure DevOps

```bash
# Login with your publisher name
vsce login <your-publisher-name>

# Enter your Personal Access Token when prompted
```

### 5. Publish to Marketplace

```bash
# Publish the extension
vsce publish

# This will upload to the VSCode marketplace
```

### 6. Verify Publication

1. **Check marketplace**: Visit [VSCode Marketplace](https://marketplace.visualstudio.com/)
2. **Search for your extension**: Look for "Scientific Data Viewer"
3. **Verify details**: Check all information is correct
4. **Test installation**: Install from marketplace and test

## Post-Publication

### 1. Monitor and Respond

- **Check reviews** and ratings
- **Respond to issues** promptly
- **Monitor download statistics**
- **Gather user feedback**

### 2. Update Process

For future updates:

```bash
# Update version
npm version patch  # or minor, major

# Update CHANGELOG.md
# Make your changes
# Test thoroughly

# Package and publish
vsce package
vsce publish
```

### 3. Marketing and Promotion

- **Announce on social media**
- **Share in relevant communities**
- **Write blog posts** about the extension
- **Submit to extension galleries**
- **Ask for reviews** from users

## Troubleshooting

### Common Issues

#### Authentication Errors

```bash
# Re-login if token expires
vsce logout
vsce login <your-publisher-name>
```

#### Package Errors

```bash
# Check package.json for errors
vsce ls

# Validate package before publishing
vsce package --no-dependencies
```

#### Publishing Errors

- **Check internet connection**
- **Verify token permissions**
- **Check for duplicate names**
- **Review error messages**

### Error Messages

#### "Extension with same name already exists"

- **Change display name** in package.json
- **Check for existing extensions** with similar names
- **Use unique identifier**

#### "Invalid publisher"

- **Verify publisher name** in package.json
- **Check Azure DevOps** publisher settings
- **Ensure publisher exists**

#### "Package validation failed"

- **Check package.json** for required fields
- **Verify file structure**
- **Check for missing dependencies**

## Best Practices

### 1. Version Management

- **Use semantic versioning** (MAJOR.MINOR.PATCH)
- **Update CHANGELOG.md** for each release
- **Test thoroughly** before publishing
- **Increment version** appropriately

### 2. Quality Assurance

- **Automated testing** before publication
- **Manual testing** on multiple platforms
- **Performance testing** with large files
- **User acceptance testing**

### 3. Documentation

- **Keep README.md** up to date
- **Document breaking changes**
- **Provide migration guides**
- **Include troubleshooting sections**

### 4. User Experience

- **Clear error messages**
- **Helpful tooltips** and descriptions
- **Intuitive user interface**
- **Good performance**

## Security Considerations

### 1. Code Security

- **No hardcoded secrets** or API keys
- **Validate all inputs**
- **Handle errors securely**
- **Use secure coding practices**

### 2. User Data

- **Don't collect unnecessary data**
- **Handle user files securely**
- **Respect user privacy**
- **Follow data protection regulations**

### 3. Dependencies

- **Keep dependencies updated**
- **Check for security vulnerabilities**
- **Use trusted packages**
- **Minimize attack surface**

## Legal Considerations

### 1. Licensing

- **Choose appropriate license** (MIT recommended)
- **Include license file**
- **Respect third-party licenses**
- **Document license requirements**

### 2. Trademarks

- **Don't use trademarked names**
- **Check for conflicts**
- **Use original branding**
- **Respect intellectual property**

### 3. Privacy

- **Privacy policy** if collecting data
- **GDPR compliance** if applicable
- **Data handling** transparency
- **User consent** for data collection

## Analytics and Monitoring

### 1. Extension Analytics

- **Monitor download counts**
- **Track user ratings**
- **Analyze user feedback**
- **Identify popular features**

### 2. Performance Monitoring

- **Monitor extension performance**
- **Track error rates**
- **Identify bottlenecks**
- **Optimize based on data**

### 3. User Feedback

- **Respond to reviews**
- **Address user concerns**
- **Implement requested features**
- **Maintain good reputation**

## Support and Maintenance

### 1. User Support

- **Respond to issues** promptly
- **Provide helpful documentation**
- **Create troubleshooting guides**
- **Maintain community presence**

### 2. Regular Updates

- **Fix bugs** quickly
- **Add new features** regularly
- **Improve performance**
- **Stay compatible** with VSCode updates

### 3. Long-term Maintenance

- **Plan for long-term support**
- **Consider maintenance burden**
- **Document maintenance procedures**
- **Plan for handover** if needed

## Resources

### Official Documentation

- [VSCode Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce Documentation](https://github.com/Microsoft/vscode-vsce)
- [Azure DevOps](https://dev.azure.com)

### Community Resources

- [VSCode Extension Samples](https://github.com/Microsoft/vscode-extension-samples)
- [Extension Guidelines](https://code.visualstudio.com/api/extension-guides/overview)
- [Marketplace Guidelines](https://code.visualstudio.com/api/references/extension-manifest)

### Tools

- [vsce CLI](https://github.com/Microsoft/vscode-vsce)
- [Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-extension-pack)
- [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
