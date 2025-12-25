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
import { getSourceFiles, readFileContent, type DetectionResult } from './detector';
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
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

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
    log(`  Agent description: "${analysis.agentDescription.substring(0, 60)}..."`);
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
  const patchedManifest = mergeAnalysisIntoManifest(manifest, analysis, agentName);

  // Write updated manifest
  log('Writing updated manifest...');
  fs.writeFileSync(manifestPath, JSON.stringify(patchedManifest, null, 2), 'utf-8');
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
  
  "primaryModelProvider": "One of: anthropic, openai, google, meta, mistral, cohere, amazon, microsoft, huggingface, self_hosted, other",
  "primaryModelFamily": "One of: claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-3.5-sonnet, claude-4, gpt-4, gpt-4-turbo, gpt-4o, gpt-4o-mini, gemini-pro, gemini-ultra, gemini-1.5, llama-3, llama-3.1, mistral-large, mistral-medium, command-r, command-r-plus, other",
  
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
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
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
    result.primaryModelProvider = analysis.primaryModelProvider;
  }
  if (analysis.primaryModelFamily) {
    result.primaryModelFamily = analysis.primaryModelFamily;
  }
  if (analysis.tools && analysis.tools.length > 0) {
    result.tools = analysis.tools;
  }
  if (analysis.dataEncryptionStandards) {
    result.dataEncryptionStandards = analysis.dataEncryptionStandards;
  }
  if (analysis.dataRetentionPolicy) {
    result.dataRetentionPolicy = analysis.dataRetentionPolicy;
  }
  if (analysis.dataHandlingPractices) {
    result.dataHandlingPractices = analysis.dataHandlingPractices;
  }
  if (analysis.deploymentEnvironment) {
    result.deploymentEnvironment = analysis.deploymentEnvironment;
  }
  if (analysis.authenticationMethods) {
    result.authenticationMethods = analysis.authenticationMethods;
  }
  if (analysis.auditLogging !== undefined) {
    result.auditLogging = analysis.auditLogging;
  }
  if (analysis.kybTierRequired) {
    result.kybTierRequired = analysis.kybTierRequired;
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
    result.schemaVersion = '2.0.0';
  }

  // Safety evaluation fields - these should come from actual evaluations
  // TODO: Integrate with evaluation platform to get real scores
  const safetyPlaceholder = {
    score: 0.0,
    benchmarkName: 'pending-evaluation',
    benchmarkVersion: '0.0.0',
    evaluationDate: now.toISOString(),
    assuranceSource: 'self-declared',
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
  if (!result.overallSafetyRating) {
    result.overallSafetyRating = 'unverified';
  }
  if (!result.verificationLevel) {
    result.verificationLevel = 'self-signed';
  }
  if (!result.verificationMethod) {
    result.verificationMethod = 'Ed25519Signature2020';
  }
  if (!result.credentialStatus) {
    result.credentialStatus = 'active';
  }
  if (!result.revocationListUrl) {
    result.revocationListUrl = 'https://beltic.dev/revocation/placeholder';
  }

  // Proof placeholder
  if (!result.proof) {
    result.proof = {
      type: 'Ed25519Signature2020',
      created: now.toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: PLACEHOLDER_ISSUER_DID + '#key-1',
    };
  }

  // Clean up invalid fields
  const fieldsToRemove = [
    '_metadata',
    'fingerprintMetadata',
    'incidentResponseSlo', // wrong case
    'manifestRevision',
    'manifestSchemaVersion',
  ];
  for (const field of fieldsToRemove) {
    if (field in result) {
      delete result[field];
    }
  }

  // Fix systemConfigFingerprint format
  if (result.systemConfigFingerprint && typeof result.systemConfigFingerprint === 'string') {
    result.systemConfigFingerprint = (result.systemConfigFingerprint as string).replace('sha256:', '');
  }

  return result;
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

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const patched = mergeAnalysisIntoManifest(manifest, {}, agentName);
  fs.writeFileSync(manifestPath, JSON.stringify(patched, null, 2), 'utf-8');
}

/**
 * Check if manifest has required credential fields
 */
export function manifestHasCredentialFields(installDir: string): boolean {
  const manifestPath = path.join(installDir, 'agent-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const requiredFields = ['credentialId', 'issuerDid', 'schemaVersion'];

  return requiredFields.every((field) => field in manifest);
}
