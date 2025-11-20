import { ChromaClient } from "chromadb";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loader = new PDFLoader(path.join(__dirname, "test1.pdf"));

const docs = await loader.load();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const allSplits = await textSplitter.splitDocuments(docs);

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

const serializeSplits  = allSplits.map((doc) => ({
    ...doc,
    metadata: JSON.stringify(doc.metadata)
}));
// await vectorStore.addDocuments(serializeSplits);
// const result1 = await vectorStore.similaritySearch("what is seed-word prompt")
// console.log(JSON.stringify(result1[0]))

// const result2 = await vectorStore.similaritySearchWithScore("what is seed-word prompt")
// console.log("🚀 ~ result2:", JSON.stringify(result2[0]))

const queryEmbedding = await embeddings.embedQuery("The Seed-word prompt is a technique")

const result3 = await vectorStore.similaritySearchVectorWithScore(queryEmbedding,1)
console.log("🚀 ~ result3:", JSON.stringify(result3[0]))


