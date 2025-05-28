import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

import dotenv from 'dotenv';
dotenv.config();

export function setupAuth(MCP_PORT: number) {
  const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}`);

  const tokenVerifier = {
    verifyAccessToken: async (token: string) => {
      const tokenVerifierUrl = process.env.OAUTH2_TOKEN_VERIFIER_URL || '';
      const response = await fetch(`${tokenVerifierUrl}?access_token=${token}`);
      if (!response.ok) throw new Error(`Invalid or expired token: ${await response.text()}`);
      const data = await response.json();
      return {
        token,
        clientId: data.sub,
        scopes: data.scope ? data.scope.split(' ') : [],
        expiresAt: data.exp,
      };
    }
  };

  const authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: ['openid'],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  const proxyProvider = new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: process.env.OAUTH2_AUTHORIZATION_URL || '',
      tokenUrl: process.env.OAUTH2_TOKEN_URL || '',
      revocationUrl: process.env.OAUTH2_REVOCATION_URL || '',
    },
    verifyAccessToken: tokenVerifier.verifyAccessToken,
    getClient: async (clientId: string) => {
      return {
        redirect_uris: [process.env.OAUTH2_REDIRECT_URL || ''],
        scope: process.env.OAUTH2_SCOPE || '',
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        client_id: clientId,
        client_secret: process.env.OAUTH2_CLIENT_SECRET || '',
        response_types: [
          "code",
          "token",
          "id_token",
          "code token",
          "code id_token",
          "token id_token",
          "code token id_token",
          "none"
        ]
      };
    },
  })

  return {
    authMiddleware,
    mcpAuthMetadataRouter: mcpAuthRouter({
      provider: proxyProvider,
      issuerUrl: new URL(`http://localhost:${MCP_PORT}`),
      scopesSupported: ['openid', 'profile', 'email'],
      resourceName: 'MCP Streamable HTTP Auth Server',
    })
  };
}