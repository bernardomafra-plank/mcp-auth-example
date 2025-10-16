# Remote MCP with [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)

This is an example implementation of an MCP server and client using [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) with [OAuth 2.0](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization#2-1-overview).

## Project Structure

This repository is organized as a monorepo with separate `server` and `client` directories:

- `server/*` — The MCP server implementation
- `client/*` — The MCP client implementation

## Quick Start (Manual)

### Server

1. Open a terminal and navigate to the server directory:
   ```sh
   cd server
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build and start the server:
   ```sh
   npm start
   ```
   This will start the MCP server server on port 3090.

### Client

1. Open a new terminal and navigate to the client directory:
   ```sh
   cd client
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build and start the project:
   ```sh
   npm start
   ```

## Using VS Code Tasks (Recommended)

This project includes pre-configured VS Code tasks for easier setup and running:

1. Open the project in VS Code.
2. Press `Cmd+Shift+B` (or open the Command Palette and search for `Tasks: Run Task`).
3. Select:
   - **Start All**: Starts both the server and client (client waits for server to be ready).

---

For more details on MCP and Streamable HTTP, see the [specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http).

For more details on the MCP Oauth, see the [specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization#2-1-overview).