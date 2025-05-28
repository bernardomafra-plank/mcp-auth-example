import { exec } from "child_process";
import { createServer } from "http";
import { logger } from "./logger.js";

export const openBrowser = (url: string): void => {
  logger.info(`Opening browser for authorization: ${url}`);
  exec(`open "${url}"`, (error) => {
    if (error) {
      logger.error(`Failed to open browser: ${error.message}`);
      logger.info(`Please manually open: ${url}`);
    }
  });
}


export const waitForOAuthCallback = (callbackPort: number): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === '/favicon.ico') {
        res.writeHead(404); res.end(); return;
      }
      logger.info(`Received callback: ${req.url}`);
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      const code = parsedUrl.searchParams.get('code');
      const error = parsedUrl.searchParams.get('error');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body><h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>
        `);
        resolve(code);
        setTimeout(() => server.close(), 3000);
      } else if (error) {
        logger.error(`Authorization error: ${error}`);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body><h1>Authorization Failed</h1><p>Error: ${error}</p></body></html>
        `);
        reject(new Error(`OAuth authorization failed: ${error}`));
      } else {
        logger.error('No authorization code or error in callback');
        res.writeHead(400); res.end('Bad request');
        reject(new Error('No authorization code provided'));
      }
    });
    server.listen(callbackPort, () => {
      logger.info(`OAuth callback server started on http://localhost:${callbackPort}`);
    });
  });
}
