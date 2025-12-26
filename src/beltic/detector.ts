/**
 * Codebase detector for analyzing agent projects
 * Detects language, framework, model provider, and structure
 */

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import type { AgentInfo } from '../utils/types';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  INCLUDE_PATTERNS_BY_LANGUAGE,
} from '../lib/constants';

export type DetectionResult = {
  language: AgentInfo['language'];
  deploymentType: AgentInfo['deploymentType'];
  modelProvider?: AgentInfo['modelProvider'];
  agentName: string;
  agentVersion?: string;
  agentDescription?: string;
  entryPoints: string[];
  includePatterns: string[];
  excludePatterns: string[];
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'poetry' | 'cargo';
};

/**
 * Detect basic information about the codebase
 */
export async function detectCodebase(
  installDir: string,
): Promise<DetectionResult> {
  const language = await detectLanguage(installDir);
  const deploymentType = detectDeploymentType(installDir);
  const modelProvider = detectModelProvider(installDir, language);
  const { name, version, description } = detectAgentMetadata(
    installDir,
    language,
  );
  const entryPoints = detectEntryPoints(installDir, language);
  const packageManager = detectPackageManager(installDir);

  return {
    language,
    deploymentType,
    modelProvider,
    agentName: name,
    agentVersion: version,
    agentDescription: description,
    entryPoints,
    includePatterns:
      INCLUDE_PATTERNS_BY_LANGUAGE[language] ||
      INCLUDE_PATTERNS_BY_LANGUAGE.other,
    excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    packageManager,
  };
}

/**
 * Detect the primary programming language
 */
async function detectLanguage(
  installDir: string,
): Promise<AgentInfo['language']> {
  // Check for TypeScript
  const hasPackageJson = fs.existsSync(path.join(installDir, 'package.json'));
  const hasTsConfig = fs.existsSync(path.join(installDir, 'tsconfig.json'));

  if (hasTsConfig) {
    return 'typescript';
  }

  // Check for Python
  const hasPyprojectToml = fs.existsSync(
    path.join(installDir, 'pyproject.toml'),
  );
  const hasSetupPy = fs.existsSync(path.join(installDir, 'setup.py'));
  const hasRequirementsTxt = fs.existsSync(
    path.join(installDir, 'requirements.txt'),
  );

  if (hasPyprojectToml || hasSetupPy || hasRequirementsTxt) {
    return 'python';
  }

  // Check for JavaScript (package.json without tsconfig)
  if (hasPackageJson) {
    return 'javascript';
  }

  // Check for file extensions
  const tsFiles = await fg('**/*.ts', {
    cwd: installDir,
    ignore: ['**/node_modules/**'],
  });
  if (tsFiles.length > 0) {
    return 'typescript';
  }

  const pyFiles = await fg('**/*.py', {
    cwd: installDir,
    ignore: ['**/__pycache__/**', '**/venv/**', '**/.venv/**'],
  });
  if (pyFiles.length > 0) {
    return 'python';
  }

  const jsFiles = await fg('**/*.js', {
    cwd: installDir,
    ignore: ['**/node_modules/**'],
  });
  if (jsFiles.length > 0) {
    return 'javascript';
  }

  return 'other';
}

/**
 * Detect deployment type
 */
function detectDeploymentType(installDir: string): AgentInfo['deploymentType'] {
  // Check for serverless
  const hasServerlessYml = fs.existsSync(
    path.join(installDir, 'serverless.yml'),
  );
  const hasServerlessYaml = fs.existsSync(
    path.join(installDir, 'serverless.yaml'),
  );
  const hasSamTemplate = fs.existsSync(path.join(installDir, 'template.yaml'));

  if (hasServerlessYml || hasServerlessYaml || hasSamTemplate) {
    return 'serverless';
  }

  // Check for monorepo indicators
  const hasLernaJson = fs.existsSync(path.join(installDir, 'lerna.json'));
  const hasPnpmWorkspace = fs.existsSync(
    path.join(installDir, 'pnpm-workspace.yaml'),
  );
  const hasWorkspaces = checkPackageJsonWorkspaces(installDir);

  if (hasLernaJson || hasPnpmWorkspace || hasWorkspaces) {
    return 'monorepo';
  }

  // Check for plugin indicators
  const hasManifestJson = fs.existsSync(path.join(installDir, 'manifest.json'));
  const hasPluginJson = fs.existsSync(path.join(installDir, 'plugin.json'));

  if (hasManifestJson || hasPluginJson) {
    return 'plugin';
  }

  // Default to standalone
  return 'standalone';
}

/**
 * Detect AI model provider from dependencies
 */
function detectModelProvider(
  installDir: string,
  language: AgentInfo['language'],
): AgentInfo['modelProvider'] | undefined {
  if (language === 'typescript' || language === 'javascript') {
    const packageJsonPath = path.join(installDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson: {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps: Record<string, string> = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };

        if (deps['@anthropic-ai/sdk'] || deps['anthropic']) {
          return 'anthropic';
        }
        if (deps['openai']) {
          return 'openai';
        }
        if (deps['@google/generative-ai'] || deps['@google-cloud/aiplatform']) {
          return 'google';
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (language === 'python') {
    // Check pyproject.toml
    const pyprojectPath = path.join(installDir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      const content = fs.readFileSync(pyprojectPath, 'utf-8');
      if (content.includes('anthropic')) {
        return 'anthropic';
      }
      if (content.includes('openai')) {
        return 'openai';
      }
      if (
        content.includes('google-generativeai') ||
        content.includes('google-cloud-aiplatform')
      ) {
        return 'google';
      }
    }

    // Check requirements.txt
    const requirementsPath = path.join(installDir, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      const content = fs.readFileSync(requirementsPath, 'utf-8');
      if (content.includes('anthropic')) {
        return 'anthropic';
      }
      if (content.includes('openai')) {
        return 'openai';
      }
      if (
        content.includes('google-generativeai') ||
        content.includes('google-cloud-aiplatform')
      ) {
        return 'google';
      }
    }
  }

  return undefined;
}

/**
 * Detect agent metadata from package.json or pyproject.toml
 */
function detectAgentMetadata(
  installDir: string,
  _language: AgentInfo['language'],
): { name: string; version?: string; description?: string } {
  // Try package.json
  const packageJsonPath = path.join(installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return {
        name: packageJson.name || path.basename(installDir),
        version: packageJson.version,
        description: packageJson.description,
      };
    } catch {
      // Ignore parse errors
    }
  }

  // Try pyproject.toml (basic parsing)
  const pyprojectPath = path.join(installDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
    const descriptionMatch = content.match(
      /description\s*=\s*["']([^"']+)["']/,
    );

    return {
      name: nameMatch?.[1] || path.basename(installDir),
      version: versionMatch?.[1],
      description: descriptionMatch?.[1],
    };
  }

  // Fallback to directory name
  return {
    name: path.basename(installDir),
  };
}

/**
 * Detect entry points for the agent
 */
function detectEntryPoints(
  installDir: string,
  language: AgentInfo['language'],
): string[] {
  const entryPoints: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const packageJsonPath = path.join(installDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8'),
        );
        if (packageJson.main) {
          entryPoints.push(packageJson.main);
        }
        if (packageJson.module) {
          entryPoints.push(packageJson.module);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Common entry points
    const commonEntryPoints = [
      'src/index.ts',
      'src/index.js',
      'src/main.ts',
      'src/main.js',
      'src/agent.ts',
      'src/agent.js',
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
    ];

    for (const ep of commonEntryPoints) {
      if (fs.existsSync(path.join(installDir, ep))) {
        entryPoints.push(ep);
      }
    }
  }

  if (language === 'python') {
    // Common Python entry points
    const commonEntryPoints = [
      'src/main.py',
      'src/agent.py',
      'main.py',
      'agent.py',
      'app.py',
      '__main__.py',
    ];

    for (const ep of commonEntryPoints) {
      if (fs.existsSync(path.join(installDir, ep))) {
        entryPoints.push(ep);
      }
    }
  }

  return [...new Set(entryPoints)];
}

/**
 * Check if package.json has workspaces defined
 */
function checkPackageJsonWorkspaces(installDir: string): boolean {
  const packageJsonPath = path.join(installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return !!packageJson.workspaces;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Detect package manager
 */
function detectPackageManager(
  installDir: string,
): DetectionResult['packageManager'] | undefined {
  if (fs.existsSync(path.join(installDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(installDir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(installDir, 'package-lock.json'))) {
    return 'npm';
  }
  if (fs.existsSync(path.join(installDir, 'poetry.lock'))) {
    return 'poetry';
  }
  if (fs.existsSync(path.join(installDir, 'Cargo.lock'))) {
    return 'cargo';
  }
  if (
    fs.existsSync(path.join(installDir, 'requirements.txt')) ||
    fs.existsSync(path.join(installDir, 'pyproject.toml'))
  ) {
    return 'pip';
  }
  if (fs.existsSync(path.join(installDir, 'package.json'))) {
    return 'npm';
  }
  return undefined;
}

/**
 * Get a list of source files for analysis
 */
export async function getSourceFiles(
  installDir: string,
  language: AgentInfo['language'],
  limit = 20,
): Promise<string[]> {
  const patterns =
    INCLUDE_PATTERNS_BY_LANGUAGE[language] ||
    INCLUDE_PATTERNS_BY_LANGUAGE.other;

  const files = await fg(patterns, {
    cwd: installDir,
    ignore: DEFAULT_EXCLUDE_PATTERNS,
    absolute: false,
    onlyFiles: true,
  });

  // Prioritize certain files
  const priorityFiles = [
    'src/index.ts',
    'src/main.ts',
    'src/agent.ts',
    'src/index.js',
    'src/main.js',
    'main.py',
    'agent.py',
    'app.py',
  ];

  const sortedFiles = files.sort((a, b) => {
    const aIndex = priorityFiles.findIndex((p) => a.includes(p));
    const bIndex = priorityFiles.findIndex((p) => b.includes(p));
    if (aIndex !== -1 && bIndex === -1) return -1;
    if (aIndex === -1 && bIndex !== -1) return 1;
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    return 0;
  });

  return sortedFiles.slice(0, limit);
}

/**
 * Read file content safely with size limit
 */
export function readFileContent(
  installDir: string,
  filePath: string,
  maxSize = 50000,
): string | null {
  const fullPath = path.join(installDir, filePath);
  try {
    const stats = fs.statSync(fullPath);
    if (stats.size > maxSize) {
      // Read only the first portion
      const fd = fs.openSync(fullPath, 'r');
      const buffer = Buffer.alloc(maxSize);
      fs.readSync(fd, buffer, 0, maxSize, 0);
      fs.closeSync(fd);
      return buffer.toString('utf-8') + '\n... [truncated]';
    }
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}
