import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Define a simple tool
const addTool = new DynamicStructuredTool({
    name: "add",
    description: "Adds two numbers together",
    schema: z.object({
        a: z.number().describe("The first number"),
        b: z.number().describe("The second number"),
    }),
    func: async ({ a, b }) => {
        return (a + b).toString();
    },
});

const tools = [addTool];

// Initialize the model
const model = new ChatOpenAI({
    modelName: process.env.OPENROUTER_MODEL,
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.AI_BASE_URL,
    },
});

// Create the prompt
const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
]);

async function main() {
    // Create the agent
    const agent = await createToolCallingAgent({
        llm: model,
        tools,
        prompt,
    });

    // Create the executor
    const agentExecutor = new AgentExecutor({
        agent,
        tools,
    });

    // Run the agent
    console.log("User: What is 3 + 5?");
    const result = await agentExecutor.invoke({
        input: "What is 3 + 5?",
    });

    console.log(`Agent: ${result.output}`);
}

main().catch(console.error);
