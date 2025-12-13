// src/lib/scraper.ts
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Redis } from "@upstash/redis";

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export interface ScrapedContent {
  title: string;
  mainContent: string;
  paragraphs?: string[];
  url: string;
  wordCount?: number;
  scrapedWith?: 'cheerio' | 'puppeteer';
  cachedAt?: number;
}

const CACHE_TTL = 7 * (24 * 60 * 60); // 7 days in seconds
const MAX_CACHE_SIZE = 1024000; // 1MB

export interface InputDetection {
  hasUrl: boolean;
  url: string | null;
  query: string;
}

export function detectInputType(input: string): InputDetection {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const urls = input.match(urlPattern);

  return {
    hasUrl: !!urls,
    url: urls ? urls[0] : null,
    query: input.replace(urlPattern, "").trim()
  };
}

export function isContentValid(content: any): boolean {
  return (
    content &&
    content.mainContent &&
    typeof content.mainContent === 'string' &&
    content.mainContent.length > 100
  );
}

function isValidScrapedContent(content: any): content is ScrapedContent {
  return (
    content &&
    typeof content === 'object' &&
    typeof content.title === 'string' &&
    typeof content.mainContent === 'string' &&
    typeof content.url === 'string' &&
    content.mainContent.length > 100
  );
}

function getCacheKey(url: string): string {
  const sanitizedUrl = url.substring(0, 200);
  return `scrape:${sanitizedUrl}`;
}

async function getCachedContent(url: string): Promise<ScrapedContent | null> {
  try {
    const cacheKey = getCacheKey(url);
    console.log(cacheKey)
    const cached = await redis.get(cacheKey);

    if (!cached) {
      console.log("CACHE NOT HIT")
      return null;
    }

    let parsed: any;
    if (typeof cached === 'string') {
      try {
        parsed = JSON.parse(cached);
      } catch (parseError) {
        console.error('Cache parse error:', parseError);
        await redis.del(cacheKey);
        return null;
      }
    } else {
      parsed = cached;
    }

    if (isValidScrapedContent(parsed)) {
      console.log(`Cache HIT for ${url}`);
      return parsed;
    }

    await redis.del(cacheKey);
    return null;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

async function cacheContent(
  url: string,
  content: ScrapedContent
): Promise<void> {
  try {
    const cacheKey = getCacheKey(url);
    const contentToCache = {
      ...content,
      cachedAt: Date.now()
    };
    console.log("cachekey",cacheKey)

    if (!isValidScrapedContent(contentToCache)) {
      console.log('Invalid content, skipping cache');
      return;
    }

    const serialized = JSON.stringify(contentToCache);

    if (serialized.length > MAX_CACHE_SIZE) {
      console.log('Content too large for cache');
      return;
    }
    console.log(`Before Cached content for ${url}`);
    console.log(serialized)

    await redis.set(cacheKey, serialized, { ex: CACHE_TTL });
    console.log(`Cached content for ${url}`);
  } catch (error) {
    console.error('Cache storage error:', error);
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL provided');
  }

  // Check cache first
  const cachedContent = await getCachedContent(url);
  if (cachedContent) {
    return cachedContent;
  }

  let scrapedContent: ScrapedContent;

  try {
    console.log('Attempting to scrape with Cheerio...');
    const content = await scrapeWithCheerio(url);

    if (isContentValid(content)) {
      console.log('Successfully scraped with Cheerio');
      scrapedContent = { ...content, scrapedWith: 'cheerio' };
      await cacheContent(url, scrapedContent);
      console.log('Successfully cached content');
      return scrapedContent;
    }

    console.log('Cheerio result insufficient, trying Puppeteer...');
  } catch (error) {
    console.log('Cheerio failed:', error);
  }

  // Fallback to Puppeteer for dynamic content
  console.log('Attempting to scrape with Puppeteer...');
  scrapedContent = await scrapeWithPuppeteer(url);
  scrapedContent.scrapedWith = 'puppeteer';

  await cacheContent(url, scrapedContent);
  return scrapedContent;
}

export async function scrapeWithCheerio(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside').remove();

    // Extract title
    const title = $('title').text().trim() ||
      $('h1').first().text().trim() ||
      'Untitled';

    // Try multiple content selectors
    let mainContent = '';
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content.length > mainContent.length) {
        mainContent = content;
      }
    }

    // Fallback to body
    if (!mainContent || mainContent.length < 100) {
      mainContent = $('body').text().trim();
    }

    // Extract paragraphs
    const paragraphs = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(p => p.length > 30);

    // Clean whitespace
    mainContent = mainContent.replace(/\s+/g, ' ').trim();

    return {
      title,
      mainContent: mainContent.slice(0, 10000), // Limit to 10k chars
      paragraphs: paragraphs.slice(0, 20),
      url,
      wordCount: mainContent.split(/\s+/).length,
    };
  } catch (error: any) {
    console.error('Cheerio scraping error:', error);
    throw new Error(`Cheerio scraping failed: ${error.message}`);
  }
}

export async function scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll(
        'script, style, nav, header, footer, aside'
      );
      unwanted.forEach(el => el.remove());

      const title = document.title ||
        document.querySelector('h1')?.textContent ||
        'Untitled';

      // Try to find main content
      const mainSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
      ];

      let mainContent = '';
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          const text = element.textContent.trim();
          if (text.length > mainContent.length) {
            mainContent = text;
          }
        }
      }

      // Fallback to body
      if (!mainContent || mainContent.length < 100) {
        mainContent = document.body.textContent || '';
      }

      // Extract paragraphs
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.textContent?.trim() || '')
        .filter(p => p.length > 30);

      return {
        title: title.trim(),
        mainContent: mainContent.replace(/\s+/g, ' ').trim(),
        paragraphs: paragraphs.slice(0, 20),
      };
    });

    return {
      ...content,
      mainContent: content.mainContent.slice(0, 10000),
      url,
      wordCount: content.mainContent.split(/\s+/).length,
    };
  } catch (error: any) {
    console.error('Puppeteer scraping error:', error);
    throw new Error(`Puppeteer scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}