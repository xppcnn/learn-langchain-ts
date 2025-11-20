import { AIMessageChunk, createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.7,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const getWeather = tool(
  ({ location }) => `Weather in ${location}: Sunny, 72°F`,
  {
    name: "get_weather",
    description: "Get weather information for a location",
    schema: z.object({
      location: z.string().describe("The location to get weather for"),
    }),
  }
);

const search = tool((query) => `Results for: ${query}`, {
  name: "search",
  description: "search for information",
  schema: z.object({
    query: z.string().describe("the query to search for"),
  }),
});

const agent = createAgent({
  model: chatModel,
  tools: [getWeather],
});

const chatWithAgent = async (message: string): Promise<any> => {
  try {
      const streamIterator = await agent.stream(
        { messages: [{ role: "user", content: "what is the weather in sf" }] },
        { streamMode: "updates" }
      );
      for await (const stream of streamIterator) {
        console.log(stream);
      }
  } catch (error) {
    throw error;
  }
};

await chatWithAgent("what is langchain");
