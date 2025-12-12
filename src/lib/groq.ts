// src/lib/groq.ts
import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is required');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const GROQ_MODELS = {
  LLAMA_8B: "llama-3.1-8b-instant",
  LLAMA_70B: "llama-3.1-70b-versatile",
  MIXTRAL: "mixtral-8x7b-32768",
} as const;

export interface WebContent {
  title: string;
  mainContent: string;
  url?: string;
}

export async function callGroq(
  message: string,
  model: string = GROQ_MODELS.LLAMA_8B
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: message }
      ],
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("Groq API error:", error);
    throw new Error(`Groq API error: ${error.message}`);
  }
}


export async function callGroqWithContext(
  userQuery: string,
  webContent: WebContent,
  model: string = GROQ_MODELS.LLAMA_8B
): Promise<string> {
  const prompt = `
Based on the following web content, answer the user's question.
Always cite specific information from the source.

WEB CONTENT:
Title: ${webContent.title}
${webContent.url ? `URL: ${webContent.url}` : ''}
Content: ${webContent.mainContent}

USER QUESTION: ${userQuery}

Provide your answer with citations like [Source: ${webContent.url || 'provided content'}]
`;

  return await callGroq(prompt, model);
}


export async function callGroqStream(
  message: string,
  onChunk: (chunk: string) => void,
  model: string = GROQ_MODELS.LLAMA_8B
): Promise<void> {
  try {
    const stream = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        onChunk(content);
      }
    }
  } catch (error: any) {
    console.error("Groq streaming error:", error);
    throw new Error(`Groq streaming error: ${error.message}`);
  }
}

export { groq };