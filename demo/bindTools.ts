import {
  AIMessage,
  createAgent,
  tool,
  HumanMessage,
  BaseMessage,
} from "langchain";
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

const modelWithTools = chatModel.bindTools([getWeather]);
const messages: BaseMessage[] = [
  new HumanMessage("What's the weather in suzhou?"),
];

const ai_msg: AIMessage = await modelWithTools.invoke(messages);
messages.push(ai_msg);
console.log("🚀 ~ messages:", messages);

// Step 2: Execute tools and collect results
for (const tool_call of ai_msg.tool_calls!) {
  // Execute the tool with the generated arguments
  const tool_result = await getWeather.invoke(tool_call);
  messages.push(tool_result);
}

// Step 3: Pass results back to model for final response
const final_response = await modelWithTools.invoke(messages);
console.log("🚀 ~ final_response:", typeof final_response);
console.log(final_response.text);
