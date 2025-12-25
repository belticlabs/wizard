export type WizardOptions = {
  /**
   * Whether to enable debug mode.
   */
  debug: boolean;

  /**
   * The directory containing the agent codebase.
   */
  installDir: string;

  /**
   * Anthropic API key for LLM analysis.
   */
  anthropicKey: string;

  /**
   * Skip signing the credential (only generate manifest).
   */
  skipSign: boolean;

  /**
   * Skip updating the README.md file.
   */
  skipReadme: boolean;

  /**
   * Overwrite existing Beltic files.
   */
  force: boolean;

  /**
   * Skip schema validation when signing (for local testing).
   */
  skipValidation: boolean;
};

export type FileChange = {
  filePath: string;
  oldContent?: string;
  newContent: string;
};

/**
 * Detected agent information from codebase analysis.
 */
export type AgentInfo = {
  /**
   * Programming language of the agent (typescript, python, etc.)
   */
  language: 'typescript' | 'python' | 'javascript' | 'other';

  /**
   * Deployment type
   */
  deploymentType: 'standalone' | 'monorepo' | 'embedded' | 'plugin' | 'serverless';

  /**
   * AI model provider detected in the codebase
   */
  modelProvider?: 'openai' | 'anthropic' | 'google' | 'other';

  /**
   * Agent name (inferred from package.json, pyproject.toml, or directory name)
   */
  agentName: string;

  /**
   * Agent version (if found)
   */
  agentVersion?: string;

  /**
   * Agent description (if found)
   */
  agentDescription?: string;

  /**
   * Detected tools/functions the agent uses
   */
  tools: AgentTool[];

  /**
   * File patterns to include in fingerprint
   */
  includePatterns: string[];

  /**
   * File patterns to exclude from fingerprint
   */
  excludePatterns: string[];

  /**
   * Entry point files
   */
  entryPoints: string[];
};

export type AgentTool = {
  toolId: string;
  toolName: string;
  toolDescription: string;
  riskCategory: 'data' | 'compute' | 'financial' | 'external';
  riskSubcategory: string;
  requiresAuth: boolean;
  requiresHumanApproval: boolean;
};

/**
 * Beltic YAML configuration structure
 */
export type BelticYamlConfig = {
  version: '1.0';
  agent: {
    paths: {
      include: string[];
      exclude: string[];
    };
    dependencies?: {
      internal?: string[];
      external?: string[];
    };
    deployment: {
      type: 'standalone' | 'monorepo' | 'embedded' | 'plugin' | 'serverless';
      location?: string;
      runtime?: string;
    };
  };
};
