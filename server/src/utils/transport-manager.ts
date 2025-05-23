import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export class TransportManager {
  private transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  add(sessionId: string, transport: StreamableHTTPServerTransport) {
    this.transports[sessionId] = transport;
  }

  get(sessionId: string) {
    return this.transports[sessionId];
  }

  remove(sessionId: string) {
    delete this.transports[sessionId];
  }

  async closeAll() {
    for (const sessionId in this.transports) {
      try {
        await this.transports[sessionId].close();
        delete this.transports[sessionId];
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
  }
}