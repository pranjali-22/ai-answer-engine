import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY

const groq = new Groq({ apiKey: apiKey });


export async function POST(req: Request) {
  try {
    const { message } = await req.json();




    // Call Groq LLM
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: message },
      ],
    });


    const aiResponse = chatCompletion.choices[0].message.content;

    return Response.json({
      user: message,
      ai: aiResponse,
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
