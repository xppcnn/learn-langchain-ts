import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import z from "zod";

const State = z.object({
  foo: z.string(),
  bar: z.array(z.string()).register(registry, {
    reducer: {
      fn: (x, y) => x.concat(y),
    },
    default: () => [] as string[],
  }),
});

const workflow = new StateGraph(State)
  .addNode("nodeA", (state) => {
    console.log("🚀 ~ nodeA state:", state);
    return { foo: "a", bar: ["a"] };
  })
  .addNode("nodeB", (state) => {
    console.log("🚀 ~ nodeB state:", state);
    return { foo: "b", bar: ["b"] };
  })
  .addEdge(START, "nodeA")
  .addEdge("nodeA", "nodeB")
  .addEdge("nodeB", END);

const checkPointer = new MemorySaver();

const graph = workflow.compile({ checkpointer: checkPointer });

const config = { configurable: { thread_id: "1" } };
await graph.invoke({ foo: "" }, config);
const checkpointList = [];
for await (const state of graph.getStateHistory(config)) {
  //   console.log(state); // Get checkpoint_id
  checkpointList.push(state.config.configurable!.checkpoint_id);
}
const config1 = {
  configurable: {
    thread_id: "1",
    checkpoint_id: checkpointList[1],
  },
};
console.log("ddd", await graph.getState(config));
await graph.updateState(config1, { foo: "22", bar: ["c", "d"] });

console.log("ddd", await graph.getState(config));
