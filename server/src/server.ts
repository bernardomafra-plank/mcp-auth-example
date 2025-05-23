import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShape } from "zod";
import { tools } from "./tools.js";

export const getServer = () => {
  const server = new McpServer({
    name: "example_mcp_server",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  tools.forEach((tool) => {
    server.tool(
      tool.name,
      tool.description || "",
      tool.inputSchema as ZodRawShape,
      tool.handler as any,
    );
  });

  return server;
}
