import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const getUserName = tool(
  (_, config) => {
    return config.context.user_name;
  },
  {
    name: "get_user_name",
    description: "获取用户名称",
    schema: z.object({}),
  }
);

const contextSchema = z.object({
  user_name: z.string(),
});
const agent = createAgent({
  model: chatModel,
  tools: [getUserName],
  contextSchema,
});

const chatWithAgent = async (): Promise<any> => {
  try {
    const response = await agent.invoke(
      {
        messages: [{ role: "user", content: `我的名字是？` }],
      },
      {
        context: {
          user_name: "xppcnn",
        },
      }
    );

    console.log(response);
  } catch (error) {
    throw error;
  }
};

chatWithAgent()