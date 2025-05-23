import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { OAuthClientInformationFull, OAuthMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { randomUUID } from "node:crypto";
import express, { Request, Response } from "express";


export class DemoInMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }

  async registerClient(clientMetadata: OAuthClientInformationFull) {
    this.clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }
}

/**
 * 🚨 DEMO ONLY - NOT FOR PRODUCTION
 *
 * This example demonstrates MCP OAuth flow but lacks some of the features required for production use,
 * for example:
 * - Persistent token storage
 * - Rate limiting
 */
export class DemoInMemoryAuthProvider implements OAuthServerProvider {
  clientsStore = new DemoInMemoryClientsStore();
  private codes = new Map<string, {
    params: AuthorizationParams,
    client: OAuthClientInformationFull}>();
  private tokens = new Map<string, AuthInfo>();

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const code = randomUUID();

    const searchParams = new URLSearchParams({
      code,
    });
    if (params.state !== undefined) {
      searchParams.set('state', params.state);
    }

    this.codes.set(code, {
      client,
      params
    });

    const targetUrl = new URL(client.redirect_uris[0]);
    targetUrl.search = searchParams.toString();
    res.redirect(targetUrl.toString());
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {

    // Store the challenge with the code data
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    return codeData.params.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    // Note: code verifier is checked in token.ts by default
    // it's unused here for that reason.
    _codeVerifier?: string
  ): Promise<OAuthTokens> {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    if (codeData.client.client_id !== client.client_id) {
      throw new Error(`Authorization code was not issued to this client, ${codeData.client.client_id} != ${client.client_id}`);
    }

    this.codes.delete(authorizationCode);
    const token = randomUUID();

    const tokenData = {
      token,
      clientId: client.client_id,
      scopes: codeData.params.scopes || [],
      expiresAt: Date.now() + 3600000, // 1 hour
      type: 'access'
    };

    this.tokens.set(token, tokenData);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      scope: (codeData.params.scopes || []).join(' '),
    };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    _refreshToken: string,
    _scopes?: string[]
  ): Promise<OAuthTokens> {
    throw new Error('Not implemented for example demo');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenData = this.tokens.get(token);
    if (!tokenData || !tokenData.expiresAt || tokenData.expiresAt < Date.now()) {
      throw new Error('Invalid or expired token');
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1000),
    };
  }
}


export const setupAuthServer = (authServerUrl: URL): OAuthMetadata => {
  // Create separate auth server app
  // NOTE: This is a separate app on a separate port to illustrate
  // how to separate an OAuth Authorization Server from a Resource
  // server in the SDK. The SDK is not intended to be provide a standalone
  // authorization server.
  const provider = new DemoInMemoryAuthProvider();
  const authApp = express();
  authApp.use(express.json());
  // For introspection requests
  authApp.use(express.urlencoded());

  // Add OAuth routes to the auth server
  // NOTE: this will also add a protected resource metadata route,
  // but it won't be used, so leave it.
  authApp.use(mcpAuthRouter({
    provider,
    issuerUrl: authServerUrl,
  }));

  authApp.post('/introspect', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      const tokenInfo = await provider.verifyAccessToken(token);
      res.json({
        active: true,
        client_id: tokenInfo.clientId,
        scope: tokenInfo.scopes.join(' '),
        exp: tokenInfo.expiresAt
      });
      return
    } catch (error) {
      res.status(401).json({
        active: false,
        error: 'Unauthorized',
        error_description: `Invalid token: ${error}`
      });
    }
  });

  const auth_port = authServerUrl.port;
  // Start the auth server
  authApp.listen(auth_port, () => {
    console.log(`OAuth Authorization Server listening on port ${auth_port}`);
  });

  // Note: we could fetch this from the server, but then we end up
  // with some top level async which gets annoying.
  const oauthMetadata: OAuthMetadata = {
    provider,
    issuer: authServerUrl.toString(),
    scopesSupported: ['mcp:tools'],
    authorization_endpoint: new URL("/authorize", authServerUrl).href,
    token_endpoint: new URL("/token", authServerUrl).href,
    response_types_supported: ['code'],
    registration_endpoint: new URL("/register", authServerUrl).href,
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:tools'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
  }

  oauthMetadata.introspection_endpoint = new URL("/introspect", authServerUrl).href;

  return oauthMetadata;
}
