import "cheerio";
import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { createAgent } from "langchain";
dotenv.config();

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.7,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});
const agent = createAgent({
  model: chatModel,
});

let inputMessage = `What is the standard method for Task Decomposition?
Once you get the answer, look up common extensions of that method.`;

let agentInputs = { messages: [{ role: "user", content: inputMessage }] };

const stream = await agent.stream(agentInputs, {
  streamMode: "values",
});

