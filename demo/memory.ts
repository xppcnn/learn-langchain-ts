import { createAgent, providerStrategy, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryStore } from "@langchain/langgraph";
import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

const store = new InMemoryStore();

const getUserInfo = tool(
  async ({ user_id }) => {
    const value = await store.get(["users"], user_id);
    console.log("get_user_info", user_id, value);
    return value;
  },
  {
    name: "get_user_info",
    description: "查询用户信息",
    schema: z.object({
      user_id: z.string(),
    }),
  }
);

const saveUserInfo = tool(
  async ({ user_id, name, age, email }) => {
    console.log("save_user_info", user_id, name, age, email);
    await store.put(["users"], user_id, { name, age, email });
    return "用户信息保存成功！";
  },
  {
    name: "save_user_info",
    description: "保存用户信息",
    schema: z.object({
      user_id: z.string(),
      name: z.string(),
      age: z.number(),
      email: z.string(),
    }),
  }
);

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const ContactInfo = z.object({
    name: z.string().describe("The name of the person"),
    email: z.string().describe("The email address of the person"),
    phone: z.string().describe("The phone number of the person"),
});


const agent = createAgent({
  model: chatModel,
  tools: [getUserInfo, saveUserInfo],
  responseFormat: providerStrategy(ContactInfo)
});

await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "保存如下用户信息: userid: abc123, name: Foo, age: 25, email: foo@langchain.dev",
    },
  ],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "帮我查一下userid为abc123的用户信息",
    },
  ],
});

console.log(result);
