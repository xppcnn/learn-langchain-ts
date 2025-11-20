import {
  createAgent,
  initChatModel,
  providerStrategy,
  tool,
  toolStrategy,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryStore } from "@langchain/langgraph";
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

const ContactInfo = z.object({
  name: z.string().describe("The name of the person"),
  email: z.string().describe("The email address of the person"),
  phone: z.string().describe("The phone number of the person"),
});

const EventDetails = z.object({
  event_name: z.string().describe("Name of the event"),
  date: z.string().describe("Event date"),
});

const agent = createAgent({
  model: chatModel,
  tools: [],
  responseFormat: toolStrategy([ContactInfo], {
    handleError: true,
  }),
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Extract info: John Doe (john@email.com) is organizing Tech Conference on March 15th",
    },
  ],
});

console.log(result);
