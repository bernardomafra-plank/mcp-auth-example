
import { OAuthClientProvider, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { OAuthClientInformation, OAuthClientInformationFull, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { exec } from "child_process";
import { createServer } from "http";

const CALLBACK_PORT = 3092; // Use different port than auth server (3001)
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationFull;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;

  constructor(
    private readonly _redirectUrl: string | URL,
    private readonly _clientMetadata: OAuthClientMetadata,
    onRedirect?: (url: URL) => void
  ) {
    this._onRedirect = onRedirect || ((url) => {
      console.log(`Redirect to: ${url.toString()}`);
    });
  }

  private _onRedirect: (url: URL) => void;

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull): void {
    this._clientInformation = clientInformation;
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this._tokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this._onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved');
    }
    return this._codeVerifier;
  }
}

/**
 * Interactive MCP client with OAuth authentication
 * Demonstrates the complete OAuth flow with browser-based authorization
 */
class OAuthMCPClient extends Client {
  private serverUrl: string;

  constructor(serverUrl: string) {
    console.log('👤 Creating MCP client...');
    super({
      name: 'simple-oauth-client',
      version: '1.0.0',
    }, { capabilities: {} });

    console.log('👤 Client created');
    this.serverUrl = serverUrl;
  }

  /**
   * Opens the authorization URL in the user's default browser
   */

  private async openBrowser(url: string): Promise<void> {
    console.log(`🌐 Opening browser for authorization: ${url}`);

    const command = `open "${url}"`;

    exec(command, (error) => {
      if (error) {
        console.error(`Failed to open browser: ${error.message}`);
        console.log(`Please manually open: ${url}`);
      }
    });
  }
  /**
   * Example OAuth callback handler - in production, use a more robust approach
   * for handling callbacks and storing tokens
   */
  /**
   * Starts a temporary HTTP server to receive the OAuth callback
   */
  private async waitForOAuthCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        // Ignore favicon requests
        if (req.url === '/favicon.ico') {
          res.writeHead(404);
          res.end();
          return;
        }

        console.log(`📥 Received callback: ${req.url}`);
        const parsedUrl = new URL(req.url || '', 'http://localhost');
        const code = parsedUrl.searchParams.get('code');
        const error = parsedUrl.searchParams.get('error');

        if (code) {
          console.log(`✅ Authorization code received: ${code?.substring(0, 10)}...`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
            </html>
          `);

          resolve(code);
          setTimeout(() => server.close(), 3000);
        } else if (error) {
          console.log(`❌ Authorization error: ${error}`);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authorization Failed</h1>
                <p>Error: ${error}</p>
              </body>
            </html>
          `);
          reject(new Error(`OAuth authorization failed: ${error}`));
        } else {
          console.log(`❌ No authorization code or error in callback`);
          res.writeHead(400);
          res.end('Bad request');
          reject(new Error('No authorization code provided'));
        }
      });

      server.listen(CALLBACK_PORT, () => {
        console.log(`OAuth callback server started on http://localhost:${CALLBACK_PORT}`);
      });
    });
  }

  private async attemptConnection(oauthProvider: InMemoryOAuthClientProvider): Promise<void> {
    console.log('🚢 Creating transport with OAuth provider...');
    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, {
      authProvider: oauthProvider
    });
    console.log('🚢 Transport created');

    try {
      console.log('🔌 Attempting connection (this will trigger OAuth redirect)...');
      await this.connect(transport);
      console.log('🔓 No OAuth required for this server');
      console.log('✅ Connected successfully');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        console.log('🔐 OAuth required - waiting for authorization...');
        const callbackPromise = this.waitForOAuthCallback();
        const authCode = await callbackPromise;
        await transport.finishAuth(authCode);
        console.log('🔐 Authorization code received:', authCode);
        console.log('🔌 Reconnecting with authenticated transport...');
        await this.attemptConnection(oauthProvider);
      } else {
        console.error('❌ Connection failed with non-auth error:', error);
        throw error;
      }
    }
  }

  /**
   * Establishes connection to the MCP server with OAuth authentication
   */
  async start(): Promise<void> {
    console.log(`🔗 Attempting to connect to ${this.serverUrl}...`);

    const clientMetadata: OAuthClientMetadata = {
      client_name: 'Simple OAuth MCP Client',
      redirect_uris: [CALLBACK_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'mcp:tools'
    };

    console.log('🔐 Creating OAuth provider...');
    const oauthProvider = new InMemoryOAuthClientProvider(
      CALLBACK_URL,
      clientMetadata,
      (redirectUrl: URL) => {
        console.log(`📌 OAuth redirect handler called - opening browser`);
        console.log(`Opening browser to: ${redirectUrl.toString()}`);
        this.openBrowser(redirectUrl.toString());
      }
    );
    console.log('🔐 OAuth provider created');

    console.log('🔐 Starting OAuth flow...');

    await this.attemptConnection(oauthProvider);
  }

}

const main = async () => {
  const client = new OAuthMCPClient("http://localhost:3090/mcp");
  await client.start();

  const tools = await client.listTools()

  console.log("MCP Server Tools", tools.tools)
};

main();
