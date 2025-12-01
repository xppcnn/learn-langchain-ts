import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";
import {
  BaseStore,
  END,
  InMemoryStore,
  LangGraphRunnableConfig,
  MemorySaver,
  MessagesZodMeta,
  Runtime,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
dotenv.config();
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import z from "zod";
import { registry } from "@langchain/langgraph/zod";
import { BaseMessage } from "langchain";
const model = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-embedding-001",
});

const memoryStore = new InMemoryStore({
  index: {
    embeddings: embeddings,
    dims: 512,
    fields: ["food_preference", "$"],
  },
});

const userId = "1";

const namespaceForMemory = [userId, "memories"];

const memoryId = uuidv4();

const memory = { food_preference: "我喜欢榴莲" };

await memoryStore.put(namespaceForMemory, memoryId, memory);

const memoryId2 = uuidv4();

const memory2 = {
  color: "你可以通过配置参数或在存储记忆时指定参数来控制哪些记忆部分被嵌入：",
};
await memoryStore.put(namespaceForMemory, memoryId2, memory2, false);

// const memories = await memoryStore.search(namespaceForMemory, {
//   query: "我喜欢吃的水果是什么？",
// });

const checkpointer = new MemorySaver();

const State = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta),
});

const workflow = new StateGraph(State)
  .addNode("nodeA", (state) => {
    console.log("🚀 ~ state:", state);
    return state;
  })
  .addNode("nodeB", (state) => {
    console.log("🚀 ~ nodeB state:", state);
    return state;
  })
  .addEdge(START, "nodeA")
  .addEdge("nodeA", "nodeB")
  .addEdge("nodeB", END);

const graph = workflow.compile({ checkpointer, store: memoryStore });

const config = { configurable: { thread_id: "1", user_id: userId } };

// First let's just say hi to the AI
for await (const update of await graph.stream(
  { messages: [{ role: "user", content: "hi" }] },
  { ...config, streamMode: "updates" }
)) {
  console.log(update);
}

const updateMemory = async (
  state: z.infer<typeof State>,
  runtime: Runtime<{ user_id: string }>
) => {
  const userId = runtime.context?.user_id;
  if (!userId) {
    throw new Error("缺少User ID");
  }

  const namespace = [userId, "memories"];
  const memory = {};
  const memoryId = uuidv4();

  await runtime.store?.put(namespace, memoryId, { memory });
};

const callModel = async (
  state: z.infer<typeof State>,
  config: LangGraphRunnableConfig,
  store: BaseStore
) => {
  const userId = config.configurable?.user_id;
  const namespace = [userId, "memories"];

  const memories = await store.search(namespace, {
    query: state.messages[state.messages.length - 1].text,
    limit: 3
  });

  const info = memories.map(d => d.value.memory).join("\n")
};
