# NPM Publish Checklist - OLLM CLI v0.1.2

**Date:** January 30, 2026  
**Package:** `@tecet/ollm`  
**Version:** 0.1.2  
**Status:** 🔄 IN PROGRESS

---

## Pre-Publish Checklist

### ✅ Code Quality (COMPLETE)

- [x] All tests passing (100% - 1377 tests)
- [x] No linting errors (0 errors, 0 warnings)
- [x] No TypeScript errors (clean compilation)
- [x] Code formatted with Prettier
- [x] All changes committed to git

### ✅ Package Configuration (COMPLETE)

- [x] Version bumped to 0.1.2 in all package.json files
- [x] Package name set to `@tecet/ollm` (scoped package)
- [x] License set to Apache-2.0
- [x] Repository URL configured
- [x] Keywords added for discoverability
- [x] Engines specified (Node.js >=20.0.0)
- [x] Bin entry configured (`ollm` command)

### ✅ Documentation (COMPLETE)

- [x] README.md comprehensive and up-to-date
- [x] CHANGELOG.md updated with v0.1.2 changes
- [x] LICENSE file present (Apache 2.0)
- [x] 57 documentation files in `docs/` folder
- [x] Installation instructions clear
- [x] Usage examples provided

### ✅ Package Files (COMPLETE)

- [x] Create .npmignore file
- [x] Copy README.md to packages/cli/
- [x] Copy LICENSE to packages/cli/
- [x] Verify dist/ folder exists and is built
- [x] Test package with `npm pack`
- [x] Verify package contents (54 files, 1.8 MB)

### ❌ NPM Account (NOT READY)

- [ ] Login to npm: `npm login`
- [ ] Verify account: `npm whoami` (should show: tecet)
- [ ] Verify organization access (if using @tecet scope)

### ❌ Final Checks (NOT STARTED)

- [ ] Run `npm run build` one final time
- [ ] Run `npm test` one final time
- [ ] Run `npm pack` and inspect tarball
- [ ] Test installation from tarball locally
- [ ] Verify CLI works after installation

---

## Files to Create/Update

### 1. .npmignore (packages/cli/)

**Purpose:** Exclude unnecessary files from npm package

**Contents:**
```
# Source files
src/
*.ts
!*.d.ts
tsconfig*.json

# Development files
.vitest.setup.ts
vitest.config.ts
eslint.config.js
.prettierrc.json

# Test files
**/__tests__/
**/*.test.ts
**/*.test.js

# Build artifacts
tsconfig.tsbuildinfo
.tmp-*

# IDE
.vscode/
.idea/

# Logs
*.log
```

### 2. README.md (packages/cli/)

**Action:** Copy root README.md to packages/cli/

```bash
copy README.md packages\cli\README.md
```

### 3. LICENSE (packages/cli/)

**Action:** Copy root LICENSE to packages/cli/

```bash
copy LICENSE packages\cli\LICENSE
```

---

## Package Structure Verification

### Expected Structure in Tarball

```
@tecet-ollm-0.1.2.tgz
├── package.json
├── README.md
├── LICENSE
└── dist/
    ├── cli.js          # Main entry point
    └── ...             # All compiled files
```

### Files to Include (from package.json "files" field)

```json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]
```

### Files to Exclude (via .npmignore)

- Source TypeScript files (src/)
- Test files (__tests__/, *.test.ts)
- Development configs (tsconfig.json, eslint.config.js)
- Build artifacts (tsconfig.tsbuildinfo)
- IDE files (.vscode/, .idea/)

---

## Documentation Accessibility

### Current Status

✅ **Documentation is accessible** - 57 files in `docs/` folder at root level

### Package Installation

When users install via npm:
```bash
npm install -g @tecet/ollm
```

They get:
- ✅ CLI binary (`ollm` command)
- ✅ README.md (installation and quick start)
- ✅ LICENSE file

### Documentation Access

Users can access full documentation via:

1. **GitHub Repository** (recommended)
   - Link in README: https://github.com/tecet/ollm
   - All 57 docs files available online
   - Easy to browse and search

2. **npm Package Page**
   - README.md displayed on npmjs.com
   - Links to GitHub for full docs

3. **Local Installation** (optional)
   - Could include docs/ in package
   - Would increase package size significantly
   - Not recommended for CLI tools

**Recommendation:** Keep docs/ out of npm package, link to GitHub in README

---

## Publishing Steps

### Step 1: Login to npm

```bash
npm login
# Username: tecet
# Password: [your password]
# Email: [your email]
# OTP: [if 2FA enabled]
```

### Step 2: Verify Login

```bash
npm whoami
# Should output: tecet
```

### Step 3: Create Package Files

```bash
# Create .npmignore
# (see contents above)

# Copy README and LICENSE
copy README.md packages\cli\README.md
copy LICENSE packages\cli\LICENSE
```

### Step 4: Build Package

```bash
# Build all packages
npm run build

# Verify dist/ folder exists
dir packages\cli\dist
```

### Step 5: Test Package Locally

```bash
# Navigate to cli package
cd packages\cli

# Create tarball
npm pack

# This creates: tecet-ollm-0.1.2.tgz

# Install locally to test
npm install -g .\tecet-ollm-0.1.2.tgz

# Test CLI
ollm --version
ollm --help
```

### Step 6: Publish to npm

```bash
# From packages/cli directory
npm publish --access public

# Note: --access public is required for scoped packages
```

### Step 7: Verify Publication

```bash
# Check package on npm
npm view @tecet/ollm

# Test installation from npm
npm install -g @tecet/ollm

# Verify CLI works
ollm --version
```

---

## Post-Publish Tasks

### Immediate

- [ ] Verify package appears on npmjs.com: https://www.npmjs.com/package/@tecet/ollm
- [ ] Test global installation: `npm install -g @tecet/ollm`
- [ ] Test CLI functionality: `ollm --version`, `ollm --help`
- [ ] Create GitHub release (v0.1.2)
- [ ] Tag release: `git tag v0.1.2 && git push origin v0.1.2`
- [ ] Update GitHub release notes with CHANGELOG content

### Follow-up

- [ ] Monitor npm download stats
- [ ] Watch for issues/bug reports
- [ ] Respond to user feedback
- [ ] Plan v0.1.3 improvements

---

## Troubleshooting

### Issue: "need auth This command requires you to be logged in"

**Solution:**
```bash
npm login
# Or
npm adduser
```

### Issue: "403 Forbidden - PUT https://registry.npmjs.org/@tecet%2follm"

**Possible causes:**
1. Not logged in
2. No access to @tecet scope
3. Package name already taken

**Solutions:**
1. Run `npm login`
2. Verify scope ownership on npmjs.com
3. Choose different package name

### Issue: "Package name too similar to existing package"

**Solution:**
- Use scoped package: `@tecet/ollm` (already configured)
- Or choose different name: `ollm-cli-tecet`

### Issue: "You do not have permission to publish"

**Solution:**
- Verify you own the @tecet scope
- Or publish as unscoped: change name to `ollm-cli-tecet`
- Add `--access public` flag for scoped packages

---

## Package Size Optimization

### Current Package Size

**Before optimization:** ~2.5 MB (1251 files)

### Optimization Strategies

1. **Exclude source files** (.npmignore)
   - Remove src/ folder
   - Remove test files
   - Remove dev configs

2. **Include only dist/** (package.json "files")
   - Compiled JavaScript only
   - No TypeScript source

3. **Exclude documentation** (keep on GitHub)
   - Remove docs/ from package
   - Link to GitHub in README

**Expected size after optimization:** ~500 KB - 1 MB

---

## Success Criteria

All criteria must be met before publishing:

- [ ] npm login successful (tecet)
- [ ] Package files created (.npmignore, README, LICENSE)
- [ ] Package built successfully (dist/ folder)
- [ ] Package tested locally (npm pack + install)
- [ ] CLI works after local installation
- [ ] All documentation accessible (GitHub)
- [ ] CHANGELOG.md up to date
- [ ] Git tag created (v0.1.2)

---

## Important Notes

### Scoped Package (@tecet/ollm)

- Requires `--access public` flag when publishing
- Must own the @tecet scope on npm
- If scope not available, use unscoped name: `ollm-cli-tecet`

### Documentation Strategy

- **Include in package:** README.md, LICENSE
- **Exclude from package:** docs/ folder (57 files)
- **Access via:** GitHub repository (linked in README)
- **Benefit:** Smaller package size, easier to maintain

### Version Management

- Current: 0.1.2 (alpha)
- Next: 0.1.3 (bug fixes)
- Future: 0.2.0 (new features)

### Support Channels

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Documentation:** GitHub Pages (future)

---

## Next Steps

1. ✅ Create .npmignore file
2. ✅ Copy README.md to packages/cli/
3. ✅ Copy LICENSE to packages/cli/
4. ✅ Build package: `npm run build`
5. ✅ Test package: `npm pack` in packages/cli/
6. ❌ Login to npm: `npm login`
7. ❌ Publish: `npm publish --access public`
8. ❌ Verify: `npm view @tecet/ollm`
9. ❌ Create GitHub release
10. ❌ Announce release

---

**Status:** Ready for npm login and publish

**Estimated Time:** 15-30 minutes (including testing)

**Risk Level:** Low (alpha release, well-tested)
