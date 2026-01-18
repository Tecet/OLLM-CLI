# Release Checklist

This document provides a comprehensive checklist for releasing new versions of OLLM CLI. Follow these steps in order to ensure consistent, high-quality releases.

## Pre-Release Verification

Before starting the release process, ensure all quality checks pass:

- [ ] **All tests pass**: Run `npm test` and verify all unit and integration tests pass
- [ ] **Linting passes**: Run `npm run lint` and fix any linting errors
- [ ] **Build succeeds**: Run `npm run build` and verify the build completes without errors
- [ ] **Manual testing complete**: Test key features manually in interactive and non-interactive modes
- [ ] **Documentation updated**: Ensure all documentation reflects current functionality
- [ ] **CHANGELOG.md updated**: Add entries for all changes in the [Unreleased] section

## Version Bump

Determine the appropriate version increment based on changes:

- **Major version** (X.0.0): Breaking changes that require user action
- **Minor version** (0.X.0): New features without breaking changes
- **Patch version** (0.0.X): Bug fixes without new features

### Version Bump Steps

- [ ] **Determine version type**: Choose major, minor, or patch based on changes
- [ ] **Run version bump**: Execute `npm version [major|minor|patch]`
  ```bash
  # For a minor release (new features, no breaking changes)
  npm version minor
  
  # For a patch release (bug fixes only)
  npm version patch
  
  # For a major release (breaking changes)
  npm version major
  ```
- [ ] **Verify version in package.json files**: Check that all package.json files in the monorepo have been updated
  ```bash
  # Check root package.json
  cat package.json | grep version
  
  # Check CLI package
  cat packages/cli/package.json | grep version
  
  # Check core package
  cat packages/core/package.json | grep version
  ```
- [ ] **Verify CHANGELOG.md entry**: Ensure the version section was created with the correct version number and date
- [ ] **Review git commit**: Check that the version bump commit was created with the correct message

## Build and Test

Perform a clean build and comprehensive testing:

- [ ] **Clean build**: Remove old build artifacts and rebuild
  ```bash
  npm run clean
  npm run build
  ```
- [ ] **Run full test suite**: Execute all tests including property-based tests
  ```bash
  npm test
  ```
- [ ] **Test global install locally**: Install the package globally from the local directory
  ```bash
  npm pack
  npm install -g ./ollm-cli-*.tgz
  ```
- [ ] **Verify ollm command works**: Test that the global command is available
  ```bash
  which ollm
  ollm --version
  ```
- [ ] **Run basic functionality test**: Execute a simple command to verify core functionality
  ```bash
  ollm -p "Hello, world!"
  ```
- [ ] **Test on macOS** (if available): Install and test on macOS
- [ ] **Test on Linux** (if available): Install and test on Linux
- [ ] **Test on Windows** (if available): Install and test on Windows

## Publish

Publish the package to npm:

- [ ] **Ensure logged into npm**: Verify npm authentication
  ```bash
  npm whoami
  ```
  If not logged in, run `npm login`
- [ ] **Publish to npm**: Publish the package
  ```bash
  npm publish
  ```
- [ ] **Verify on npm registry**: Check that the package is available
  ```bash
  npm info ollm-cli
  ```
  Verify the latest version matches your release

## Post-Release Verification

Verify the release is working correctly:

- [ ] **Run automated verification script**: Execute the release verification script
  ```bash
  npm run verify-release
  ```
  This script will automatically:
  - Check npm registry for the published version
  - Install the package in a temporary directory
  - Verify the ollm command is available
  - Verify ollm --version returns the correct version
  - Run a basic smoke test
  - Exit with non-zero status on any failure
- [ ] **Create GitHub release**: Create a new release on GitHub with release notes
  - Go to https://github.com/[user]/ollm-cli/releases/new
  - Select the version tag created by `npm version`
  - Use the release notes template (see `.github/release-template.md`)
  - Include highlights, new features, bug fixes, and breaking changes
  - Add installation and upgrade instructions
- [ ] **Test global install from npm**: Install the published package
  ```bash
  npm install -g ollm-cli
  ```
- [ ] **Verify version**: Check that the installed version is correct
  ```bash
  ollm --version
  ```
- [ ] **Run smoke test**: Execute a basic command to verify functionality
  ```bash
  ollm -p "test"
  ```
- [ ] **Update documentation site** (if applicable): Deploy updated documentation
- [ ] **Announce release** (if applicable): Post release announcement to relevant channels

## Rollback Procedures

If issues are discovered after release, follow these steps:

### Option 1: Deprecate and Publish Fix

If the issue is critical but not security-related:

- [ ] **Deprecate the broken version**: Mark the version as deprecated on npm
  ```bash
  npm deprecate ollm-cli@X.X.X "Critical bug: [description]. Please upgrade to X.X.Y"
  ```
- [ ] **Fix the issue**: Make necessary code changes
- [ ] **Publish fixed version**: Follow the release process for a patch version
- [ ] **Update GitHub release notes**: Add a note about the issue and fix

### Option 2: Unpublish (Within 72 Hours)

If the issue is discovered within 72 hours of publishing:

- [ ] **Unpublish the version**: Remove the version from npm (only possible within 72 hours)
  ```bash
  npm unpublish ollm-cli@X.X.X
  ```
  **Warning**: This should only be used for critical security issues or completely broken releases
- [ ] **Fix the issue**: Make necessary code changes
- [ ] **Publish corrected version**: Follow the release process again
- [ ] **Update GitHub release**: Delete the old release and create a new one

### Option 3: Security Issue

If a security vulnerability is discovered:

- [ ] **Immediately deprecate affected versions**: Mark all affected versions as deprecated
  ```bash
  npm deprecate ollm-cli@X.X.X "Security vulnerability: [CVE or description]. Please upgrade immediately to X.X.Y"
  ```
- [ ] **Publish security fix**: Release a patch version with the fix
- [ ] **Update GitHub release**: Add a security advisory
- [ ] **Notify users**: Post security advisory on GitHub and relevant channels

## Post-Release Cleanup

After a successful release:

- [ ] **Clean up local test installations**: Remove test tarballs
  ```bash
  rm ollm-cli-*.tgz
  ```
- [ ] **Update [Unreleased] section in CHANGELOG.md**: Add empty sections for next release
- [ ] **Close related issues**: Close any GitHub issues that were resolved in this release
- [ ] **Update project board** (if applicable): Move completed items to "Done"

## Notes

- Always test the release process in a staging environment first if possible
- Keep the npm authentication token secure and never commit it to version control
- Document any issues encountered during the release process to improve this checklist
- For major releases, consider a beta or release candidate phase for community testing

## Emergency Contacts

- **npm Support**: https://www.npmjs.com/support
- **GitHub Support**: https://support.github.com/

## Release History

Track recent releases for reference:

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.0 | 2026-01-15 | Initial | First public release |

---

**Last Updated**: 2026-01-15
