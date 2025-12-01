import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import z from "zod";
import dotenv from "dotenv";
import { HumanMessage, SystemMessage } from "langchain";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});
const routeSchema = z.object({
  step: z.enum(["poem", "story", "joke"]).describe("路由进程中的下一个步骤"),
});

const router = model.withStructuredOutput(routeSchema);

const StateAnnotation = Annotation.Root({
  input: Annotation<string>,
  decision: Annotation<string>,
  output: Annotation<string>,
});

async function llmCall1(state: typeof StateAnnotation.State) {
  const result = await model.invoke([
    new SystemMessage("你是一个讲故事专家"),
    new HumanMessage(state.input),
  ]);
  return { output: result.content };
}

async function llmCall2(state: typeof StateAnnotation.State) {
  const result = await model.invoke([
    new SystemMessage("你是一个喜剧专家"),
    new HumanMessage(state.input),
  ]);
  return { output: result.content };
}

async function llmCall3(state: typeof StateAnnotation.State) {
  const result = await model.invoke([
    new SystemMessage("你是一个专业的诗人"),
    new HumanMessage(state.input),
  ]);
  return { output: result.content };
}

async function llmCallRouter(state: typeof StateAnnotation.State) {
  const decision = await router.invoke([
    new SystemMessage("根据用户请求将输入路由到故事、笑话或诗歌。"),
    new HumanMessage(state.input),
  ]);
  return { decision: decision.step };
}

function routeDecision(state: typeof StateAnnotation.State) {
  if (state.decision === "story") {
    return "llmCall1";
  } else if (state.decision === "joke") {
    return "llmCall2";
  } else if (state.decision === "poem") {
    return "llmCall3";
  }
  return "end";
}

const routerWorkflow = new StateGraph(StateAnnotation)
  .addNode("llmCall1", llmCall1)
  .addNode("llmCall2", llmCall2)
  .addNode("llmCall3", llmCall3)
  .addNode("llmCallRouter", llmCallRouter)
  .addEdge(START, "llmCallRouter")
  .addConditionalEdges("llmCallRouter", routeDecision, [
    "llmCall1",
    "llmCall2",
    "llmCall3",
  ])
  .addEdge("llmCall1", END)
  .addEdge("llmCall2", END)
  .addEdge("llmCall3", END)
  .compile();

const state = await routerWorkflow.invoke({
  input: "帮我推荐一部喜剧电影",
});
console.log("🚀 ~ state:", state.output);
