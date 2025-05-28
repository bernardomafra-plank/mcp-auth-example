import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryOAuthClientProvider } from "./auth.js";
import { OAuthClientInformation, OAuthClientMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";

import dotenv from 'dotenv';
import { logger } from "./utils/logger.js";
import { openBrowser, waitForOAuthCallback } from "./utils/auth-code.js";
dotenv.config();

const CALLBACK_PORT = 3092;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

const PROVIDER_CONFIG = {
  clientId: process.env.OAUTH2_CLIENT_ID || '',
  clientSecret: process.env.OAUTH2_CLIENT_SECRET || '',
  scope: process.env.OAUTH2_SCOPE || '',
}

class OAuthMCPClient extends Client {
  private serverUrl: string;

  constructor(serverUrl: string) {
    logger.info('Creating MCP client...');
    super({ name: 'simple-oauth-client', version: '1.0.0' }, { capabilities: {} });
    this.serverUrl = serverUrl;
    logger.info('Client created');
  }

  private async attemptConnection(oauthProvider: InMemoryOAuthClientProvider): Promise<void> {
    logger.info('Creating transport with OAuth provider...');
    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, { authProvider: oauthProvider });
    logger.info('Transport created');
    try {
      logger.info('Attempting connection (this may trigger OAuth redirect)...');
      await this.connect(transport);
      logger.info('No OAuth required for this server');
      logger.info('Connected successfully!');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        logger.info('OAuth required - waiting for authorization...');
        const authCode = await waitForOAuthCallback(CALLBACK_PORT);
        logger.info('Authorization code received:', authCode);

        await transport.finishAuth(authCode);

        logger.debug("Authenticated with success: ", oauthProvider.tokens())
        logger.info('Creating a new transport with authenticated provider...');
        const newTransport = new StreamableHTTPClientTransport(baseUrl, { authProvider: oauthProvider });
        await this.connect(newTransport);
        logger.info('Connected successfully!');
      } else {
        logger.error('Connection failed with non-auth error:', error);
        throw error;
      }
    }
  }

  async start(): Promise<void> {
    logger.info(`Attempting to connect to ${this.serverUrl}...`);
    const clientMetadata: OAuthClientMetadata = {
      redirect_uris: [CALLBACK_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: PROVIDER_CONFIG.scope,
    };

    const clientInformation: OAuthClientInformation = {
      client_id: PROVIDER_CONFIG.clientId,
      client_secret: PROVIDER_CONFIG.clientSecret,
    };

    logger.info('Creating OAuth provider...');
    const oauthProvider = new InMemoryOAuthClientProvider(
      CALLBACK_URL,
      clientMetadata,
      clientInformation,
      (redirectUrl: URL) => {
        logger.info('OAuth redirect handler called - opening browser');
        openBrowser(redirectUrl.toString());
      }
    );

    logger.info('OAuth provider created');
    logger.info('Starting OAuth flow...');

    await this.attemptConnection(oauthProvider);

  }
}

const main = async () => {
  const client = new OAuthMCPClient("http://localhost:3090/mcp");
  await client.start();
  try {
    const tools = await client.listTools();
    logger.info("MCP Server Tools", tools.tools);
  } catch (error) {
    logger.error("Error listing tools", error);
  }
};

main();
