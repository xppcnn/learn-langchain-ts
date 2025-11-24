import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { z } from "zod";
import { createAgent, SystemMessage, tool } from "langchain";
dotenv.config();

const pTagSelector = "p";

const cheerioLoader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  {
    selector: pTagSelector,
  }
);

const docs = await cheerioLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const allSplits = await splitter.splitDocuments(docs);

const embeddings = new OpenAIEmbeddings({
  modelName: process.env.OPENROUTER_EMBEDDING_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const vectorStore = new Chroma(embeddings, {
  collectionName: "a-test-collection",
});

// const serializeSplits = allSplits.map((doc) => ({
//   ...doc,
//   metadata: JSON.stringify(doc.metadata),
// }));

// await vectorStore.addDocuments(serializeSplits);

const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }: { query: string }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);
    const serialized = retrievedDocs
      .map(
        (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

const tools = [retrieve];

const systemPrompt = new SystemMessage(
  "You have access to a tool that retrieves context from a blog post. " +
    "Use the tool to help answer user queries."
);

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
  tools: tools,
  systemPrompt: systemPrompt.text,
});

let inputMessage = `What is the standard method for Task Decomposition?
Once you get the answer, look up common extensions of that method.`;

let agentInputs = { messages: [{ role: "user", content: inputMessage }] };

const stream = await agent.stream(agentInputs, {
  streamMode: "values",
});
for await (const step of stream) {
  const lastMessage = step.messages[step.messages.length - 1];
  console.log("🚀 ~ lastMessage:", lastMessage)
  console.log(`[${lastMessage.type}]: ${lastMessage.content}`);
  console.log("-----\n");
}
