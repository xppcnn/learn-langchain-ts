import { createAgent, tool } from "langchain";
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

const getWeatherTool = tool((input) => `It's always sunny in ${input.city}!`, {
  name: "get_weather",
  description: "Get the weather for a given city",
  schema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
});

const agent = createAgent({
  model: chatModel,
  tools: [getWeatherTool],
});

const chatWithAgent = async (message: string): Promise<any> => {
  try {
    const response = await agent.invoke({
      messages: [
        { role: "user", content: `What's the weather in ${message}?` },
      ],
    });

    return response;
  } catch (error) {
    throw error;
  }
};

const text = await chatWithAgent("suzhou");
console.log("🚀 ~ text:", text);
