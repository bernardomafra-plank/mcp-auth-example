import { Request, Response, Express } from "express";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { randomUUID } from 'node:crypto';
import { TransportManager } from "../utils/transport-manager.js";

const transportManager = new TransportManager();

export function registerMcpRoutes(app: Express, authMiddleware: any, getServer: () => any) {
  app.post('/mcp', authMiddleware, async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;
      if (sessionId && transportManager.get(sessionId)) {
        transport = transportManager.get(sessionId);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const eventStore = new InMemoryEventStore();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (sid) => {
            transportManager.add(sid, transport);
          }
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transportManager.remove(sid);
        };
        const server = getServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', authMiddleware, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transportManager.get(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = transportManager.get(sessionId);
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', authMiddleware, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transportManager.get(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    try {
      const transport = transportManager.get(sessionId);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await transportManager.closeAll();
    console.log('Server shutdown complete');
    process.exit(0);
  });
}