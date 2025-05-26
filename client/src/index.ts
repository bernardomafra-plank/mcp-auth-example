import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { exec } from "child_process";
import { createServer } from "http";
import { CALLBACK_PORT, CALLBACK_URL, InMemoryOAuthClientProvider } from "./auth.js";

const log = {
  info: console.log.bind(console, "[INFO]"),
  error: console.error.bind(console, "[ERROR]"),
  debug: console.debug.bind(console, "[DEBUG]"),
};

class OAuthMCPClient extends Client {
  private serverUrl: string;

  constructor(serverUrl: string) {
    log.info('Creating MCP client...');
    super({ name: 'simple-oauth-client', version: '1.0.0' }, { capabilities: {} });
    this.serverUrl = serverUrl;
    log.info('Client created');
  }

  private openBrowser(url: string): void {
    log.info(`Opening browser for authorization: ${url}`);
    exec(`open "${url}"`, (error) => {
      if (error) {
        log.error(`Failed to open browser: ${error.message}`);
        log.info(`Please manually open: ${url}`);
      }
    });
  }

  private waitForOAuthCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        if (req.url === '/favicon.ico') {
          res.writeHead(404); res.end(); return;
        }
        log.info(`Received callback: ${req.url}`);
        const parsedUrl = new URL(req.url || '', 'http://localhost');
        const code = parsedUrl.searchParams.get('code');
        const error = parsedUrl.searchParams.get('error');
        if (code) {
          log.info(`Authorization code received: ${code.substring(0, 10)}...`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body><h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>
          `);
          resolve(code);
          setTimeout(() => server.close(), 3000);
        } else if (error) {
          log.error(`Authorization error: ${error}`);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body><h1>Authorization Failed</h1><p>Error: ${error}</p></body></html>
          `);
          reject(new Error(`OAuth authorization failed: ${error}`));
        } else {
          log.error('No authorization code or error in callback');
          res.writeHead(400); res.end('Bad request');
          reject(new Error('No authorization code provided'));
        }
      });
      server.listen(CALLBACK_PORT, () => {
        log.info(`OAuth callback server started on http://localhost:${CALLBACK_PORT}`);
      });
    });
  }

  private async attemptConnection(oauthProvider: InMemoryOAuthClientProvider): Promise<void> {
    log.info('Creating transport with OAuth provider...');
    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, { authProvider: oauthProvider });
    log.info('Transport created');
    try {
      log.info('Attempting connection (this may trigger OAuth redirect)...');
      await this.connect(transport);
      log.info('No OAuth required for this server');
      log.info('Connected successfully');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        log.info('OAuth required - waiting for authorization...');
        const authCode = await this.waitForOAuthCallback();
        await transport.finishAuth(authCode);
        log.info('Authorization code received:', authCode);
        log.info('Reconnecting with authenticated transport...');
        await this.attemptConnection(oauthProvider);
      } else {
        log.error('Connection failed with non-auth error:', error);
        throw error;
      }
    }
  }

  async start(): Promise<void> {
    log.info(`Attempting to connect to ${this.serverUrl}...`);
    const clientMetadata = {
      client_name: 'Simple OAuth MCP Client',
      redirect_uris: [CALLBACK_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'mcp:tools',
    };
    log.info('Creating OAuth provider...');
    const oauthProvider = new InMemoryOAuthClientProvider(
      CALLBACK_URL,
      clientMetadata,
      (redirectUrl: URL) => {
        log.info('OAuth redirect handler called - opening browser');
        this.openBrowser(redirectUrl.toString());
      }
    );
    log.info('OAuth provider created');
    log.info('Starting OAuth flow...');
    await this.attemptConnection(oauthProvider);
  }
}

const main = async () => {
  const client = new OAuthMCPClient("http://localhost:3090/mcp");
  await client.start();
  const tools = await client.listTools();
  log.info("MCP Server Tools", tools.tools);
};

main();
