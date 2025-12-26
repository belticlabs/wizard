import * as crypto from 'node:crypto';
import * as http from 'node:http';
import axios from 'axios';
import chalk from 'chalk';
import { z } from 'zod';
import clack from './clack';
import { ISSUES_URL, OAUTH_PORT } from '../lib/constants';
import { abort } from './clack-utils';

const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
});

export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

export interface OAuthConfig {
  /** OAuth authorization server URL (e.g., https://auth.beltic.app) */
  authUrl: string;
  /** OAuth token endpoint URL */
  tokenUrl: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth scopes to request */
  scopes: string[];
  /** Signup URL (optional, for redirecting new users) */
  signupUrl?: string;
  /** Application name for user-facing messages */
  appName?: string;
}

/**
 * Generate a cryptographically secure code verifier for PKCE
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate code challenge from verifier using SHA256
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Cross-platform URL opener
 */
async function openUrl(url: string): Promise<void> {
  try {
    // Try using Node's built-in child_process
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      // Linux and others
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  } catch (error) {
    // Silently fail - user can manually open the URL
    // The log message below will guide them
  }
}

/**
 * Start a local HTTP server to receive OAuth callback
 */
async function startCallbackServer(
  authUrl: string,
  signupUrl: string | undefined,
  expectedState: string,
): Promise<{
  server: http.Server;
  waitForCallback: () => Promise<string>;
}> {
  return new Promise((resolve, reject) => {
    let callbackResolve: (code: string) => void;
    let callbackReject: (error: Error) => void;

    const waitForCallback = () =>
      new Promise<string>((res, rej) => {
        callbackResolve = res;
        callbackReject = rej;
      });

    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end();
        return;
      }
      const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);

      // Handle /authorize endpoint - ALWAYS redirect to authUrl (or signupUrl if signup=true)
      if (url.pathname === '/authorize') {
        const isSignup = url.searchParams.get('signup') === 'true';
        const redirectUrl = isSignup && signupUrl ? signupUrl : authUrl;
        res.writeHead(302, { Location: redirectUrl });
        res.end();
        return;
      }

      // Handle callback - extract code and validate state
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const state = url.searchParams.get('state');

        if (error) {
          const isAccessDenied = error === 'access_denied';
          res.writeHead(isAccessDenied ? 200 : 400, {
            'Content-Type': 'text/html',
          });
          res.end(`
          <html>
            <body>
              <p>${
                isAccessDenied
                  ? 'Authorization cancelled.'
                  : `Authorization failed.`
              }</p>
              <p>Return to your terminal. This window will close automatically.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
          callbackReject(new Error(`OAuth error: ${error}`));
          return;
        }

        // Validate state parameter
        if (!state || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
          <html>
            <body>
              <p>Invalid state parameter. Authorization failed.</p>
              <p>Return to your terminal. This window will close automatically.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
          callbackReject(
            new Error(
              'State mismatch: OAuth callback state does not match expected value',
            ),
          );
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
          <html>
            <body>
              <p>Authorization successful! Return to your terminal.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
          callbackResolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
          <html>
            <body>
              <p>Invalid request - no authorization code received.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
          callbackReject(new Error('No authorization code in callback URL'));
        }
        return;
      }

      // Unknown path
      res.writeHead(404);
      res.end();
    });

    // Bind to 127.0.0.1 only (localhost) for security
    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      resolve({ server, waitForCallback });
    });

    server.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${OAUTH_PORT} is already in use. Please close the application using this port and try again.`,
          ),
        );
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Exchange authorization code for access token
 * Uses console endpoint format: { code, code_verifier, redirect_uri, client_id }
 */
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  config: OAuthConfig,
): Promise<OAuthTokenResponse> {
  const response = await axios.post(
    config.tokenUrl,
    {
      code,
      code_verifier: codeVerifier,
      redirect_uri: `http://localhost:${OAUTH_PORT}/callback`,
      client_id: config.clientId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  );

  return OAuthTokenResponseSchema.parse(response.data);
}

/**
 * Generate a random state parameter for OAuth flow
 * State is separate from PKCE verifier for additional security
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Perform OAuth 2.0 Authorization Code flow with PKCE
 *
 * This is a generic OAuth implementation that works with any OAuth 2.0 provider
 * that supports PKCE (Proof Key for Code Exchange), including:
 * - WorkOS
 * - Auth0
 * - Ory
 * - Any OAuth 2.0 provider with PKCE support
 *
 * @param config OAuth configuration
 * @returns OAuth token response with access token
 */
export async function performOAuthFlow(
  config: OAuthConfig,
): Promise<OAuthTokenResponse> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState(); // Generate random state (separate from PKCE verifier)

  const authUrlObj = new URL(config.authUrl);
  authUrlObj.searchParams.set('client_id', config.clientId);
  authUrlObj.searchParams.set(
    'redirect_uri',
    `http://localhost:${OAUTH_PORT}/callback`,
  );
  authUrlObj.searchParams.set('response_type', 'code');
  authUrlObj.searchParams.set('code_challenge', codeChallenge);
  authUrlObj.searchParams.set('code_challenge_method', 'S256');
  authUrlObj.searchParams.set('scope', config.scopes.join(' '));
  authUrlObj.searchParams.set('state', state); // Include state in authorize URL

  const authUrl = authUrlObj.toString();
  const signupUrl = config.signupUrl
    ? new URL(
        `${config.signupUrl}?next=${encodeURIComponent(authUrl)}`,
      ).toString()
    : undefined;

  const localSignupUrl = signupUrl
    ? `http://localhost:${OAUTH_PORT}/authorize?signup=true`
    : undefined;
  const localLoginUrl = `http://localhost:${OAUTH_PORT}/authorize`;

  const urlToOpen = config.signupUrl
    ? localSignupUrl || localLoginUrl
    : localLoginUrl;
  const appName = config.appName || 'Beltic';

  // Pass expected state to callback server for validation
  const { server, waitForCallback } = await startCallbackServer(
    authUrl,
    signupUrl,
    state,
  );

  clack.log.info(
    `${chalk.bold(
      "If the browser window didn't open automatically, please open the following link:",
    )}\n\n${chalk.cyan(urlToOpen)}${
      signupUrl
        ? `\n\nIf you already have an account, you can use this link:\n\n${chalk.cyan(
            localLoginUrl,
          )}`
        : ``
    }`,
  );

  if (process.env.NODE_ENV !== 'test') {
    await openUrl(urlToOpen);
  }

  const loginSpinner = clack.spinner();
  loginSpinner.start('Waiting for authorization...');

  try {
    // Increase timeout to 5 minutes (300 seconds) to match beltic-cli
    const code = await Promise.race([
      waitForCallback(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Authorization timed out')), 300_000),
      ),
    ]);

    const token = await exchangeCodeForToken(code, codeVerifier, config);

    server.close();
    loginSpinner.stop('Authorization complete!');

    return token;
  } catch (e) {
    loginSpinner.stop('Authorization failed.');
    server.close();

    const error = e instanceof Error ? e : new Error('Unknown error');

    if (error.message.includes('timeout')) {
      clack.log.error(
        'Authorization timed out after 5 minutes. Please try again.',
      );
    } else if (error.message.includes('State mismatch')) {
      clack.log.error(
        `${chalk.red('Security error:')}\n\n${error.message}\n\n${chalk.dim(
          'This may indicate a security issue. Please try again.',
        )}`,
      );
    } else if (error.message.includes('access_denied')) {
      clack.log.info(
        `${chalk.yellow(
          'Authorization was cancelled.',
        )}\n\nYou denied access to ${appName}. To use the wizard, you need to authorize access.\n\n${chalk.dim(
          'You can try again by re-running the wizard.',
        )}`,
      );
    } else {
      clack.log.error(
        `${chalk.red('Authorization failed:')}\n\n${
          error.message
        }\n\n${chalk.dim(
          `If you think this is a bug, please create an issue:\n${ISSUES_URL}`,
        )}`,
      );
    }

    abort();
    throw error;
  }
}
