import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";

dotenv.config();

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

// Initialize the model
const model = new ChatOpenAI({
  temperature: 0.7,
});

// Create a prompt template with a placeholder for history
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful AI assistant."],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

// Create the chain
const chain = prompt.pipe(chatModel);

// Store for chat histories
const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

// Function to get message history for a session
const getMessageHistory = async (sessionId: string) => {
  if (messageHistories[sessionId] === undefined) {
    messageHistories[sessionId] = new InMemoryChatMessageHistory();
  }
  return messageHistories[sessionId];
};

// Wrap the chain with message history
const withHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: getMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
});

async function main() {
  const rl = readline.createInterface({ input, output });
  const sessionId = "user-session-1"; // Single session for this CLI demo

  console.log("Chat started! Type 'exit' or 'quit' to end the conversation.");
  console.log("------------------------------------------------------------");

  while (true) {
    const userInput = await rl.question("You: ");

    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("Goodbye!");
      break;
    }

    try {
      const response = await withHistory.invoke(
        { input: userInput },
        { configurable: { sessionId } }
      );

      console.log(`AI: ${response.content}`);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  rl.close();
}

main().catch(console.error);
