import axios, { AxiosError } from 'axios';
import { z } from 'zod';

/**
 * Generic API client for Beltic Console
 *
 * This is used to interact with the console API endpoints
 * after OAuth authentication via WorkOS.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle API errors and convert to ApiError
 */
function handleApiError(error: unknown, operation: string): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      detail?: string;
      message?: string;
    }>;
    const status = axiosError.response?.status;
    const detail =
      axiosError.response?.data?.detail || axiosError.response?.data?.message;
    const endpoint = axiosError.config?.url;

    if (status === 401) {
      return new ApiError(
        `Authentication failed while trying to ${operation}`,
        status,
        endpoint,
      );
    }

    if (status === 403) {
      return new ApiError(
        `Access denied while trying to ${operation}`,
        status,
        endpoint,
      );
    }

    if (status === 404) {
      return new ApiError(
        `Resource not found while trying to ${operation}`,
        status,
        endpoint,
      );
    }

    const message = detail || `Failed to ${operation}`;
    return new ApiError(message, status, endpoint);
  }

  if (error instanceof z.ZodError) {
    return new ApiError(`Invalid response format while trying to ${operation}`);
  }

  return new ApiError(
    `Unexpected error while trying to ${operation}: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
  );
}

/**
 * Generic API request function
 */
export async function apiRequest<T>(
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  data?: unknown,
  schema?: z.ZodSchema<T>,
): Promise<T> {
  try {
    const response = await axios({
      method,
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data,
    });

    if (schema) {
      return schema.parse(response.data);
    }

    return response.data as T;
  } catch (error) {
    const operation = `${method} ${url}`;
    throw handleApiError(error, operation);
  }
}

/**
 * Console API Developer Response Schema (JSON:API format)
 *
 * The console returns developers in JSON:API format with nested attributes
 */
const DeveloperAttributesSchema = z.object({
  status: z.string().optional(),
  legal_name: z.string(),
  entity_type: z.string().optional(),
  website: z.string().optional(),
  business_email: z.string().email(),
  business_phone: z.string().optional(),
  security_email: z.string().optional(),
  incorporation_jurisdiction: z
    .object({
      country: z.string(),
      region: z.string().optional(),
    })
    .optional(),
  kyb_tier: z.string().optional(),
  kyc_status: z.string().optional(),
  kyb_status: z.string().optional(),
  persona_inquiry_id: z.string().optional(),
  persona_account_id: z.string().optional(),
  sanctions_screening_status: z.string().optional(),
  overall_risk_rating: z.string().optional(),
  subject_did: z.string().optional(),
  public_key: z.unknown().optional(),
  agent_ids: z.array(z.string()).optional(),
  credential_ids: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const DeveloperResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal('developers'),
    attributes: DeveloperAttributesSchema,
  }),
});

export const KyaDeveloperSchema = DeveloperAttributesSchema.extend({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
});

export type KyaDeveloper = z.infer<typeof KyaDeveloperSchema>;

/**
 * Fetch current developer/user from console API
 */
export async function fetchDeveloperData(
  accessToken: string,
  baseUrl: string,
): Promise<KyaDeveloper> {
  const response = await apiRequest(
    accessToken,
    'GET',
    `${baseUrl}/api/developers/me`,
    undefined,
    DeveloperResponseSchema,
  );

  // Transform JSON:API response to flat developer object
  return {
    id: response.data.id,
    email: response.data.attributes.business_email,
    name: response.data.attributes.legal_name,
    ...response.data.attributes,
  };
}

/**
 * KYA Platform Agent Schema
 */
export const KyaAgentSchema = z.object({
  id: z.string(),
  developer_id: z.string(),
  name: z.string(),
  manifest: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type KyaAgent = z.infer<typeof KyaAgentSchema>;

/**
 * Fetch agent data from KYA API
 */
export async function fetchAgentData(
  accessToken: string,
  baseUrl: string,
  agentId: string,
): Promise<KyaAgent> {
  return apiRequest<KyaAgent>(
    accessToken,
    'GET',
    `${baseUrl}/v1/agents/${agentId}`,
    undefined,
    KyaAgentSchema,
  );
}

/**
 * List agents for a developer
 */
export async function listAgents(
  accessToken: string,
  baseUrl: string,
  developerId: string,
): Promise<KyaAgent[]> {
  return apiRequest<KyaAgent[]>(
    accessToken,
    'GET',
    `${baseUrl}/v1/developers/${developerId}/agents`,
    undefined,
    z.array(KyaAgentSchema),
  );
}
