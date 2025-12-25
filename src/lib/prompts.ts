/**
 * Prompts for Beltic wizard LLM interactions
 */

import type { DetectionResult } from '../beltic/detector';
import type { AgentTool } from '../utils/types';

/**
 * Build prompt for extracting agent tools from codebase
 */
export function buildToolExtractionPrompt(
  detection: DetectionResult,
  fileContents: { path: string; content: string }[],
): string {
  const filesContext = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return `You are analyzing an AI agent codebase to extract information about the tools/functions it uses.

## Detected Information
- Language: ${detection.language}
- Model Provider: ${detection.modelProvider || 'unknown'}
- Agent Name: ${detection.agentName}

## Source Files
${filesContext}

## Task
Analyze the code and extract a list of tools/functions that this agent can use. For each tool, provide:
1. toolId - a unique identifier (snake_case)
2. toolName - human readable name
3. toolDescription - what the tool does (10-50 words)
4. riskCategory - one of: data, compute, financial, external
5. riskSubcategory - specific risk type
6. requiresAuth - whether it needs authentication
7. requiresHumanApproval - whether it should require human approval

Return the result as a JSON array wrapped in \`\`\`json code blocks.

Risk subcategories:
- data: data_read_internal, data_read_external, data_write_internal, data_write_external, data_delete, data_export
- compute: compute_code_execution, compute_query_generation, compute_api_call, compute_transformation, compute_analysis
- financial: financial_read, financial_transaction, financial_account_access, financial_payment_initiation
- external: external_internet_access, external_email, external_notification, external_authentication, external_file_access

Example output:
\`\`\`json
[
  {
    "toolId": "search_database",
    "toolName": "Search Database",
    "toolDescription": "Searches the internal database for records matching the query",
    "riskCategory": "data",
    "riskSubcategory": "data_read_internal",
    "requiresAuth": true,
    "requiresHumanApproval": false
  }
]
\`\`\`

If no tools are found, return an empty array: \`\`\`json []\`\`\``;
}

/**
 * Build prompt for generating agent description
 */
export function buildDescriptionPrompt(
  detection: DetectionResult,
  fileContents: { path: string; content: string }[],
): string {
  const filesContext = fileContents
    .slice(0, 5)
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return `You are analyzing an AI agent codebase to generate a description.

## Detected Information
- Language: ${detection.language}
- Model Provider: ${detection.modelProvider || 'unknown'}
- Agent Name: ${detection.agentName}
- Existing Description: ${detection.agentDescription || 'none'}

## Source Files (first 5)
${filesContext}

## Task
Generate a concise description (50-200 characters) for this agent that explains:
1. What the agent does
2. Its primary purpose
3. Key capabilities

Return ONLY the description text, no quotes or formatting.`;
}

/**
 * Parse tools from LLM response
 */
export function parseToolsFromResponse(response: string): AgentTool[] {
  // Try to extract JSON from code block
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidTool);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Try parsing the entire response as JSON
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidTool);
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

/**
 * Validate tool structure
 */
function isValidTool(tool: unknown): tool is AgentTool {
  if (typeof tool !== 'object' || tool === null) {
    return false;
  }

  const t = tool as Record<string, unknown>;
  return (
    typeof t.toolId === 'string' &&
    typeof t.toolName === 'string' &&
    typeof t.toolDescription === 'string' &&
    typeof t.riskCategory === 'string' &&
    typeof t.riskSubcategory === 'string' &&
    typeof t.requiresAuth === 'boolean' &&
    typeof t.requiresHumanApproval === 'boolean'
  );
}
