import { Annotation, StateGraph, Send } from "@langchain/langgraph";
import z from "zod";
import dotenv from "dotenv";
import { HumanMessage, SystemMessage } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

dotenv.config();

const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: process.env.GEMINI_MODE!,
});

const zodSectionSchema = z.object({
  name: z.string().describe("章节名称"),
  description: z.string().describe("章节的描述"),
});

type SectionSchema = z.infer<typeof zodSectionSchema>;

const zodSectionsSchema = z.object({
  sections: z.array(zodSectionSchema).describe("章节"),
});

type SectionsSchema = z.infer<typeof zodSectionsSchema>;

const planner = llm.withStructuredOutput(zodSectionsSchema);

const StateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  sections: Annotation<SectionsSchema[]>,
  completedSections: Annotation<string[]>({
    default: () => [],
    reducer: (a, b) => a.concat(b),
  }),
  finalReport: Annotation<string>,
});

const WorkerStateAnnotation = Annotation.Root({
  section: Annotation<SectionSchema>,
  completedSections: Annotation<string[]>({
    default: () => [],
    reducer: (a, b) => a.concat(b),
  }),
});

async function orchestrator(state: typeof StateAnnotation.State) {
  const reportSections = await planner.invoke([
    new SystemMessage("根据报告生成一份计划"),
    new HumanMessage(`报告的主题是${state.topic}`),
  ]);
  return { sections: reportSections.sections };
}

async function llmCall(state: typeof WorkerStateAnnotation.State) {
  const section = await llm.invoke([
    new SystemMessage("根据提供的名称和描述来写一份报告的章节名"),
    new HumanMessage(
      `这是章节名：${state.section.name}和章节的描述：${state.section.description}`
    ),
  ]);
  return { completedSections: [section.content] };
}

async function synthesizer(state: typeof StateAnnotation.State) {
  const completedSections = state.completedSections;
  const completedReportSections = completedSections.join("\n\n --- \n\n");
  return { finalReport: completedReportSections };
}

function assignWorker(state: typeof StateAnnotation.State) {
  return state.sections.map((section) => new Send("llmCall", { section }));
}

const orchestratorWorker = new StateGraph(StateAnnotation)
  .addNode("orchestrator", orchestrator)
  .addNode("llmCall", llmCall)
  .addNode("synthesizer", synthesizer)
  .addEdge("__start__", "orchestrator")
  .addConditionalEdges("orchestrator", assignWorker, ["llmCall"])
  .addEdge("llmCall", "synthesizer")
  .addEdge("synthesizer", "__end__")
  .compile();

const state = await orchestratorWorker.invoke({
  topic: "创建一个关于langchain v1.0的报告",
});
console.log("🚀 ~ state:", state);
