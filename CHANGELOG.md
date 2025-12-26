# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2025-12-26)


### Features

* setup npm publishing and secure API key injection ([e30fe36](https://github.com/belticlabs/wizard/commit/e30fe36f39273d6690ca5a0868208c5f61ea59f8))


### Bug Fixes

* **ci:** handle first publish case in workflow ([6ff7d24](https://github.com/belticlabs/wizard/commit/6ff7d24f8af53f25be7195e543c215adf2eac673))

## [Unreleased]

### Added
- Initial changelog

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
