# Setup Guide for Publishing @belticlabs/wizard

## Quick Start: How Users Will Run It

Once published, users can run:

```bash
npx @belticlabs/wizard
```

The `bin` entry in `package.json` is set to `"wizard"`, which allows npx to find and execute it.

## Setup Steps

### 1. Add GitHub Secrets

Go to: `https://github.com/belticlabs/wizard/settings/secrets/actions`

Add these secrets:

#### NPM_TOKEN
- **Purpose**: Authenticate with npm to publish packages
- **How to get**:
  1. Go to https://www.npmjs.com/settings/belticlabs/tokens
  2. Create new token → Automation token
  3. Permissions: Read and Publish
  4. Copy the token and add as `NPM_TOKEN` secret

#### ANTHROPIC_API_KEY
- **Purpose**: API key compiled into the wizard so Beltic covers costs
- **How to get**:
  1. Go to https://console.anthropic.com/
  2. Create or copy an API key
  3. Add as `ANTHROPIC_API_KEY` secret
- **Security**: This key is injected at build time and never appears in source code

### 2. Verify npm Organization

Ensure `@belticlabs` organization exists:

```bash
npm org ls belticlabs
```

If it doesn't exist, create it:
```bash
npm org create belticlabs
```

### 3. How Publishing Works

#### Automatic Publishing

When you push to `main`:
1. GitHub Actions checks if `package.json` version > published npm version
2. If yes, builds the package with API key injection
3. Publishes to npm as `@belticlabs/wizard`

#### Manual Publishing

```bash
# Update version
npm version patch  # or minor, major

# Push to trigger workflow
git push origin main
```

### 4. API Key Injection Process

The API key is securely injected during build:

1. **Source code** (`src/lib/constants.ts`):
   ```typescript
   export const DEFAULT_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
   ```

2. **Build script** (`scripts/inject-api-key.js`):
   - Runs after TypeScript compilation
   - Finds `process.env.ANTHROPIC_API_KEY || ""` in compiled JS
   - Replaces empty string with actual key from GitHub Secret
   - Key is compiled into bundle, never in source

3. **Result**: Users get a wizard with the API key baked in, but it never appears in git history or source code.

### 5. Testing Locally

```bash
# Build without key (for testing)
pnpm build

# Build with key injection (if you have it locally)
ANTHROPIC_API_KEY=your_key pnpm build:with-key

# Test the built package
node dist/bin.js --help

# Pack and test
pnpm pack
npm install -g belticlabs-wizard-*.tgz
wizard --help
```

## Workflow Files

- **`.github/workflows/publish.yml`**: Publishes to npm on version bump
- **`.github/workflows/build.yml`**: Builds and tests on PRs
- **`.github/workflows/pr-conventional-commit.yml`**: Validates commit messages

All workflows are configured for the `main` branch (not `master`).

## Troubleshooting

### "Package not found" after publishing
- Wait a few minutes for npm CDN propagation
- Check: `npm view @belticlabs/wizard`

### "NPM_TOKEN authentication failed"
- Verify token has publish permissions
- Check token hasn't expired
- Ensure organization has correct permissions

### "API key not working"
- Verify `ANTHROPIC_API_KEY` secret exists
- Check build logs for injection confirmation
- Test locally with `pnpm build:with-key`

