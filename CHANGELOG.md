# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- TypeScript type inference errors in command line argument parsing
- Proper type assertions for yargs argv and environment variables

## [0.1.0] - 2024-12-XX

### Added
- Claude-powered codebase analysis for agent detection
- Automatic `.beltic.yaml` configuration generation
- Agent manifest generation via Beltic CLI integration
- Code fingerprinting support
- Cryptographic keypair generation
- Credential signing workflow
- OAuth authentication with KYA platform
- Support for TypeScript/JavaScript and Python codebases
- Detection of deployment types (standalone, monorepo, embedded, plugin, serverless)
- Automatic `.gitignore` updates for Beltic files
- README.md integration with Beltic setup instructions
- Interactive CLI with clack prompts
- Non-interactive mode for CI/CD
- Debug mode for troubleshooting
- Force overwrite option for existing files

### Changed
- Improved codebase detection accuracy
- Enhanced YAML generation with better patterns

### Fixed
- Handle edge cases in package.json detection
- Fix gitignore pattern matching
