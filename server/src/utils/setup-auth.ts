import { setupAuthServer } from "../auth.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

export function setupAuth(MCP_PORT: number) {
  const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}`);
  const authServerUrl = new URL(`http://localhost:${MCP_PORT + 1}`);
  const oauthMetadata = setupAuthServer(authServerUrl);

  const tokenVerifier = {
    verifyAccessToken: async (token: string) => {
      const endpoint = oauthMetadata.introspection_endpoint;
      if (!endpoint) throw new Error('No token verification endpoint available in metadata');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString()
      });
      if (!response.ok) throw new Error(`Invalid or expired token: ${await response.text()}`);
      const data = await response.json();
      return {
        token,
        clientId: data.client_id,
        scopes: data.scope ? data.scope.split(' ') : [],
        expiresAt: data.exp,
      };
    }
  };

  const authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: ['mcp:tools'],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  return {
    authMiddleware,
    mcpAuthMetadataRouter: mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: ['mcp:tools'],
      resourceName: 'MCP Streamable HTTP Auth Server',
    })
  };
}