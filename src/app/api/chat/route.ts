import Groq from "groq-sdk";
import puppeteer from "puppeteer";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


function detectInputType(input: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const urls = input.match(urlPattern);

  return {
    hasUrl: !!urls,
    url: urls ? urls[0] : null,
    query: input.replace(urlPattern, "").trim()
  };
}





export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const { hasUrl, url, query } = detectInputType(message);

    let ai;

    if (hasUrl && url) {
      const siteData = await scrapeWithPuppeteer(url);
      // console.log(siteData);

      ai = await callGroqWithContext(query, siteData);
    } else {
      ai = await callGroq(message);
    }

    return Response.json({
      user: message,
      ai
    });
  } catch (err) {
    console.error("Groq API error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function scrapeWebsite(url) {
  try {
    // Try Cheerio first (faster)
    const content = await scrapeWithCheerio(url);
    if (isContentValid(content)) {
      return content;
    }
  } catch (error) {
    console.log('Cheerio failed, trying Puppeteer...');
  }

  // Fallback to Puppeteer for dynamic content
  return await scrapeWithPuppeteer(url);
}

async function scrapeWithCheerio(url) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract relevant content
  return {
    title: $('title').text(),
    mainContent: $('article, main, .content').text(),
    paragraphs: $('p').map((i, el) => $(el).text()).get(),
    url: url
  };
}
async function scrapeWithPuppeteer(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const content = await page.evaluate(() => {
    return {
      title: document.title,
      mainContent: document.body.innerText,
      // Extract specific elements
    };
  });

  await browser.close();
  return content;
}
async function callGroq(message: string) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: message }
    ]
  });

  return completion.choices[0].message.content;
}

// async function callGroq(prompt) {
//   const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       model: 'mixtral-8x7b-32768', // or another model
//       messages: [{ role: 'user', content: prompt }],
//       temperature: 0.7
//     })
//   });
//
//   const data = await response.json();
//   return data.choices[0].message.content;
// }

async function callGroqWithContext(userQuery, webContent) {
  const prompt = `
Based on the following web content, answer the user's question.
Always cite specific information from the source.

WEB CONTENT:
Title: ${webContent.title}
URL: ${webContent.url}
Content: ${webContent.mainContent}

USER QUESTION: ${userQuery}

Provide your answer with citations like [Source: URL]
`;

  return await callGroq(prompt);
}

