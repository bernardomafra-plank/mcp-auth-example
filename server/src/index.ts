import express from "express";
import { getServer } from "./server.js";
import { setupAuth } from "./utils/setup-auth.js";
import { registerMcpRoutes } from "./routes/mcp.js";

const MCP_PORT = 3090;
const app = express();

app.use(express.json());

// Auth setup
const { authMiddleware, mcpAuthMetadataRouter } = setupAuth(MCP_PORT);
app.use(mcpAuthMetadataRouter);

// MCP routes
registerMcpRoutes(app, authMiddleware, getServer);

app.listen(MCP_PORT, () => {
  console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
});
