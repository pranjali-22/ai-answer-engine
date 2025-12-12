// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { detectInputType } from "@/lib/utils";
import { callGroq, callGroqWithContext } from "@/lib/groq";
import { scrapeWebsite } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    const { hasUrl, url, query } = detectInputType(message);

    let ai: string;

    if (hasUrl && url) {
      console.log(`Processing message with URL: ${url}`);

      try {
        const siteData = await scrapeWebsite(url);
        console.log(`Scraped with: ${siteData.scrapedWith}, Word count: ${siteData.wordCount}`);

        ai = await callGroqWithContext(query || "Summarize this content", siteData);
      } catch (scrapeError: any) {
        console.error('Scraping error:', scrapeError);
        return NextResponse.json(
          {
            error: 'Failed to scrape website',
            message: scrapeError.message
          },
          { status: 500 }
        );
      }
    } else {
      console.log('Processing regular chat message');
      ai = await callGroq(message);
    }

    return NextResponse.json({
      success: true,
      user: message,
      ai,
      hasUrl,
      url: url || null,
    });

  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: err.message
      },
      { status: 500 }
    );
  }
}