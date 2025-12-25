# Publishing Guide for Beltic Wizard

This guide covers the steps to publish the `@belticlabs/wizard` package to npm.

## Prerequisites

1. **npm Account**: You must have access to the `@belticlabs` organization on npm
2. **Authentication**: Be logged in to npm with appropriate permissions
3. **Version**: Ensure version number is updated in `package.json`

## Pre-Publishing Checklist

- [ ] All tests pass: `pnpm test`
- [ ] Code is linted: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated (if applicable)
- [ ] README.md is up to date
- [ ] AUTHENTICATION.md is up to date
- [ ] All changes committed to git
- [ ] Branch is ready to merge (or already merged to main)

## Publishing Steps

### 1. Build the Package

```bash
cd wizard
pnpm build
```

This will:
- Clean the `dist/` directory
- Compile TypeScript to JavaScript
- Make `dist/bin.js` executable

### 2. Verify Build Output

Check that the following files exist:
- `dist/bin.js` (executable)
- `dist/src/` (compiled source files)
- `dist/index.js` (if applicable)
- `dist/index.d.ts` (TypeScript definitions)

### 3. Test Locally (Optional but Recommended)

```bash
# Link the package locally
pnpm link --global

# Test in a sample project
cd /path/to/test/agent
npx beltic-wizard
```

### 4. Check Package Contents

Verify what will be published:

```bash
# See what files will be included
npm pack --dry-run

# Or actually create the tarball to inspect
npm pack
tar -tzf belticlabs-wizard-*.tgz
```

The `files` field in `package.json` controls what gets published:
- `dist/bin.*`
- `dist/src`
- `package.json`
- `README.md`

### 5. Publish to npm

#### For Public Release:

```bash
# Publish to npm (public access is configured in package.json)
npm publish --access public
```

#### For Beta/RC Release:

```bash
# Publish as beta
npm publish --tag beta

# Or as release candidate
npm publish --tag rc
```

#### For Dry Run (Test):

```bash
# See what would be published without actually publishing
npm publish --dry-run
```

### 6. Verify Publication

After publishing, verify:

1. **Check npm registry**:
   ```bash
   npm view @belticlabs/wizard
   ```

2. **Test installation**:
   ```bash
   # In a clean directory
   npx @belticlabs/wizard --version
   ```

3. **Check package page**: Visit https://www.npmjs.com/package/@belticlabs/wizard

## Version Management

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

### Updating Version

```bash
# Update version in package.json manually, or use npm version:

# Patch release (0.0.x -> 0.0.x+1)
npm version patch

# Minor release (0.x.0 -> 0.x+1.0)
npm version minor

# Major release (x.0.0 -> x+1.0.0)
npm version major
```

This will:
- Update `package.json` version
- Create a git commit
- Create a git tag

Then push the tag:
```bash
git push origin main --tags
```

## Post-Publishing

1. **Create GitHub Release** (if applicable):
   - Go to https://github.com/belticlabs/wizard/releases
   - Click "Draft a new release"
   - Select the tag created by `npm version`
   - Add release notes from CHANGELOG.md

2. **Update Documentation**:
   - Update any external docs that reference the wizard
   - Update installation instructions if needed

3. **Announce** (if applicable):
   - Update team/internal docs
   - Announce in relevant channels

## Troubleshooting

### Authentication Errors

If you get authentication errors:
```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami

# Check your npm organization access
npm org ls belticlabs
```

### Permission Errors

If you get permission errors:
- Ensure you're a member of the `@belticlabs` organization on npm
- Check that the package name matches your organization scope
- Verify `publishConfig.access` is set to `"public"` in `package.json`

### Build Errors

If build fails:
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Package Already Exists

If version already exists:
- Update version number in `package.json`
- Or use `npm publish --force` (not recommended for production)

## Current Configuration

- **Package Name**: `@belticlabs/wizard`
- **Access**: Public (`publishConfig.access: "public"`)
- **Current Version**: Check `package.json`
- **Package Manager**: pnpm (lockfile included)
- **Node Version**: >= 18.17.0
- **Files Included**: `dist/`, `package.json`, `README.md`

## Notes

- The package uses pnpm, but npm users can install it normally
- The default Anthropic API key is compiled into the package (Beltic covers costs)
- Authentication credentials are stored in `~/.beltic/credentials.json` (user-specific)
- The wizard requires an interactive terminal (TTY)

