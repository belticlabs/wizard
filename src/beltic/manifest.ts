/**
 * Manifest utilities for patching and updating agent manifests
 * Uses LLM to analyze codebase and fill in appropriate values
 *
 * TODO: Safety evaluation scores should come from actual benchmark evaluations
 * once the evaluation platform is integrated.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL } from '../lib/constants';
import {
  PLACEHOLDER_ISSUER_DID,
  generatePlaceholderSubjectDid,
} from '../lib/constants';
import {
  getSourceFiles,
  readFileContent,
  type DetectionResult,
} from './detector';
import { debug } from '../utils/debug';

/**
 * Analyze codebase and generate intelligent manifest values using LLM
 */
export async function analyzeAndPatchManifest(
  installDir: string,
  agentName: string,
  detection: DetectionResult,
  anthropicKey: string,
  onProgress?: (message: string) => void,
): Promise<void> {
  const log = onProgress || ((msg: string) => debug(msg));

  const manifestPath = path.join(installDir, 'agent-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('agent-manifest.json not found');
  }

  log('Reading existing manifest...');
  const manifest = readJsonRecord(manifestPath, 'agent-manifest.json');

  // Get source files for analysis
  log('Discovering source files...');
  const sourceFiles = await getSourceFiles(installDir, detection.language, 15);
  log(`Found ${sourceFiles.length} source files to analyze`);

  const fileContents: { path: string; content: string }[] = [];
  for (const file of sourceFiles) {
    log(`  Reading: ${file}`);
    const content = readFileContent(installDir, file, 30000);
    if (content) {
      const lines = content.split('\n').length;
      const truncated = content.includes('[truncated]') ? ' (truncated)' : '';
      log(`  ✓ ${file} (${lines} lines${truncated})`);
      fileContents.push({ path: file, content });
    } else {
      log(`  ✗ ${file} (could not read)`);
    }
  }

  log(`\nAnalyzing ${fileContents.length} files with LLM...`);

  // Use LLM to analyze and generate values
  const analysis = await analyzeCodebaseForManifest(
    detection,
    fileContents,
    manifest,
    anthropicKey,
  );

  log('LLM analysis complete');

  // Log what was detected
  if (analysis.agentDescription) {
    log(
      `  Agent description: "${analysis.agentDescription.substring(0, 60)}..."`,
    );
  }
  if (analysis.primaryModelProvider) {
    log(`  Model provider: ${analysis.primaryModelProvider}`);
  }
  if (analysis.primaryModelFamily) {
    log(`  Model family: ${analysis.primaryModelFamily}`);
  }
  if (analysis.tools && analysis.tools.length > 0) {
    log(`  Tools detected: ${analysis.tools.length}`);
    for (const tool of analysis.tools.slice(0, 5)) {
      log(`    - ${tool.toolName} (${tool.riskCategory})`);
    }
    if (analysis.tools.length > 5) {
      log(`    ... and ${analysis.tools.length - 5} more`);
    }
  }
  if (analysis.kybTierRequired) {
    log(`  KYB tier: ${analysis.kybTierRequired}`);
  }

  // Merge analysis into manifest
  log('\nMerging analysis into manifest...');
  const patchedManifest = mergeAnalysisIntoManifest(
    manifest,
    analysis,
    agentName,
  );

  // Write updated manifest
  log('Writing updated manifest...');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(patchedManifest, null, 2),
    'utf-8',
  );
  log('Manifest updated successfully');
}

interface ManifestAnalysis {
  // Agent info
  agentDescription?: string;
  agentVersion?: string;

  // Model info
  primaryModelProvider?: string;
  primaryModelFamily?: string;

  // Tools and capabilities
  tools?: Array<{
    toolId: string;
    toolName: string;
    toolDescription: string;
    riskCategory: string;
    riskSubcategory: string;
    requiresAuth: boolean;
    requiresHumanApproval: boolean;
  }>;

  // Data handling
  dataEncryptionStandards?: string[];
  dataRetentionPolicy?: string;
  dataHandlingPractices?: string[];

  // Deployment
  deploymentEnvironment?: {
    type: string;
    description: string;
    runtime?: string;
  };

  // Security
  authenticationMethods?: string[];
  auditLogging?: boolean;

  // KYB tier assessment
  kybTierRequired?: string;
  kybTierJustification?: string;
}

type DeploymentEnvironment = {
  type: string;
  cloudProvider: string;
  primaryRegion?: string;
  complianceNotes?: string;
};

const MODEL_TOKEN_PATTERN = /^[A-Za-z0-9._:/+-]+$/;

const KYB_TIER_VALUES = new Set([
  'tier_0',
  'tier_1',
  'tier_2',
  'tier_3',
  'tier_4',
]);

const DEPLOYMENT_TYPE_VALUES = new Set([
  'cloud_managed',
  'cloud_self_managed',
  'on_premises',
  'hybrid',
  'edge',
]);

const CLOUD_PROVIDER_VALUES = new Set([
  'aws',
  'gcp',
  'azure',
  'oracle',
  'ibm',
  'alibaba',
  'other',
  'none',
]);

const DATA_ENCRYPTION_VALUES = new Set([
  'AES-128-at-rest',
  'AES-256-at-rest',
  'AES-128-GCM',
  'AES-256-GCM',
  'TLS-1.2-in-transit',
  'TLS-1.3-in-transit',
  'ChaCha20-Poly1305',
  'RSA-2048',
  'RSA-4096',
  'ECDHE',
  'other',
]);

const DATA_ENCRYPTION_ALIASES: Record<string, string> = {
  aes128atrest: 'AES-128-at-rest',
  aes256atrest: 'AES-256-at-rest',
  aes128gcm: 'AES-128-GCM',
  aes256gcm: 'AES-256-GCM',
  aes256gcmatrest: 'AES-256-at-rest',
  tls12intransit: 'TLS-1.2-in-transit',
  tls13intransit: 'TLS-1.3-in-transit',
  chacha20poly1305: 'ChaCha20-Poly1305',
  rsa2048: 'RSA-2048',
  rsa4096: 'RSA-4096',
  rsa2048forkeyexchange: 'RSA-2048',
  ecdhe: 'ECDHE',
};

const DID_IDENTIFIER_PATTERN = /^did:(web|key|ion|pkh|ethr):[a-zA-Z0-9._%-]+$/;
const VERIFICATION_METHOD_PATTERN =
  /^did:(web|key|ion|pkh|ethr):[a-zA-Z0-9._%-]+#[a-zA-Z0-9_-]+$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readJsonRecord(
  filePath: string,
  context: string,
): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`${context} must be a JSON object`);
  }
  return record;
}

function normalizeModelToken(value: string): string {
  return value.trim();
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeModelProvider(value: string): string {
  const normalized = normalizeModelToken(value);
  if (!normalized) {
    return 'other';
  }
  return MODEL_TOKEN_PATTERN.test(normalized) ? normalized : 'other';
}

function normalizeModelFamily(value: string): string {
  const normalized = normalizeModelToken(value);
  if (!normalized) {
    return 'other';
  }
  return MODEL_TOKEN_PATTERN.test(normalized) ? normalized : 'other';
}

function normalizeKybTier(value: string): string | undefined {
  const normalized = normalizeToken(value).replace(/^tier-?/, 'tier_');
  if (KYB_TIER_VALUES.has(normalized)) {
    return normalized;
  }
  return undefined;
}

function normalizeDataEncryptionStandards(
  values: string[],
): string[] | undefined {
  const normalized = new Set<string>();
  for (const value of values) {
    const direct = value.trim();
    if (DATA_ENCRYPTION_VALUES.has(direct)) {
      normalized.add(direct);
      continue;
    }

    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const mapped = DATA_ENCRYPTION_ALIASES[key];
    if (mapped) {
      normalized.add(mapped);
    }
  }

  if (normalized.size === 0) {
    return ['other'];
  }
  return [...normalized];
}

function normalizeDeploymentEnvironment(
  value: unknown,
): DeploymentEnvironment | undefined {
  const obj = asRecord(value);
  if (!obj) {
    return undefined;
  }

  const rawType = typeof obj.type === 'string' ? normalizeToken(obj.type) : '';
  const rawCloudProvider =
    typeof obj.cloudProvider === 'string'
      ? normalizeToken(obj.cloudProvider)
      : '';
  const rawDescription =
    typeof obj.description === 'string' ? obj.description : undefined;

  const typeAliases: Record<string, string> = {
    development: 'cloud_managed',
    staging: 'cloud_managed',
    production: 'cloud_managed',
    cloud: 'cloud_managed',
    cloudmanaged: 'cloud_managed',
    'cloud-self-managed': 'cloud_self_managed',
    cloudselfmanaged: 'cloud_self_managed',
    onpremises: 'on_premises',
    'on-premises': 'on_premises',
  };

  const providerAliases: Record<string, string> = {
    amazon: 'aws',
    bedrock: 'aws',
    google: 'gcp',
    gcp: 'gcp',
    azure: 'azure',
    msft: 'azure',
  };

  const mappedType = typeAliases[rawType] ?? rawType;
  const mappedProvider =
    providerAliases[rawCloudProvider] ?? rawCloudProvider ?? '';

  if (!DEPLOYMENT_TYPE_VALUES.has(mappedType)) {
    if (rawDescription) {
      return {
        type: 'cloud_managed',
        cloudProvider: 'other',
        complianceNotes: rawDescription.slice(0, 500),
      };
    }
    return undefined;
  }

  const cloudProvider = CLOUD_PROVIDER_VALUES.has(mappedProvider)
    ? mappedProvider
    : 'other';

  const region =
    typeof obj.primaryRegion === 'string' &&
    /^[A-Z]{2}$/.test(obj.primaryRegion)
      ? obj.primaryRegion
      : undefined;

  const notes =
    typeof obj.complianceNotes === 'string'
      ? obj.complianceNotes
      : rawDescription;

  const result: DeploymentEnvironment = {
    type: mappedType,
    cloudProvider,
  };

  if (region) {
    result.primaryRegion = region;
  }
  if (notes) {
    result.complianceNotes = notes.slice(0, 500);
  }

  return result;
}

function normalizeManifestForSchemaCompatibility(
  manifest: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...manifest };

  // Clean up invalid fields that are not in the schema.
  const fieldsToRemove = [
    '_metadata',
    'fingerprintMetadata',
    'incidentResponseSlo', // wrong case
    'manifestRevision',
    'manifestSchemaVersion',
    'deploymentContext', // not in schema
    'subjectDid', // not in schema (subject info is in issuerDid context)
  ];
  for (const field of fieldsToRemove) {
    if (field in result) {
      delete result[field];
    }
  }

  if (
    typeof result.issuerDid !== 'string' ||
    !DID_IDENTIFIER_PATTERN.test(result.issuerDid)
  ) {
    result.issuerDid = PLACEHOLDER_ISSUER_DID;
  }

  if (
    typeof result.primaryModelProvider !== 'string' ||
    result.primaryModelProvider.trim().length === 0
  ) {
    result.primaryModelProvider = 'other';
  } else {
    result.primaryModelProvider = normalizeModelProvider(
      result.primaryModelProvider,
    );
  }

  if (
    typeof result.primaryModelFamily !== 'string' ||
    result.primaryModelFamily.trim().length === 0
  ) {
    result.primaryModelFamily = 'other';
  } else {
    result.primaryModelFamily = normalizeModelFamily(result.primaryModelFamily);
  }

  if (typeof result.kybTierRequired === 'string') {
    result.kybTierRequired =
      normalizeKybTier(result.kybTierRequired) ?? 'tier_0';
  }

  if (Array.isArray(result.dataEncryptionStandards)) {
    result.dataEncryptionStandards = normalizeDataEncryptionStandards(
      result.dataEncryptionStandards.filter(
        (v): v is string => typeof v === 'string',
      ),
    );
  } else if (!result.dataEncryptionStandards) {
    result.dataEncryptionStandards = ['other'];
  }

  const deployment = normalizeDeploymentEnvironment(
    result.deploymentEnvironment,
  );
  if (deployment) {
    result.deploymentEnvironment = deployment;
  } else {
    result.deploymentEnvironment = {
      type: 'cloud_managed',
      cloudProvider: 'other',
    };
  }

  if (
    Array.isArray(result.complianceCertifications) &&
    result.complianceCertifications.length === 0
  ) {
    delete result.complianceCertifications;
  }

  if (
    typeof result.systemConfigFingerprint === 'string' &&
    result.systemConfigFingerprint.startsWith('sha256:')
  ) {
    result.systemConfigFingerprint = result.systemConfigFingerprint.replace(
      'sha256:',
      '',
    );
  }

  const issuerDid = result.issuerDid as string;
  if (
    typeof result.verificationMethod !== 'string' ||
    !VERIFICATION_METHOD_PATTERN.test(result.verificationMethod)
  ) {
    result.verificationMethod = `${issuerDid}#key-1`;
  }

  const proof = asRecord(result.proof);
  if (!proof) {
    result.proof = {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${issuerDid}#key-1`,
      proofValue: 'placeholder-will-be-replaced-during-signing',
    };
  } else if (
    typeof proof.verificationMethod !== 'string' ||
    !VERIFICATION_METHOD_PATTERN.test(proof.verificationMethod)
  ) {
    proof.verificationMethod = `${issuerDid}#key-1`;
    result.proof = proof;
  }

  return result;
}

/**
 * Use LLM to analyze codebase and extract manifest values
 */
async function analyzeCodebaseForManifest(
  detection: DetectionResult,
  fileContents: { path: string; content: string }[],
  existingManifest: Record<string, unknown>,
  anthropicKey: string,
): Promise<ManifestAnalysis> {
  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  const filesContext = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  const prompt = `You are analyzing an AI agent codebase to extract information for its credential manifest.

## Detected Information
- Language: ${detection.language}
- Deployment Type: ${detection.deploymentType}
- Agent Name: ${detection.agentName}
- Detected Model Provider: ${detection.modelProvider || 'unknown'}

## Existing Manifest
${JSON.stringify(existingManifest, null, 2)}

## Source Files
${filesContext}

## Task
Analyze the code and provide accurate values for the agent manifest. Return a JSON object with the following fields (only include fields you can determine from the code):

{
  "agentDescription": "A clear 1-2 sentence description of what this agent does",
  "agentVersion": "Version string if found in code",
  
  "primaryModelProvider": "Free-form provider string from the codebase (for example: openai, anthropic, openrouter, xai)",
  "primaryModelFamily": "Free-form model family/id string from the codebase (for example: gpt-4o, claude-3.5-sonnet, qwen-2.5-72b-instruct)",
  
  "tools": [
    {
      "toolId": "snake_case_id",
      "toolName": "Human Readable Name",
      "toolDescription": "What the tool does (10-50 words)",
      "riskCategory": "One of: data, compute, financial, external",
      "riskSubcategory": "Specific subcategory",
      "requiresAuth": true/false,
      "requiresHumanApproval": true/false
    }
  ],
  
  "dataEncryptionStandards": ["Array of: AES-128-at-rest, AES-256-at-rest, AES-128-GCM, AES-256-GCM, TLS-1.2-in-transit, TLS-1.3-in-transit, ChaCha20-Poly1305, RSA-2048, RSA-4096, ECDHE, other"],
  
  "dataRetentionPolicy": "Description of how long data is retained",
  
  "dataHandlingPractices": ["Array of practices like: encryption-at-rest, encryption-in-transit, no-persistent-storage, anonymization, etc."],
  
  "deploymentEnvironment": {
    "type": "One of: development, staging, production, hybrid",
    "description": "Brief description of deployment",
    "runtime": "e.g., python3.11, node20, docker"
  },
  
  "authenticationMethods": ["Array of: api-key, oauth2, jwt, basic-auth, none"],
  
  "auditLogging": true/false,
  
  "kybTierRequired": "One of: tier_0, tier_1, tier_2, tier_3, tier_4 (based on risk level)",
  "kybTierJustification": "Brief explanation of why this tier is appropriate"
}

Risk subcategories:
- data: data_read_internal, data_read_external, data_write_internal, data_write_external, data_delete, data_export
- compute: compute_code_execution, compute_query_generation, compute_api_call, compute_transformation, compute_analysis
- financial: financial_read, financial_transaction, financial_account_access, financial_payment_initiation
- external: external_internet_access, external_email, external_notification, external_authentication, external_file_access

KYB Tier Guidelines:
- tier_0: Minimal risk - read-only, no external access, no sensitive data
- tier_1: Low risk - limited external access, basic data operations
- tier_2: Medium risk - external API calls, data processing, some write operations
- tier_3: High risk - financial operations, PII handling, code execution
- tier_4: Critical risk - autonomous financial transactions, unrestricted code execution

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Try to parse JSON from response
      let jsonText = content.text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/```json?\n?/g, '')
          .replace(/```$/g, '')
          .trim();
      }

      try {
        return JSON.parse(jsonText) as ManifestAnalysis;
      } catch (parseError) {
        debug('Failed to parse LLM response as JSON:', parseError);
        debug('Response was:', jsonText);
        return {};
      }
    }
  } catch (error) {
    debug('LLM analysis error:', error);
  }

  return {};
}

/**
 * Merge LLM analysis into manifest with required credential fields
 */
function mergeAnalysisIntoManifest(
  manifest: Record<string, unknown>,
  analysis: ManifestAnalysis,
  agentName: string,
): Record<string, unknown> {
  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const result = { ...manifest };

  // Apply LLM analysis values (prefer analysis over existing)
  if (analysis.agentDescription) {
    result.agentDescription = analysis.agentDescription;
  }
  if (analysis.agentVersion) {
    result.agentVersion = analysis.agentVersion;
  }
  if (analysis.primaryModelProvider) {
    result.primaryModelProvider = normalizeModelProvider(
      analysis.primaryModelProvider,
    );
  }
  if (analysis.primaryModelFamily) {
    result.primaryModelFamily = normalizeModelFamily(
      analysis.primaryModelFamily,
    );
  }
  if (analysis.tools && analysis.tools.length > 0) {
    result.tools = analysis.tools;
  }
  if (analysis.dataEncryptionStandards) {
    const normalizedDataEncryption = normalizeDataEncryptionStandards(
      analysis.dataEncryptionStandards,
    );
    if (normalizedDataEncryption) {
      result.dataEncryptionStandards = normalizedDataEncryption;
    }
  }
  if (analysis.dataRetentionPolicy) {
    result.dataRetentionPolicy = analysis.dataRetentionPolicy;
  }
  if (analysis.dataHandlingPractices) {
    result.dataHandlingPractices = analysis.dataHandlingPractices;
  }
  if (analysis.deploymentEnvironment) {
    const normalizedDeployment = normalizeDeploymentEnvironment(
      analysis.deploymentEnvironment,
    );
    if (normalizedDeployment) {
      result.deploymentEnvironment = normalizedDeployment;
    }
  }
  if (analysis.authenticationMethods) {
    result.authenticationMethods = analysis.authenticationMethods;
  }
  if (analysis.auditLogging !== undefined) {
    result.auditLogging = analysis.auditLogging;
  }
  if (analysis.kybTierRequired) {
    const normalizedKybTier = normalizeKybTier(analysis.kybTierRequired);
    if (normalizedKybTier) {
      result.kybTierRequired = normalizedKybTier;
    }
  }
  if (analysis.kybTierJustification) {
    result.kybTierJustification = analysis.kybTierJustification;
  }

  // Add required credential fields with appropriate defaults
  // These are required by the schema but can't be determined from code analysis

  // Identity fields
  if (!result.credentialId) {
    result.credentialId = `urn:uuid:${uuidv4()}`;
  }
  if (!result.issuerDid) {
    result.issuerDid = PLACEHOLDER_ISSUER_DID;
  }
  if (!result.subjectDid) {
    result.subjectDid = generatePlaceholderSubjectDid(agentName);
  }
  if (!result.schemaVersion) {
    result.schemaVersion = '1.0';
  }

  // Safety evaluation fields - these should come from actual evaluations
  // TODO: Integrate with evaluation platform to get real scores
  const safetyPlaceholder = {
    score: 0.0,
    benchmarkName: 'pending-evaluation',
    benchmarkVersion: '0.0.0',
    evaluationDate: now.toISOString(),
    assuranceSource: 'self', // Valid values: self, beltic, third_party
  };

  if (!result.harmfulContentRefusalScore) {
    result.harmfulContentRefusalScore = safetyPlaceholder.score;
    result.harmfulContentBenchmarkName = safetyPlaceholder.benchmarkName;
    result.harmfulContentBenchmarkVersion = safetyPlaceholder.benchmarkVersion;
    result.harmfulContentEvaluationDate = safetyPlaceholder.evaluationDate;
    result.harmfulContentAssuranceSource = safetyPlaceholder.assuranceSource;
  }
  if (!result.promptInjectionRobustnessScore) {
    result.promptInjectionRobustnessScore = safetyPlaceholder.score;
    result.promptInjectionBenchmarkName = safetyPlaceholder.benchmarkName;
    result.promptInjectionBenchmarkVersion = safetyPlaceholder.benchmarkVersion;
    result.promptInjectionEvaluationDate = safetyPlaceholder.evaluationDate;
    result.promptInjectionAssuranceSource = safetyPlaceholder.assuranceSource;
  }
  if (!result.piiLeakageRobustnessScore) {
    result.piiLeakageRobustnessScore = safetyPlaceholder.score;
    result.piiLeakageBenchmarkName = safetyPlaceholder.benchmarkName;
    result.piiLeakageBenchmarkVersion = safetyPlaceholder.benchmarkVersion;
    result.piiLeakageEvaluationDate = safetyPlaceholder.evaluationDate;
    result.piiLeakageAssuranceSource = safetyPlaceholder.assuranceSource;
  }

  // Dates and SLO
  if (!result.incidentResponseSLO) {
    result.incidentResponseSLO = 'P7D'; // 7 days default
  }
  if (!result.credentialIssuanceDate) {
    result.credentialIssuanceDate = now.toISOString();
  }
  if (!result.credentialExpirationDate) {
    result.credentialExpirationDate = oneYearFromNow.toISOString();
  }

  // Verification fields
  // Valid overallSafetyRating: minimal_risk, low_risk, moderate_risk, high_risk, evaluation_pending
  if (!result.overallSafetyRating) {
    result.overallSafetyRating = 'evaluation_pending';
  }
  // Valid verificationLevel: self_attested, beltic_verified, third_party_verified
  if (!result.verificationLevel) {
    result.verificationLevel = 'self_attested';
  }
  // verificationMethod must be a DID URL format: did:(web|key|ion|pkh|ethr):...#key-id
  if (!result.verificationMethod) {
    result.verificationMethod = `${PLACEHOLDER_ISSUER_DID}#key-1`;
  }
  if (!result.credentialStatus) {
    result.credentialStatus = 'active';
  }
  if (!result.revocationListUrl) {
    result.revocationListUrl = 'https://beltic.dev/revocation/placeholder';
  }

  // Proof placeholder - will be replaced by actual signature during signing
  if (!result.proof) {
    result.proof = {
      type: 'Ed25519Signature2020',
      created: now.toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${PLACEHOLDER_ISSUER_DID}#key-1`,
      proofValue: 'placeholder-will-be-replaced-during-signing',
    };
  }

  return normalizeManifestForSchemaCompatibility(result);
}

/**
 * Simple patch without LLM (fallback)
 */
export function patchManifestWithPlaceholders(
  installDir: string,
  agentName: string,
): void {
  const manifestPath = path.join(installDir, 'agent-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('agent-manifest.json not found');
  }

  const manifest = readJsonRecord(manifestPath, 'agent-manifest.json');
  const patched = mergeAnalysisIntoManifest(manifest, {}, agentName);
  fs.writeFileSync(manifestPath, JSON.stringify(patched, null, 2), 'utf-8');
}

/**
 * Re-apply schema compatibility normalization to an existing manifest.
 * Used after commands like `beltic fingerprint` that may add legacy/extra fields.
 */
export function sanitizeManifestForSchemaCompatibility(
  installDir: string,
): void {
  const manifestPath = path.join(installDir, 'agent-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const manifest = readJsonRecord(manifestPath, 'agent-manifest.json');
  const normalized = normalizeManifestForSchemaCompatibility(manifest);
  fs.writeFileSync(manifestPath, JSON.stringify(normalized, null, 2), 'utf-8');
}

/**
 * Check if manifest has required credential fields
 */
export function manifestHasCredentialFields(installDir: string): boolean {
  const manifestPath = path.join(installDir, 'agent-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  const manifest = readJsonRecord(manifestPath, 'agent-manifest.json');
  const requiredFields = ['credentialId', 'issuerDid', 'schemaVersion'];

  return requiredFields.every((field) => field in manifest);
}
