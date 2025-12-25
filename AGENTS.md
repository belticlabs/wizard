# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Philosophy & Guidelines

### Core Philosophy
- **Safety First**: Never risk user data. Always validate file paths, handle errors gracefully. When in doubt, ask.
- **Incremental Progress**: Break complex tasks into manageable stages.
- **Clear Intent**: Prioritize readability and maintainability.
- **User Experience**: Provide clear feedback and handle edge cases gracefully.

### Eight Honors and Eight Shames
- Shame in guessing APIs, Honor in careful research.
- Shame in vague execution, Honor in seeking confirmation.
- Shame in assuming business logic, Honor in human verification.
- Shame in creating interfaces, Honor in reusing existing ones.
- Shame in skipping validation, Honor in proactive testing.
- Shame in breaking architecture, Honor in following specifications.
- Shame in pretending to understand, Honor in honest ignorance.
- Shame in blind modification, Honor in careful refactoring.

### Quality Standards
- **English Only**: Comments and code must be in English.
- **TypeScript Formatting**: Always run formatter before committing.
- **Error Handling**: Use custom error classes with clear messages.
- **CHANGELOG Updates**: Always update CHANGELOG.md when making user-facing changes or significant internal changes.

## Project Identity

**Name**: Beltic Wizard  
**Purpose**: Claude-powered CLI tool that automatically analyzes AI agent codebases and generates Beltic credentials.  
**Core Value**: Automated, intelligent credential bootstrap with minimal developer effort.

## Technology Stack

- **Language**: TypeScript 5.0+
- **Runtime**: Node.js >= 18.0.0
- **Package Manager**: pnpm 10.23+
- **CLI Framework**: yargs 16.2+
- **Prompts**: @clack/prompts 0.7+
- **AI Integration**: @anthropic-ai/sdk 0.39+ (Claude API)
- **Testing**: Jest 29.5+ with ts-jest

## Repository Architecture

```
wizard/
├── src/
│   ├── run.ts              # Main entry point, orchestrates workflow
│   ├── beltic/             # Beltic CLI integration
│   │   ├── detector.ts     # Codebase detection
│   │   ├── cli.ts          # Beltic CLI command execution
│   │   └── yaml-generator.ts # .beltic.yaml generation
│   ├── lib/                # Core libraries
│   │   ├── api.ts          # KYA API client
│   │   ├── kya-oauth.ts    # OAuth authentication
│   │   └── prompts.ts      # User prompts
│   └── utils/              # Utilities
└── bin.ts                  # Binary entry point
```

## Key Workflows

### Development
1. **Understand**: Read `src/beltic/detector.ts` to understand detection patterns
2. **Implement**: Follow existing patterns, use clack for user interaction
3. **Verify**: Use `pnpm test` and manual testing
4. **Update**: Always update CHANGELOG.md for user-facing changes

### Commands
```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
pnpm try --install-dir /path/to/agent

# Test
pnpm test
```

## Common AI Tasks

### Adding Framework Detection
1. Update `src/beltic/detector.ts`
2. Add detection logic for new framework (check for config files, dependencies)
3. Add rules file if needed: `src/utils/rules/framework-rules.md`
4. Test with real codebase: `pnpm try --install-dir /path/to/framework-project`
5. **Update CHANGELOG.md** under Added section

### Improving Claude Integration
1. Review prompts in `src/lib/prompts.ts`
2. Update Claude API calls in `src/beltic/yaml-generator.ts` or `src/beltic/manifest.ts`
3. Test with various codebases
4. **Update CHANGELOG.md** under Changed section

### Fixing a Bug
1. Reproduce with test case
2. Add test if missing: `src/beltic/__tests__/detector.test.ts`
3. Fix the bug
4. Verify: `pnpm test`
5. **Update CHANGELOG.md** under Fixed section

## Git Workflow

### Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep commits focused and atomic
- **Always update CHANGELOG.md** for user-facing changes or significant internal changes

### Releases
- Version in `package.json` follows semantic versioning
- **Update CHANGELOG.md** for each release with date

## Boundaries

### Never Commit
- **API keys** (use environment variables)
- **Credentials** (`~/.beltic/credentials.json`)
- **node_modules/** (use pnpm-lock.yaml)
- **dist/** (build artifacts)

### Security Rules
1. **Never log sensitive data**: API keys, tokens, credentials
2. **Store credentials securely**: Use `~/.beltic/credentials.json` with restricted permissions
3. **Validate inputs**: Check file paths, validate YAML/JSON
4. **Error messages**: Don't leak sensitive information

