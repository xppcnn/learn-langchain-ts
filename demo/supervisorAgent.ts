import {
  AIMessageChunk,
  BuiltInState,
  createAgent,
  humanInTheLoopMiddleware,
  HumanMessage,
  tool,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";
import {
  Command,
  getCurrentTaskInput,
  MemorySaver,
} from "@langchain/langgraph";

const chatModel = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.7,
  maxTokens: 4000,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});

const createCalendarEvent = tool(
  ({ title, startTime, endTime, attendees, location }) => {
    return `event 创建成功：从${startTime}到${endTime}开始${title}，一共有${attendees.length}个参与`;
  },
  {
    name: "create_calendar_event",
    description: "创建一个calendar 事件，要求必须安装ISO进行时间格式化",
    schema: z.object({
      title: z.string(),
      startTime: z.string().describe("ISO 格式：'2024-01-15T14:00:00'"),
      endTime: z.string().describe("ISO 格式：'2024-01-15T15:00:00'"),
      attendees: z.array(z.string()).describe("邮件地址"),
      location: z.string().optional(),
    }),
  }
);

const sendEmail = tool(
  ({ to, subject }) => {
    return `发送邮件给：${to.join(",")}-主题是${subject}`;
  },
  {
    name: "send_email",
    description: "通过邮件 API发送邮件。要求传入格式化正确的邮件地址",
    schema: z.object({
      to: z.array(z.string()).describe("邮件地址"),
      subject: z.string(),
      body: z.string(),
      cc: z.array(z.string()).optional(),
    }),
  }
);

const getAvailableTimeSlots = tool(
  async () => {
    return ["09:00", "14:00", "16:00"];
  },
  {
    name: "get_available_time_slots",
    description: "检查特定日期，参会者可以参加会议的时间点",
    schema: z.object({
      attendees: z.array(z.string()),
      date: z.string().describe("ISO 格式：'2024-01-15'"),
      durationMinutes: z.number(),
    }),
  }
);
const CALENDAR_AGENT_PROMPT = `你是一个日程规划助手。
需要将日常语言(比如，“下周二下午两点”)转换成ISO日期时间格式。
必须通过调用get_available_time_slots来检查当前时间点是否可以参会。
使用create_calendar_event来创建日程规划。
在你最终的响应中必须要确认日程规划的内容。
`.trim();

const calendarAgent = createAgent({
  model: chatModel,
  tools: [createCalendarEvent, getAvailableTimeSlots],
  systemPrompt: CALENDAR_AGENT_PROMPT,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        create_calendar_event: true,
      },
      descriptionPrefix: "日程安排待批准",
    }),
  ],
});

// const query =
//   "在下周二晚上8点，创建一个时长为一小时的的团队会议, 参会者有alice@example.com，bob@example.com";

// const stream = await calendarAgent.stream({
//   messages: [new HumanMessage(query)],
// });

// for await (const step of stream) {
//   console.log("🚀 ~ step:", step);
//   for (const update of Object.values(step)) {
//     console.log("🚀 ~ update:", update);
//     if (update && typeof update === "object" && "messages" in update) {
//       for (const message of update.messages) {
//         console.log(message.toFormattedString());
//       }
//     }
//   }
// }

const EMAIL_AGENT_PROMPT = `
    你是一个邮件助手。
    基于自然语言来编写专业的邮件。
    提取收件人信息，编写合适的邮件主题和正文。
    使用send_email方法来发送邮件
    在你最终的响应中必须要确认发送的邮件内容。
`;

const emailAgent = createAgent({
  model: chatModel,
  tools: [sendEmail],
  systemPrompt: EMAIL_AGENT_PROMPT,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        send_email: true,
      },
      descriptionPrefix: "邮件发送待批准",
    }),
  ],
});

const emailQuery = "给设计团队发送一条提醒，让他们审查新的样图";

// const emailStream = await emailAgent.stream({
//   messages: [{ role: "user", content: emailQuery }],
// });

// for await (const step of emailStream) {
//   for (const update of Object.values(step)) {
//     if (update && typeof update === "object" && "messages" in update) {
//       for (const message of update.messages) {
//         console.log(message.toFormattedString());
//       }
//     }
//   }
// }
const config = { configurable: { thread_id: "6" } };
const scheduleEvent = tool(
  async (request: string) => {
    console.log("🚀 ~ request:", request)
    const currentMessages = getCurrentTaskInput<BuiltInState>(config).messages;
    const originalUserMessage = currentMessages.find(HumanMessage.isInstance);
    const prompt = `
    您正在协助处理以下用户咨询:

    ${originalUserMessage?.content || "No context available"}

    你被分配以下子任务:

    ${request}
        `.trim();
    const result = await calendarAgent.invoke({
      messages: [new HumanMessage(prompt)],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.text;
  },
  {
    name: "schedule_event",
    description: `
        使用自然语言来规划日程安排。
        当用户想要创建、修改或者查看日程安排时，可以使用这个功能。
        可以处理日期/时间解析、时间可用性检查和日程创建。
        输入：使用自然语言的日程安排（例如:下周二下午2点和开发团队开会）
    `.trim(),
    schema: z.object({
      request: z.string().describe("使用自然语言的日程安排请求"),
    }),
  }
);

const manageEmail = tool(
  async (request: string) => {
    const result = await emailAgent.invoke({
      messages: [new HumanMessage(request)],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.text;
  },
  {
    name: "manage_email",
    description: `
        使用自然语言来发送邮件。
        当用户想发生一个通知，提醒或者是任何沟通邮件。
        可以处理收件人提取、主题生成和电子邮件编写。
        输入：自然语言的发送邮件的请求（例如：发送一个关于会议的邮件提醒 ）
    `.trim(),
    schema: z.object({
      request: z.string().describe("使用自然语言的邮件请求"),
    }),
  }
);
const SUPERVISOR_PROMPT = `
    你是一个个人助手。
    你可以规划日程安排和发送邮件。
    将用户请求分解为适当的工具调用并协调结果。当一个请求涉及多个操作时，按顺序使用多个工具。
`.trim();
const supervisorAgent = createAgent({
  model: chatModel,
  tools: [scheduleEvent, manageEmail],
  systemPrompt: SUPERVISOR_PROMPT,
  checkpointer: new MemorySaver(),
});

// const simpleQuery = "规划一个明天早上九点的团队站立会";
// const simpleStream = await supervisorAgent.stream({
//   messages: [new HumanMessage(simpleQuery)],
// });

// for await (const step of simpleStream) {
//   for (const update of Object.values(step)) {
//     if (update && typeof update === "object" && "messages" in update) {
//       for (const message of update.messages) {
//         console.log(message.toFormattedString());
//       }
//     }
//   }
// }

const interrupts: any[] = [];
const complexQuery = `
    下个星期二下午两点和设计团队约一个会议，时长一个小时。同时需要发送一个邮件进行提醒。参会人有alice@example.com，bob@example.com
`.trim();

const resume: Record<string, any> = {};

for (const interrupt of interrupts) {
  const actionRequest = interrupt.value.actionRequests[0];
  if (actionRequest.name === "send_email") {
    const editedAction = { ...actionRequest };
    editedAction.arguments.subject = "测试邮件";
    resume[interrupt.id] = {
      decisions: [{ type: "edit", editedAction }],
    };
  } else {
    resume[interrupt.id] = { decisions: [{ type: "approve" }] };
  }
}

const complexStream = await supervisorAgent.stream(
  {
    messages: [{ role: "user", content: complexQuery }],
  },
  config
);

for await (const step of complexStream) {
  for (const update of Object.values(step)) {
    if (update && typeof update === "object" && "messages" in update) {
      for (const message of update.messages) {
        console.log(message.toFormattedString());
      }
    } else if (Array.isArray(update)) {
      const interrupt = update[0];
      interrupts.push(interrupt);
      console.log(`\nINTERRUPTED: ${interrupt.id}`);
    }
  }
}

const resumeStream = await supervisorAgent.stream(
  new Command({ resume }),
  config
);

for await (const step of resumeStream) {
  for (const update of Object.values(step)) {
    if (update && typeof update === "object" && "messages" in update) {
      for (const message of update.messages) {
        console.log(message.toFormattedString());
      }
    }
  }
}
