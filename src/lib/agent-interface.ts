/**
 * Agent interface for Beltic wizard
 * Simplified version - we don't use the Claude Agent SDK for code modification
 * Instead, we use direct CLI commands and the Anthropic SDK for analysis
 */

import { logToFile } from '../utils/debug';

/**
 * Signal constants for wizard status messages
 */
export const AgentSignals = {
  /** Signal emitted when the agent reports progress to the user */
  STATUS: '[STATUS]',
  /** Signal emitted on error */
  ERROR: '[ERROR]',
} as const;

export type AgentSignal = (typeof AgentSignals)[keyof typeof AgentSignals];

/**
 * Error types for agent execution
 */
export enum AgentErrorType {
  /** Beltic CLI not found */
  CLI_NOT_FOUND = 'BELTIC_CLI_NOT_FOUND',
  /** CLI installation failed */
  CLI_INSTALL_FAILED = 'BELTIC_CLI_INSTALL_FAILED',
  /** Analysis failed */
  ANALYSIS_FAILED = 'BELTIC_ANALYSIS_FAILED',
  /** Command execution failed */
  COMMAND_FAILED = 'BELTIC_COMMAND_FAILED',
}

/**
 * Log a message to the log file
 */
export function logMessage(message: string, ...args: unknown[]): void {
  logToFile(message, ...args);
}
