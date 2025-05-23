import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const mockJokes = [
  "Why did the chicken cross the road?... To get to the other side",
  "What did the fish say when it swam into a wall?... Nothing, it just waved",
  "What did one wall say to the other wall?... I'll meet you at the corner",
  "What do you call fake spaghetti?... An impasta",
];

const mockTodos = [
  "Buy groceries",
  "Finish the project",
  "Call the bank",
];

export const tools: Tool[] = [
  {
    name: "tell_joke",
    description: "Get a joke",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: () => {
      return {
        content: [
          {
            type: 'text',
            text: `Joke: ${mockJokes[Math.floor(Math.random() * mockJokes.length)]}`,
          }
        ],
      };
    }
  },
  {
    name: "add_todo",
    description: "Add a todo",
    inputSchema: {
      todo: z.string(),
    } as any,
    handler: (message: any) => {
      console.log("add_todo", message);
      mockTodos.push(message.todo);
      return {
        content: [
          {
            type: 'text',
            text: `Todo added: ${message.todo}`,
          }
        ],
      };
    }
  },
  {
    name: "list_todos",
    description: "List all todos",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: (message: any) => {
      console.log("list_todos", message);
      return {
        content: [
          {
            type: 'text',
            text: `Todos: ${mockTodos.join(", ")}`,
          }
        ],
      };
    }
  }
];