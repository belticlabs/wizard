/**
 * YAML generator for .beltic.yaml configuration
 * Uses LLM to analyze codebase and generate appropriate configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { BelticYamlConfig, WizardOptions } from '../utils/types';
import type { DetectionResult } from './detector';
import { getSourceFiles, readFileContent } from './detector';
import { debug } from '../utils/debug';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL } from '../lib/constants';

/**
 * Generate .beltic.yaml configuration
 */
export async function generateBelticYaml(
  installDir: string,
  detection: DetectionResult,
  options: WizardOptions,
): Promise<BelticYamlConfig> {
  // Try LLM-enhanced generation first
  try {
    const enhanced = await generateWithLLM(installDir, detection, options);
    if (enhanced) {
      return enhanced;
    }
  } catch (error) {
    debug('LLM generation failed, using default config:', error);
  }

  // Fall back to basic detection-based config
  return generateBasicConfig(detection);
}

/**
 * Generate configuration with LLM analysis
 */
async function generateWithLLM(
  installDir: string,
  detection: DetectionResult,
  options: WizardOptions,
): Promise<BelticYamlConfig | null> {
  const anthropic = new Anthropic({
    apiKey: options.anthropicKey,
  });

  // Get source files for analysis
  const sourceFiles = await getSourceFiles(installDir, detection.language, 10);

  // Build file contents for context
  const fileContents: { path: string; content: string }[] = [];
  for (const file of sourceFiles) {
    const content = readFileContent(installDir, file);
    if (content) {
      fileContents.push({ path: file, content });
    }
  }

  const prompt = buildYamlGenerationPrompt(detection, fileContents);

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract YAML from response
    const content = response.content[0];
    if (content.type === 'text') {
      const yamlMatch = content.text.match(/```yaml\n([\s\S]*?)\n```/);
      if (yamlMatch) {
        const parsed = yaml.load(yamlMatch[1]) as BelticYamlConfig;
        // Validate basic structure
        if (parsed.version && parsed.agent?.paths?.include) {
          return parsed;
        }
      }

      // Try parsing the entire response as YAML if no code block
      try {
        const parsed = yaml.load(content.text) as BelticYamlConfig;
        if (parsed.version && parsed.agent?.paths?.include) {
          return parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }
  } catch (error) {
    debug('Anthropic API error:', error);
    throw error;
  }

  return null;
}

/**
 * Build prompt for YAML generation
 */
function buildYamlGenerationPrompt(
  detection: DetectionResult,
  fileContents: { path: string; content: string }[],
): string {
  const filesContext = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return `You are analyzing an AI agent codebase to generate a .beltic.yaml configuration file.

## Detected Information
- Language: ${detection.language}
- Deployment Type: ${detection.deploymentType}
- Model Provider: ${detection.modelProvider || 'unknown'}
- Agent Name: ${detection.agentName}
- Entry Points: ${detection.entryPoints.join(', ') || 'none detected'}
- Package Manager: ${detection.packageManager || 'unknown'}

## Source Files
${filesContext}

## Task
Generate a .beltic.yaml configuration file for this agent. The configuration should:

1. Include appropriate file patterns that capture all agent code
2. Exclude test files, build artifacts, dependencies, and environment files
3. Use the correct deployment type
4. Include any internal dependencies if this is a monorepo

Return ONLY the YAML configuration wrapped in \`\`\`yaml code blocks. Do not include any explanation.

Example format:
\`\`\`yaml
version: "1.0"

agent:
  paths:
    include:
      - "src/**"
      - "package.json"
    exclude:
      - "**/*.test.*"
      - "**/node_modules/**"
  deployment:
    type: "standalone"
\`\`\``;
}

/**
 * Generate basic configuration from detection results
 */
function generateBasicConfig(detection: DetectionResult): BelticYamlConfig {
  const config: BelticYamlConfig = {
    version: '1.0',
    agent: {
      paths: {
        include: [...detection.includePatterns],
        exclude: [...detection.excludePatterns],
      },
      deployment: {
        type: detection.deploymentType,
      },
    },
  };

  return config;
}

/**
 * Write .beltic.yaml configuration to file
 */
export function writeBelticYaml(
  installDir: string,
  config: BelticYamlConfig,
): void {
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
  });

  const header = `# Beltic Configuration File
# Generated by @belticlabs/wizard
# See: https://github.com/belticlabs/beltic-cli

`;

  fs.writeFileSync(
    path.join(installDir, '.beltic.yaml'),
    header + yamlContent,
    'utf-8',
  );
}

/**
 * Check if .beltic.yaml already exists
 */
export function belticYamlExists(installDir: string): boolean {
  return fs.existsSync(path.join(installDir, '.beltic.yaml'));
}

/**
 * Read existing .beltic.yaml configuration
 */
export function readBelticYaml(installDir: string): BelticYamlConfig | null {
  const yamlPath = path.join(installDir, '.beltic.yaml');
  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return yaml.load(content) as BelticYamlConfig;
  } catch {
    return null;
  }
}
